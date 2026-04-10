import { useState, useEffect, useCallback, useRef } from 'react';
import { InteractionManager } from 'react-native';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/contexts/AuthContext';
import * as db from '@/src/lib/db';
import { chatSyncManager } from '@/src/lib/syncManager';

const PAGE_SIZE = 30;
const MAX_MESSAGES_IN_MEMORY = 200;

// ── Profile enrichment (fetches from Supabase + caches in SQLite) ──
async function enrichWithProfiles(msgs: any[], profileCache: Record<string, any>) {
  const unknownIds = [...new Set(msgs.map((m) => m.user_id).filter((id) => !profileCache[id]))];

  // First try to fill from SQLite
  const stillUnknown: string[] = [];
  for (const id of unknownIds) {
    const local = db.getProfile(id);
    if (local) {
      profileCache[id] = local;
    } else {
      stillUnknown.push(id);
    }
  }

  // Fetch remaining from Supabase
  if (stillUnknown.length > 0) {
    const { data: profiles } = await supabase.from('profiles').select('id, full_name, avatar_url').in('id', stillUnknown);
    if (profiles && profiles.length > 0) {
      db.upsertProfiles(profiles);
      profiles.forEach((p) => { profileCache[p.id] = p; });
    }
  }

  return msgs.map((m) => ({ ...m, profile: profileCache[m.user_id] || null }));
}

let groupChatsEnsured = false;

export interface ConversationPreview {
  id: string;
  type: 'dm' | 'group';
  group_id: string | null;
  other_user_id: string | null;
  name: string;
  avatar_url: string | null;
  last_message: string | null;
  last_message_at: string | null;
  last_message_by: string | null;
  unread: number;
}

export function useConversations() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ConversationPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const hasLoadedRef = useRef(false);

  const fetchConversations = useCallback(async () => {
    if (!user) return;

    // Step 1: Show cached conversations from SQLite instantly
    if (!hasLoadedRef.current) {
      const cached = db.getConversations();
      if (cached.length > 0) {
        const previews: ConversationPreview[] = cached.map((c) => ({
          id: c.id,
          type: c.type as 'dm' | 'group',
          group_id: c.group_id,
          other_user_id: c.other_user_id,
          name: c.name,
          avatar_url: c.avatar_url,
          last_message: c.last_message_text,
          last_message_at: c.last_message_at,
          last_message_by: c.last_message_sender,
          unread: c.unread_count,
        }));
        setConversations(previews);
        setLoading(false);
      } else {
        setLoading(true);
      }
    }

    // Step 2: Full Supabase fetch in background (existing logic)

    // Ensure all user's groups have a group chat (runs once per session)
    if (!groupChatsEnsured) {
      groupChatsEnsured = true;
      const { data: myGroups } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', user.id);
      if (myGroups && myGroups.length > 0) {
        await Promise.all(
          myGroups.map((g) =>
            supabase.rpc('get_or_create_group_chat', { p_group_id: g.group_id }).then(() => {}, () => {})
          )
        );
      }
    }

    // Get all conversations the user is a member of
    const { data: memberships } = await supabase
      .from('conversation_members')
      .select('conversation_id, last_read_at')
      .eq('user_id', user.id);

    if (!memberships || memberships.length === 0) {
      setConversations([]);
      setLoading(false);
      hasLoadedRef.current = true;
      return;
    }

    const convIds = memberships.map((m) => m.conversation_id);

    // Get conversations with their members
    const { data: convs } = await supabase
      .from('conversations')
      .select('*')
      .in('id', convIds);

    if (!convs) { setConversations([]); setLoading(false); hasLoadedRef.current = true; return; }

    // Get all members of these conversations with profiles
    const { data: allMembers } = await supabase
      .from('conversation_members')
      .select('conversation_id, user_id')
      .in('conversation_id', convIds);

    // Get profiles for all member user_ids
    const memberIds = [...new Set((allMembers || []).map((m) => m.user_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', memberIds);
    const profileMap: Record<string, any> = {};
    (profiles || []).forEach((p) => { profileMap[p.id] = p; });

    // Cache profiles in SQLite
    if (profiles && profiles.length > 0) {
      db.upsertProfiles(profiles);
    }

    // Get group names for group conversations, but only groups the user is still a member of
    const groupIds = convs.filter((c) => c.group_id).map((c) => c.group_id);
    let groupMap: Record<string, any> = {};
    if (groupIds.length > 0) {
      // Check which of these groups the user is still a member of
      const { data: myActiveMemberships } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', user.id)
        .in('group_id', groupIds);
      const myGroupIds = new Set((myActiveMemberships || []).map((m) => m.group_id));

      // Only fetch groups the user is still a member of
      const activeGroupIds = groupIds.filter((id) => myGroupIds.has(id));
      if (activeGroupIds.length > 0) {
        const { data: groups } = await supabase.from('groups').select('id, name, avatar_url').in('id', activeGroupIds);
        (groups || []).forEach((g) => { groupMap[g.id] = g; });
      }
    }

    // Filter out group conversations where the group no longer exists or user is no longer a member
    const orphanedConvIds = convs
      .filter((conv) => conv.type === 'group' && conv.group_id && !groupMap[conv.group_id])
      .map((conv) => conv.id);
    const validConvs = convs.filter((conv) => !orphanedConvIds.includes(conv.id));
    const validConvIds = validConvs.map((c) => c.id);

    // Cleanup orphaned conversation_members so they don't reappear
    if (orphanedConvIds.length > 0) {
      try {
        await supabase.from('conversation_members')
          .delete()
          .in('conversation_id', orphanedConvIds)
          .eq('user_id', user.id);
      } catch (e) {
        console.error('Failed to clean up orphaned conversation memberships:', e);
      }
    }

    // Get last message per conversation
    const { data: lastMessages } = await supabase
      .from('messages')
      .select('conversation_id, content, created_at, user_id')
      .in('conversation_id', validConvIds)
      .order('created_at', { ascending: false });

    const lastMsgMap: Record<string, any> = {};
    (lastMessages || []).forEach((m) => {
      if (!lastMsgMap[m.conversation_id]) lastMsgMap[m.conversation_id] = m;
    });

    // Build last_read_at map
    const lastReadMap: Record<string, string | null> = {};
    (memberships || []).forEach((m) => { lastReadMap[m.conversation_id] = m.last_read_at; });

    // Build previews
    const previews: ConversationPreview[] = validConvs.map((conv) => {
      const lastMsg = lastMsgMap[conv.id];
      const convMembers = (allMembers || []).filter((m) => m.conversation_id === conv.id);

      let name = '';
      let avatar_url: string | null = null;
      let other_user_id: string | null = null;

      if (conv.type === 'group' && conv.group_id && groupMap[conv.group_id]) {
        name = groupMap[conv.group_id].name;
        avatar_url = groupMap[conv.group_id].avatar_url;
      } else {
        const other = convMembers.find((m) => m.user_id !== user.id);
        const otherProfile = other ? profileMap[other.user_id] : null;
        name = otherProfile?.full_name || 'Onbekend';
        avatar_url = otherProfile?.avatar_url || null;
        other_user_id = other?.user_id || null;
      }

      const lastRead = lastReadMap[conv.id];
      const isUnread = lastMsg && lastMsg.user_id !== user.id && (
        !lastRead || new Date(lastMsg.created_at) > new Date(lastRead)
      );

      return {
        id: conv.id,
        type: conv.type,
        group_id: conv.group_id,
        other_user_id,
        name,
        avatar_url,
        last_message: lastMsg?.content || null,
        last_message_at: lastMsg?.created_at || conv.created_at,
        last_message_by: lastMsg ? profileMap[lastMsg.user_id]?.full_name || null : null,
        unread: isUnread ? 1 : 0,
      };
    });

    previews.sort((a, b) => {
      const ta = a.last_message_at || a.id;
      const tb = b.last_message_at || b.id;
      return tb.localeCompare(ta);
    });

    // Step 3: Upsert results into SQLite for next instant load
    db.upsertConversations(previews);

    // Start realtime via SyncManager for these conversations
    chatSyncManager.startRealtime(validConvIds);

    setConversations(previews);
    setLoading(false);
    hasLoadedRef.current = true;
  }, [user]);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  // Realtime: new messages trigger refresh
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('chat-updates')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
        fetchConversations();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // Initialize sync manager when user is available
  useEffect(() => {
    if (!user) return;
    chatSyncManager.initialize(user.id);
    return () => { /* cleanup handled elsewhere (logout) */ };
  }, [user]);

  const markAsRead = useCallback(async (conversationId: string) => {
    setConversations((prev) =>
      prev.map((c) => c.id === conversationId ? { ...c, unread: 0 } : c)
    );
    if (user) {
      await supabase.from('conversation_members')
        .update({ last_read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id);
    }
  }, [user]);

  return { conversations, loading, refresh: fetchConversations, markAsRead };
}

export function useChatMessages(conversationId: string | null) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [reactions, setReactions] = useState<Record<string, string[]>>({});

  // Refs to avoid stale closures in callbacks
  const oldestCursorRef = useRef<string | null>(null);
  const hasMoreRef = useRef(true);
  const loadingMoreRef = useRef(false);
  const convIdRef = useRef(conversationId);
  const profileCacheRef = useRef<Record<string, any>>({});

  // Mark conversation as read on open — deferred to not block slide animation
  useEffect(() => {
    if (!conversationId || !user) return;
    const handle = InteractionManager.runAfterInteractions(() => {
      supabase.from('conversation_members')
        .update({ last_read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id)
        .then(() => {});
    });
    return () => handle.cancel();
  }, [conversationId, user]);

  // ── Initial load: SQLite first, then delta sync from server ──
  const fetchInitial = useCallback(async () => {
    if (!conversationId) return;
    convIdRef.current = conversationId;
    profileCacheRef.current = {};

    // Step 1: Read messages from SQLite (instant)
    const localMessages = db.getMessages(conversationId, PAGE_SIZE);
    if (localMessages.length > 0) {
      setMessages(localMessages);
      oldestCursorRef.current = localMessages[localMessages.length - 1].created_at;
      setLoading(false);
      // Populate profile cache from local data
      localMessages.forEach((m: any) => {
        if (m.profile) profileCacheRef.current[m.user_id] = m.profile;
      });
    }

    // Step 2: Delta sync from server — fetch only messages newer than our latest local
    const latestLocal = localMessages.length > 0 ? localMessages[0].created_at : null;

    const query = supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);

    // If we have local data, still fetch the full first page to check for gaps
    const { data: freshMsgs } = await query;

    if (convIdRef.current !== conversationId) return;

    if (!freshMsgs || freshMsgs.length === 0) {
      if (localMessages.length === 0) {
        setMessages([]);
        setHasMore(false);
        hasMoreRef.current = false;
        oldestCursorRef.current = null;
        setLoading(false);
      }
      return;
    }

    // Enrich with profiles (SQLite first, then Supabase)
    const enriched = await enrichWithProfiles(freshMsgs, profileCacheRef.current);
    if (convIdRef.current !== conversationId) return;

    // Store fresh messages in SQLite for next time
    db.insertMessages(freshMsgs);

    const serverHasMore = freshMsgs.length === PAGE_SIZE;
    const oldestTs = enriched[enriched.length - 1].created_at;

    setMessages(enriched);
    oldestCursorRef.current = oldestTs;
    hasMoreRef.current = serverHasMore;
    setHasMore(serverHasMore);
    setLoading(false);
  }, [conversationId]);

  // ── Load older messages: try SQLite first, then Supabase ──
  const loadMore = useCallback(async () => {
    if (!conversationId || !hasMoreRef.current || loadingMoreRef.current) return;
    if (!oldestCursorRef.current) return;

    loadingMoreRef.current = true;
    setLoadingMore(true);

    // Step 1: Try loading from SQLite first
    const localOlder = db.getMessages(conversationId, PAGE_SIZE, oldestCursorRef.current);

    if (localOlder.length >= PAGE_SIZE) {
      // We have enough locally — use SQLite data
      const newOldest = localOlder[localOlder.length - 1].created_at;

      setMessages((prev) => {
        const existingIds = new Set(prev.map((m) => m.id));
        const newOnes = localOlder.filter((m) => !existingIds.has(m.id));
        const merged = [...prev, ...newOnes];
        return merged.length > MAX_MESSAGES_IN_MEMORY ? merged.slice(0, MAX_MESSAGES_IN_MEMORY) : merged;
      });

      oldestCursorRef.current = newOldest;
      // There might be more — can't know for sure from local count alone
      hasMoreRef.current = true;
      setHasMore(true);
      loadingMoreRef.current = false;
      setLoadingMore(false);
      return;
    }

    // Step 2: Not enough locally — fetch from Supabase
    const { data: olderMsgs } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .lt('created_at', oldestCursorRef.current)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);

    if (convIdRef.current !== conversationId) {
      loadingMoreRef.current = false;
      setLoadingMore(false);
      return;
    }

    if (!olderMsgs || olderMsgs.length === 0) {
      hasMoreRef.current = false;
      setHasMore(false);
      loadingMoreRef.current = false;
      setLoadingMore(false);
      return;
    }

    // Store in SQLite for future use
    db.insertMessages(olderMsgs);

    const enriched = await enrichWithProfiles(olderMsgs, profileCacheRef.current);
    if (convIdRef.current !== conversationId) {
      loadingMoreRef.current = false;
      setLoadingMore(false);
      return;
    }

    const serverHasMore = olderMsgs.length === PAGE_SIZE;
    const newOldest = enriched[enriched.length - 1].created_at;

    setMessages((prev) => {
      const existingIds = new Set(prev.map((m) => m.id));
      const newOnes = enriched.filter((m) => !existingIds.has(m.id));
      const merged = [...prev, ...newOnes];
      return merged.length > MAX_MESSAGES_IN_MEMORY ? merged.slice(0, MAX_MESSAGES_IN_MEMORY) : merged;
    });

    oldestCursorRef.current = newOldest;
    hasMoreRef.current = serverHasMore;
    setHasMore(serverHasMore);
    loadingMoreRef.current = false;
    setLoadingMore(false);
  }, [conversationId]);

  // ── Reset & fetch on conversation change ──
  // Check if we have local data to show instantly, otherwise show loading
  useEffect(() => {
    const hasLocal = conversationId ? db.getMessageCount(conversationId) > 0 : false;
    if (!hasLocal) setLoading(true);
    setLoadingMore(false);
    setHasMore(true);
    setReactions({});
    oldestCursorRef.current = null;
    hasMoreRef.current = true;
    loadingMoreRef.current = false;
    profileCacheRef.current = {};

    const handle = InteractionManager.runAfterInteractions(() => {
      fetchInitial();
    });
    return () => handle.cancel();
  }, [fetchInitial]);

  // ── Realtime: new messages — deferred to not block slide animation ──
  useEffect(() => {
    if (!conversationId) return;
    let channel: any = null;
    const handle = InteractionManager.runAfterInteractions(() => {
      channel = supabase
        .channel(`messages:${conversationId}`)
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        }, (payload) => {
          const newId = payload.new.id;
          supabase.from('messages')
            .select('*')
            .eq('id', newId)
            .single()
            .then(({ data: msg }) => {
              if (!msg) return;

              // Store in SQLite
              db.insertMessages([msg]);

              // Mark as read if message is from someone else
              if (msg.user_id !== user?.id) {
                supabase.from('conversation_members')
                  .update({ last_read_at: new Date().toISOString() })
                  .eq('conversation_id', conversationId)
                  .eq('user_id', user?.id)
                  .then(() => {});
              }
              supabase.from('profiles')
                .select('id, full_name, avatar_url')
                .eq('id', msg.user_id)
                .single()
                .then(({ data: profile }) => {
                  // Cache profile in SQLite
                  if (profile) {
                    db.upsertProfiles([profile]);
                  }

                  setMessages((prev) => {
                    const exists = prev.some((m) => m.id === newId);
                    if (exists) return prev;
                    const tempIdx = prev.findIndex((m) => m.id.startsWith('temp-') && m.user_id === msg.user_id && m.content === msg.content);
                    if (tempIdx >= 0) {
                      // Confirm optimistic message: replace temp with real
                      const tempId = prev[tempIdx].id;
                      db.confirmMessage(tempId, msg);
                      const updated = [...prev];
                      updated[tempIdx] = { ...msg, profile: profile || null };
                      return updated;
                    }
                    return [{ ...msg, profile: profile || null }, ...prev];
                  });

                  // Update conversation preview in SQLite
                  db.updateConversationPreview(
                    conversationId,
                    msg.content,
                    msg.created_at,
                    profile?.full_name ?? null,
                  );
                });
            });
        })
        .subscribe();
    });
    return () => { handle.cancel(); if (channel) supabase.removeChannel(channel); };
  }, [conversationId]);

  // ── Reactions: fetch & realtime ──
  const fetchReactions = useCallback(async (messageIds: string[]) => {
    if (messageIds.length === 0) return;
    const { data } = await supabase
      .from('message_reactions')
      .select('message_id, user_id')
      .in('message_id', messageIds);
    if (!data) return;
    const map: Record<string, string[]> = {};
    data.forEach((r) => {
      if (!map[r.message_id]) map[r.message_id] = [];
      map[r.message_id].push(r.user_id);
    });
    setReactions((prev) => ({ ...prev, ...map }));
  }, []);

  // Fetch reactions when messages change
  useEffect(() => {
    const ids = messages.filter((m) => !m.id.startsWith('temp-')).map((m) => m.id);
    if (ids.length > 0) fetchReactions(ids);
  }, [messages.length]);

  // Realtime reactions — deferred to not block slide animation
  useEffect(() => {
    if (!conversationId) return;
    let channel: any = null;
    const handle = InteractionManager.runAfterInteractions(() => {
      channel = supabase
        .channel(`reactions:${conversationId}`)
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'message_reactions',
        }, (payload) => {
          if (payload.eventType === 'INSERT') {
            const { message_id, user_id } = payload.new as any;
            setReactions((prev) => {
              const existing = prev[message_id] || [];
              if (existing.includes(user_id)) return prev;
              return { ...prev, [message_id]: [...existing, user_id] };
            });
          } else if (payload.eventType === 'DELETE') {
            const { message_id, user_id } = payload.old as any;
            setReactions((prev) => {
              const existing = prev[message_id];
              if (!existing) return prev;
              return { ...prev, [message_id]: existing.filter((id) => id !== user_id) };
            });
          }
        })
        .subscribe();
    });
    return () => { handle.cancel(); if (channel) supabase.removeChannel(channel); };
  }, [conversationId]);

  // ── Toggle like (optimistic) ──
  // Use ref to avoid re-creating callback on every reaction change (prevents ChatBubble re-renders)
  const reactionsRef = useRef(reactions);
  reactionsRef.current = reactions;
  const toggleLike = useCallback(async (messageId: string) => {
    if (!user || !messageId || messageId.startsWith('temp-')) return;
    const current = reactionsRef.current[messageId] || [];
    const alreadyLiked = current.includes(user.id);

    // Optimistic update
    setReactions((prev) => {
      const existing = prev[messageId] || [];
      if (alreadyLiked) {
        return { ...prev, [messageId]: existing.filter((id) => id !== user.id) };
      }
      return { ...prev, [messageId]: [...existing, user.id] };
    });

    if (alreadyLiked) {
      await supabase.from('message_reactions')
        .delete()
        .eq('message_id', messageId)
        .eq('user_id', user.id);
    } else {
      await supabase.from('message_reactions')
        .insert({ message_id: messageId, user_id: user.id });
    }
  }, [user]);

  // ── Send message (optimistic + SQLite) ──
  const sendMessage = useCallback(async (content: string) => {
    if (!user || !conversationId || !content.trim()) return;
    const trimmed = content.trim();
    const tempId = `temp-${Date.now()}`;
    const now = new Date().toISOString();

    const optimisticMsg = {
      id: tempId,
      conversation_id: conversationId,
      user_id: user.id,
      content: trimmed,
      message_type: null,
      metadata: null,
      created_at: now,
    };

    // Insert optimistic message in SQLite (synced=0)
    db.insertOptimisticMessage(optimisticMsg);

    setMessages((prev) => [{
      ...optimisticMsg,
      profile: { full_name: user.user_metadata?.full_name || '', avatar_url: null },
    }, ...prev]);

    await supabase.from('messages').insert({
      conversation_id: conversationId,
      user_id: user.id,
      content: trimmed,
    });
  }, [user, conversationId]);

  // ── Send gift (optimistic + SQLite) ──
  const sendGift = useCallback(async (
    recipientId: string, recipientName: string, groupId: string,
    category: number, quantity: number, categoryName: string,
  ) => {
    if (!user || !conversationId) return;

    const giverName = user.user_metadata?.full_name || 'Iemand';
    const content = `${giverName} heeft ${quantity} ${categoryName} gegeven aan ${recipientName}!`;
    const tempId = `temp-gift-${Date.now()}`;
    const now = new Date().toISOString();
    const metadata = { recipient_id: recipientId, category, quantity, category_name: categoryName };

    const optimisticMsg = {
      id: tempId,
      conversation_id: conversationId,
      user_id: user.id,
      content,
      message_type: 'gift',
      metadata,
      created_at: now,
    };

    db.insertOptimisticMessage(optimisticMsg);

    setMessages((prev) => [{
      ...optimisticMsg,
      profile: { full_name: giverName, avatar_url: null },
    }, ...prev]);

    const tallyInserts = Array.from({ length: quantity }, () => ({
      group_id: groupId,
      user_id: user.id,
      category,
      added_by: user.id,
    }));
    await supabase.from('tallies').insert(tallyInserts);

    await supabase.from('tally_gifts').insert({
      group_id: groupId,
      giver_id: user.id,
      recipient_id: recipientId,
      category,
      quantity,
      conversation_id: conversationId,
    });

    await supabase.from('messages').insert({
      conversation_id: conversationId,
      user_id: user.id,
      content,
      message_type: 'gift',
      metadata,
    });
  }, [user, conversationId]);

  const sendImage = useCallback(async (uri: string) => {
    if (!user || !conversationId) return;

    const fileName = `${user.id}/${Date.now()}.jpg`;
    const tempId = `temp-img-${Date.now()}`;
    const now = new Date().toISOString();
    const metadata = { image_url: uri };

    const optimisticMsg = {
      id: tempId,
      conversation_id: conversationId,
      user_id: user.id,
      content: '',
      message_type: 'image',
      metadata,
      created_at: now,
    };

    db.insertOptimisticMessage(optimisticMsg);

    // Optimistic: show local image immediately
    setMessages((prev) => [{
      ...optimisticMsg,
      profile: { full_name: user.user_metadata?.full_name || '', avatar_url: null },
    }, ...prev]);

    // Upload to Supabase Storage via fetch blob
    const response = await fetch(uri);
    const blob = await response.blob();
    const arrayBuffer = await new Response(blob).arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from('chat-images')
      .upload(fileName, arrayBuffer, { contentType: 'image/jpeg', upsert: false });

    if (uploadError) { console.error('Upload failed:', uploadError); return; }

    const { data: urlData } = supabase.storage.from('chat-images').getPublicUrl(fileName);
    const publicUrl = urlData.publicUrl;

    await supabase.from('messages').insert({
      conversation_id: conversationId,
      user_id: user.id,
      content: '',
      message_type: 'image',
      metadata: { image_url: publicUrl },
    });
  }, [user, conversationId]);

  return { messages, loading, loadingMore, hasMore, loadMore, sendMessage, sendImage, sendGift, reactions, toggleLike, refresh: fetchInitial };
}

export interface Contact {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

export function useContacts() {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchContacts = useCallback(async () => {
    if (!user) return;

    // Get accepted friendships (where I am either user_id or friend_id)
    const { data: friendships } = await supabase
      .from('friendships')
      .select('user_id, friend_id')
      .eq('status', 'accepted')
      .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

    if (!friendships || friendships.length === 0) {
      setContacts([]);
      setLoading(false);
      return;
    }

    // Extract the other user's ID from each friendship
    const friendIds = [...new Set(
      friendships.map((f) => f.user_id === user.id ? f.friend_id : f.user_id)
    )];

    // Get profiles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', friendIds);

    setContacts(
      (profiles || []).map((p) => ({
        id: p.id,
        full_name: p.full_name || 'Onbekend',
        avatar_url: p.avatar_url,
      }))
    );
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  // Refresh when friendships change
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('contacts-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, () => {
        fetchContacts();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  return { contacts, loading, refresh: fetchContacts };
}

export async function startDM(userId: string, _currentUserId: string): Promise<string> {
  const { data, error } = await supabase.rpc('start_dm', { other_user_id: userId });
  if (error || !data) throw new Error(error?.message || 'Failed to create conversation');
  return data as string;
}

export async function getOrCreateGroupChat(groupId: string, _memberUserIds: string[]): Promise<string> {
  const { data, error } = await supabase.rpc('get_or_create_group_chat', { p_group_id: groupId });
  if (error || !data) throw new Error(error?.message || 'Failed to create group chat');
  return data as string;
}

export async function sendGiftMessage(
  userId: string, userName: string, conversationId: string,
  recipientId: string, recipientName: string, groupId: string,
  category: number, quantity: number, categoryName: string,
) {
  // 1. Tallies for giver (they pay)
  const tallyInserts = Array.from({ length: quantity }, () => ({
    group_id: groupId, user_id: userId, category, added_by: userId,
  }));
  const { error: e1 } = await supabase.from('tallies').insert(tallyInserts);
  if (e1) console.error('Gift tallies insert failed:', e1.message);

  // 2. Gift record for recipient (credit)
  const { error: e2 } = await supabase.from('tally_gifts').insert({
    group_id: groupId, giver_id: userId, recipient_id: recipientId,
    category, quantity, conversation_id: conversationId,
  });
  if (e2) console.error('Gift record insert failed:', e2.message);

  // 3. Gift message
  const content = `${userName} heeft ${quantity} ${categoryName} gegeven aan ${recipientName}!`;
  const { error: e3 } = await supabase.from('messages').insert({
    conversation_id: conversationId, user_id: userId, content,
    message_type: 'gift',
    metadata: { recipient_id: recipientId, category, quantity, category_name: categoryName },
  });
  if (e3) console.error('Gift message insert failed:', e3.message);
}
