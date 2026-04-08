import { useState, useEffect, useCallback, useRef } from 'react';
import { InteractionManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/contexts/AuthContext';
import { getPreloadedMessages } from './useMessagePreloadCache';

const PAGE_SIZE = 30;
const MAX_MESSAGES_IN_MEMORY = 200;
const CACHE_KEY_PREFIX = 'chat_msgs_';
const CACHE_VERSION = 1;

// ── Cache helpers ──
async function loadCache(convId: string) {
  try {
    const raw = await AsyncStorage.getItem(`${CACHE_KEY_PREFIX}${convId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.version !== CACHE_VERSION) return null;
    return parsed as { version: number; messages: any[]; oldestCursor: string | null; hasMore: boolean };
  } catch { return null; }
}

async function saveCache(convId: string, msgs: any[], oldestCursor: string | null, hasMore: boolean) {
  try {
    const toCache = msgs.slice(0, PAGE_SIZE);
    await AsyncStorage.setItem(`${CACHE_KEY_PREFIX}${convId}`, JSON.stringify({
      version: CACHE_VERSION,
      messages: toCache,
      oldestCursor: toCache.length > 0 ? toCache[toCache.length - 1].created_at : null,
      hasMore,
    }));
  } catch {}
}

// ── Profile enrichment (caches across pages) ──
async function enrichWithProfiles(msgs: any[], cache: Record<string, any>) {
  const unknownIds = [...new Set(msgs.map((m) => m.user_id).filter((id) => !cache[id]))];
  if (unknownIds.length > 0) {
    const { data: profiles } = await supabase.from('profiles').select('id, full_name, avatar_url').in('id', unknownIds);
    (profiles || []).forEach((p) => { cache[p.id] = p; });
  }
  return msgs.map((m) => ({ ...m, profile: cache[m.user_id] || null }));
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
    if (!hasLoadedRef.current) setLoading(true);

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

  // ── Initial load: cache first, then server ──
  const fetchInitial = useCallback(async () => {
    if (!conversationId) return;
    convIdRef.current = conversationId;
    profileCacheRef.current = {};

    // Step 0: Check in-memory preload cache (instant, no async)
    const preloaded = getPreloadedMessages(conversationId);
    if (preloaded) {
      setMessages(preloaded.messages);
      oldestCursorRef.current = preloaded.oldestCursor;
      hasMoreRef.current = preloaded.hasMore;
      setHasMore(preloaded.hasMore);
      setLoading(false);
      Object.assign(profileCacheRef.current, preloaded.profileCache);
    }

    // Step 1: Show cached messages instantly (AsyncStorage fallback)
    const cached = await loadCache(conversationId);
    if (cached && cached.messages.length > 0) {
      setMessages(cached.messages);
      oldestCursorRef.current = cached.oldestCursor;
      hasMoreRef.current = cached.hasMore;
      setHasMore(cached.hasMore);
      setLoading(false);
      cached.messages.forEach((m: any) => { if (m.profile) profileCacheRef.current[m.user_id] = m.profile; });
    }

    // Step 2: Fetch fresh first page from server
    const { data: freshMsgs } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);

    if (convIdRef.current !== conversationId) return;

    if (!freshMsgs || freshMsgs.length === 0) {
      setMessages([]);
      setHasMore(false);
      hasMoreRef.current = false;
      oldestCursorRef.current = null;
      setLoading(false);
      saveCache(conversationId, [], null, false);
      return;
    }

    const enriched = await enrichWithProfiles(freshMsgs, profileCacheRef.current);
    if (convIdRef.current !== conversationId) return;

    const serverHasMore = freshMsgs.length === PAGE_SIZE;
    const oldestTs = enriched[enriched.length - 1].created_at;

    setMessages(enriched);
    oldestCursorRef.current = oldestTs;
    hasMoreRef.current = serverHasMore;
    setHasMore(serverHasMore);
    setLoading(false);
    saveCache(conversationId, enriched, oldestTs, serverHasMore);
  }, [conversationId]);

  // ── Load older messages (cursor pagination) ──
  const loadMore = useCallback(async () => {
    if (!conversationId || !hasMoreRef.current || loadingMoreRef.current) return;
    if (!oldestCursorRef.current) return;

    loadingMoreRef.current = true;
    setLoadingMore(true);

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
  // Defer data loading until after slide-in animation completes to prevent jitter
  useEffect(() => {
    setMessages([]);
    setLoading(true);
    setLoadingMore(false);
    setHasMore(true);
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
                  setMessages((prev) => {
                    const exists = prev.some((m) => m.id === newId);
                    if (exists) return prev;
                    const tempIdx = prev.findIndex((m) => m.id.startsWith('temp-') && m.user_id === msg.user_id && m.content === msg.content);
                    if (tempIdx >= 0) {
                      const updated = [...prev];
                      updated[tempIdx] = { ...msg, profile: profile || null };
                      return updated;
                    }
                    return [{ ...msg, profile: profile || null }, ...prev];
                  });
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
  const toggleLike = useCallback(async (messageId: string) => {
    if (!user || !messageId || messageId.startsWith('temp-')) return;
    const current = reactions[messageId] || [];
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
  }, [user, reactions]);

  // ── Send message (optimistic) ──
  const sendMessage = useCallback(async (content: string) => {
    if (!user || !conversationId || !content.trim()) return;
    const trimmed = content.trim();

    setMessages((prev) => [{
      id: `temp-${Date.now()}`,
      conversation_id: conversationId,
      user_id: user.id,
      content: trimmed,
      created_at: new Date().toISOString(),
      profile: { full_name: user.user_metadata?.full_name || '', avatar_url: null },
    }, ...prev]);

    await supabase.from('messages').insert({
      conversation_id: conversationId,
      user_id: user.id,
      content: trimmed,
    });
  }, [user, conversationId]);

  // ── Send gift (optimistic) ──
  const sendGift = useCallback(async (
    recipientId: string, recipientName: string, groupId: string,
    category: number, quantity: number, categoryName: string,
  ) => {
    if (!user || !conversationId) return;

    const giverName = user.user_metadata?.full_name || 'Iemand';
    const content = `${giverName} heeft ${quantity} ${categoryName} gegeven aan ${recipientName}!`;

    setMessages((prev) => [{
      id: `temp-gift-${Date.now()}`,
      conversation_id: conversationId,
      user_id: user.id,
      content,
      message_type: 'gift',
      metadata: { recipient_id: recipientId, category, quantity, category_name: categoryName },
      created_at: new Date().toISOString(),
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
      metadata: { recipient_id: recipientId, category, quantity, category_name: categoryName },
    });
  }, [user, conversationId]);

  const sendImage = useCallback(async (uri: string) => {
    if (!user || !conversationId) return;

    const fileName = `${user.id}/${Date.now()}.jpg`;

    // Optimistic: show local image immediately
    setMessages((prev) => [{
      id: `temp-img-${Date.now()}`,
      conversation_id: conversationId,
      user_id: user.id,
      content: '',
      message_type: 'image',
      metadata: { image_url: uri },
      created_at: new Date().toISOString(),
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
