import { useRef, useCallback } from 'react';
import { supabase } from '@/src/lib/supabase';
import * as db from '@/src/lib/db';

const PREFETCH_THRESHOLD = 15;
const PREFETCH_PAGE_SIZE = 30;

/**
 * Hook that prefetches messages for visible conversations in the list.
 * When a conversation becomes visible, checks if SQLite already has enough
 * messages cached. If not, fetches from Supabase and stores in SQLite.
 */
export function usePrefetchMessages() {
  const prefetchedRef = useRef(new Set<string>());
  const inFlightRef = useRef(new Set<string>());

  const onViewableItemsChanged = useCallback(
    ({ changed }: { viewableItems: any[]; changed: any[] }) => {
      changed.forEach((token: any) => {
        const convId = token.item?.id;
        if (!convId || !token.isViewable) return;
        if (prefetchedRef.current.has(convId)) return;
        if (inFlightRef.current.has(convId)) return;

        prefetchedRef.current.add(convId);
        prefetchConversation(convId, inFlightRef.current);
      });
    },
    [],
  );

  return { onViewableItemsChanged };
}

async function prefetchConversation(convId: string, inFlight: Set<string>): Promise<void> {
  try {
    // Check if we already have enough messages locally
    const count = db.getMessageCount(convId);
    if (count >= PREFETCH_THRESHOLD) return;

    inFlight.add(convId);

    // Fetch messages from Supabase
    const { data: messages } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: false })
      .limit(PREFETCH_PAGE_SIZE);

    if (!messages || messages.length === 0) return;

    // Fetch profiles for these messages
    const userIds = [...new Set(messages.map((m) => m.user_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', userIds);

    if (profiles && profiles.length > 0) {
      db.upsertProfiles(profiles);
    }

    // Store messages in SQLite
    db.insertMessages(messages);
  } catch (e) {
    console.error('[prefetch] Failed for conversation:', convId, e);
  } finally {
    inFlight.delete(convId);
  }
}
