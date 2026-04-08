import { supabase } from '../lib/supabase';

type CachedConversation = {
  messages: any[];
  oldestCursor: string | null;
  hasMore: boolean;
  loadedAt: number;
  profileCache: Record<string, any>;
};

const preloadCache = new Map<string, CachedConversation>();
const pendingLoads = new Set<string>();
const unloadTimers = new Map<string, NodeJS.Timeout>();

const PRELOAD_PAGE_SIZE = 20;
const CACHE_TTL_MS = 5 * 60 * 1000;
const UNLOAD_DELAY_MS = 30_000;

export function getPreloadedMessages(convId: string): CachedConversation | null {
  const cached = preloadCache.get(convId);
  if (!cached) return null;
  if (Date.now() - cached.loadedAt > CACHE_TTL_MS) {
    preloadCache.delete(convId);
    return null;
  }
  return cached;
}

export async function preloadConversation(convId: string): Promise<void> {
  if (pendingLoads.has(convId)) return;
  const existing = preloadCache.get(convId);
  if (existing && Date.now() - existing.loadedAt < CACHE_TTL_MS) return;

  pendingLoads.add(convId);
  try {
    const { data: messages } = await supabase
      .from('messages')
      .select('*, profiles:user_id(id, full_name, avatar_url)')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: false })
      .limit(PRELOAD_PAGE_SIZE);

    if (messages) {
      const profileCache: Record<string, any> = {};
      messages.forEach((m: any) => {
        if (m.profiles) profileCache[m.user_id] = m.profiles;
      });

      preloadCache.set(convId, {
        messages: messages.reverse(),
        oldestCursor: messages.length > 0 ? messages[0].created_at : null,
        hasMore: messages.length >= PRELOAD_PAGE_SIZE,
        loadedAt: Date.now(),
        profileCache,
      });
    }
  } finally {
    pendingLoads.delete(convId);
  }
}

export function scheduleUnload(convId: string): void {
  const existing = unloadTimers.get(convId);
  if (existing) clearTimeout(existing);
  unloadTimers.set(convId, setTimeout(() => {
    preloadCache.delete(convId);
    unloadTimers.delete(convId);
  }, UNLOAD_DELAY_MS));
}

export function cancelUnload(convId: string): void {
  const timer = unloadTimers.get(convId);
  if (timer) {
    clearTimeout(timer);
    unloadTimers.delete(convId);
  }
}

export function updateCacheWithNewMessage(convId: string, message: any): void {
  const cached = preloadCache.get(convId);
  if (cached) {
    cached.messages.push(message);
    cached.loadedAt = Date.now();
  }
}

export function invalidateCache(convId: string): void {
  preloadCache.delete(convId);
}
