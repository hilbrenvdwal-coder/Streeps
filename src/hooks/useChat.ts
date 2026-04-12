import { useState, useEffect, useCallback, useRef } from 'react';
import { InteractionManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
  last_tally_at: string | null;
  unread: number;
}

export function useConversations() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: conversations = [], isLoading, refetch } = useQuery<ConversationPreview[]>({
    queryKey: ['chats', user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return [];

      // Ensure all user's groups have a group chat (one-time per session)
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

      // Single round-trip: get all chats + top N messages per chat
      const { data, error } = await supabase.rpc('get_preloaded_chats', { p_messages_per_chat: 20 });
      if (error) throw error;

      const chats = ((data as any[]) || []) as (ConversationPreview & { messages: any[] })[];

      // Seed the existing preload cache so opening a chat is instant
      try {
        const { seedPreloadCache } = await import('./useMessagePreloadCache');
        chats.forEach((c) => {
          if (c.messages && c.messages.length > 0) {
            seedPreloadCache(c.id, c.messages);
          }
        });
      } catch {
        // seedPreloadCache may not exist yet — that's fine for now
      }

      // Strip messages from the returned shape so the list stays lightweight
      return chats.map(({ messages, ...rest }) => rest);
    },
  });

  // Realtime: invalidate on new messages
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('chat-updates')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
        queryClient.invalidateQueries({ queryKey: ['chats', user.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, queryClient]);

  const markAsRead = useCallback(async (conversationId: string) => {
    queryClient.setQueryData<ConversationPreview[]>(['chats', user?.id], (prev) =>
      (prev || []).map((c) => c.id === conversationId ? { ...c, unread: 0 } : c)
    );
    if (user) {
      await supabase.from('conversation_members')
        .update({ last_read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id);
    }
  }, [user, queryClient]);

  return {
    conversations,
    loading: isLoading,
    refresh: refetch,
    markAsRead,
  };
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
      // Skip AsyncStorage fallback — preload cache already populated
    } else {
      // Step 1: Show cached messages instantly (AsyncStorage fallback, only if no preload hit)
      const cached = await loadCache(conversationId);
      if (cached && cached.messages.length > 0) {
        setMessages(cached.messages);
        oldestCursorRef.current = cached.oldestCursor;
        hasMoreRef.current = cached.hasMore;
        setHasMore(cached.hasMore);
        setLoading(false);
        cached.messages.forEach((m: any) => { if (m.profile) profileCacheRef.current[m.user_id] = m.profile; });
      }
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

    // Merge: keep any optimistic temp messages that don't yet have a server
    // equivalent, otherwise the server overwrite would flash them away.
    setMessages((prev) => {
      const temps = prev.filter((m) => typeof m.id === 'string' && m.id.startsWith('temp-'));
      const survivingTemps = temps.filter(
        (t) => !enriched.some((m: any) => m.user_id === t.user_id && m.content === t.content)
      );
      return [...survivingTemps, ...enriched];
    });
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
