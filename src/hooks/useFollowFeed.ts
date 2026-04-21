import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { groupTalliesByBucket } from '../utils/timeBucket';
import { useLiveWindow } from './useLiveWindow';

/**
 * useFollowFeed — één hook die alles aandrijft voor de Explore-feed:
 *   - Gebucketed feed (per ochtend/middag/avond slot) van tallies in groepen
 *     die de user volgt (member + explicit follow).
 *   - Suggestie-lijst van max 4 groepen waar vrienden inzitten.
 *   - `liveGroupIds`: set van groepen met een tally < LIVE_WINDOW_MS geleden,
 *     herberekend wanneer de useLiveWindow-tick tikt.
 *
 * Realtime:
 *   - `tallies`        → debounced refetch (5s) — tally-events zijn een firehose.
 *   - `group_follows`  (own rows) → direct refetch.
 *   - `group_members`  (own rows) → direct refetch.
 *
 * useId() zorgt voor een unieke channel-naam per instance, zodat
 * meerdere hook-instances naast elkaar (bv. verschillende tab-mounts)
 * niet dezelfde realtime channel delen.
 */

// Een groep is "live" wanneer er een tally < deze window bestaat.
const LIVE_WINDOW_MS = 10 * 60 * 1000; // 10 minuten

// Debounce voor realtime tally-events.
const TALLY_REFETCH_DEBOUNCE_MS = 5000;

// ─── Public types ─────────────────────────────────────────────────────────────

export interface FeedBucketItem {
  groupId: string;
  groupName: string;
  groupAvatarUrl: string | null;
  isLive: boolean;
  drinkCounts: Array<{ emoji: string; count: number; drinkId?: string }>;
}

export interface FeedBucket {
  key: string;
  label: string;
  items: FeedBucketItem[];
}

export interface GroupSuggestion {
  groupId: string;
  name: string;
  avatarUrl: string | null;
  memberCount: number;
  lastActivityAt: string | null;
  friendNames: string[];
  friendCount: number;
  friendsRelation: 'member' | 'follower' | 'mixed';
}

// ─── RPC row types ────────────────────────────────────────────────────────────

interface FeedRow {
  group_id: string;
  group_name: string;
  group_avatar_url: string | null;
  drink_id: string | null;
  drink_emoji: string | null;
  drink_name: string | null;
  created_at: string;
}

interface SuggestionRow {
  group_id: string;
  group_name: string;
  group_avatar_url: string | null;
  member_count: number;
  last_activity_at: string | null;
  friend_names: string[] | null;
  friend_count: number;
  friends_relation: 'member' | 'follower' | 'mixed';
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useFollowFeed() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const instanceId = useId();

  // Raw feed rows — bucketing gebeurt client-side in useMemo (zodat een
  // live-window tick niet opnieuw hoeft te fetchen om LIVE-state te herrekenen).
  const [feedRows, setFeedRows] = useState<FeedRow[]>([]);
  const [suggestions, setSuggestions] = useState<GroupSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Live-window tick: Date.now() die elke 30s update. We gebruiken hem
  // alleen om liveGroupIds te herrekenen.
  const nowMs = useLiveWindow();

  // Track de nieuwste in-flight fetch.
  const fetchSeqRef = useRef(0);
  // Debounce voor tally-refetches.
  const tallyRefetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchAll = useCallback(async () => {
    if (!userId) {
      setFeedRows([]);
      setSuggestions([]);
      setLoading(false);
      return;
    }

    const seq = ++fetchSeqRef.current;

    try {
      const [feedRes, suggRes] = await Promise.all([
        supabase.rpc('get_follow_feed', { p_days_back: 9 }),
        supabase.rpc('get_group_suggestions', { p_limit: 4 }),
      ]);

      if (feedRes.error) throw feedRes.error;
      // Suggestions depends on friendships table — don't fail the whole hook
      // if it errors; just show an empty suggestions list.
      if (suggRes.error) {
        console.warn('[useFollowFeed] suggestions error:', suggRes.error.message);
      }

      const rawFeed = (feedRes.data ?? []) as FeedRow[];
      const rawSugg = (suggRes.error ? [] : (suggRes.data ?? [])) as SuggestionRow[];

      const mappedSugg: GroupSuggestion[] = rawSugg.map((r) => ({
        groupId: r.group_id,
        name: r.group_name,
        avatarUrl: r.group_avatar_url,
        memberCount: r.member_count,
        lastActivityAt: r.last_activity_at,
        friendNames: r.friend_names ?? [],
        friendCount: r.friend_count,
        friendsRelation: r.friends_relation,
      }));

      if (seq !== fetchSeqRef.current) return;

      setFeedRows(rawFeed);
      setSuggestions(mappedSugg);
      setError(null);
      setLoading(false);
    } catch (e: any) {
      if (seq !== fetchSeqRef.current) return;
      console.error('[useFollowFeed] fetch failed:', e?.message ?? e);
      setError(e instanceof Error ? e : new Error(String(e)));
      setLoading(false);
    }
  }, [userId]);

  // Debounced refetch voor tally-events (firehose).
  const scheduleTallyRefetch = useCallback(() => {
    if (tallyRefetchTimerRef.current) return;
    tallyRefetchTimerRef.current = setTimeout(() => {
      tallyRefetchTimerRef.current = null;
      fetchAll();
    }, TALLY_REFETCH_DEBOUNCE_MS);
  }, [fetchAll]);

  useEffect(() => {
    setLoading(true);
    fetchAll();

    if (!userId) return;

    const channel = supabase
      .channel(`follow_feed:user:${userId}:${instanceId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'group_follows',
        filter: `user_id=eq.${userId}`,
      }, () => fetchAll())
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'group_members',
        filter: `user_id=eq.${userId}`,
      }, () => fetchAll())
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tallies',
      }, () => scheduleTallyRefetch())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (tallyRefetchTimerRef.current) {
        clearTimeout(tallyRefetchTimerRef.current);
        tallyRefetchTimerRef.current = null;
      }
    };
  }, [userId, instanceId, fetchAll, scheduleTallyRefetch]);

  // ─── Afgeleide waarden ──────────────────────────────────────────────────────

  // `liveGroupIds`: groepen waarvan de nieuwste tally binnen LIVE_WINDOW_MS valt.
  // Afhankelijk van nowMs zodat het terug-tikt naar "niet live" wanneer de
  // useLiveWindow-tick dat suggereert.
  const liveGroupIds = useMemo<Set<string>>(() => {
    const latestByGroup = new Map<string, number>();
    for (const row of feedRows) {
      const ts = new Date(row.created_at).getTime();
      const prev = latestByGroup.get(row.group_id);
      if (prev === undefined || ts > prev) {
        latestByGroup.set(row.group_id, ts);
      }
    }
    const liveCutoff = nowMs - LIVE_WINDOW_MS;
    const s = new Set<string>();
    for (const [groupId, ts] of latestByGroup) {
      if (ts >= liveCutoff) s.add(groupId);
    }
    return s;
  }, [feedRows, nowMs]);

  const buckets = useMemo<FeedBucket[]>(() => {
    if (feedRows.length === 0) return [];

    // Stap 1: classificeer alle tallies → {bucket, items[]}
    const bucketed = groupTalliesByBucket(feedRows, new Date(nowMs));

    // Stap 2: binnen elke bucket, aggregeer per group_id:
    //   - groupName + avatarUrl (van eerste tally — identiek per group_id)
    //   - emoji-tellingen, gesorteerd desc op count
    //   - isLive: of deze group in liveGroupIds zit
    const out: FeedBucket[] = bucketed.map(({ bucket, items }) => {
      type GroupAgg = {
        groupId: string;
        groupName: string;
        groupAvatarUrl: string | null;
        counts: Map<string, { emoji: string; count: number; drinkId?: string }>;
      };
      const byGroup = new Map<string, GroupAgg>();
      for (const row of items) {
        let g = byGroup.get(row.group_id);
        if (!g) {
          g = {
            groupId: row.group_id,
            groupName: row.group_name,
            groupAvatarUrl: row.group_avatar_url,
            counts: new Map(),
          };
          byGroup.set(row.group_id, g);
        }
        // Skip tallies waarbij de drink is verwijderd (LEFT JOIN → null).
        const emoji = row.drink_emoji ?? '';
        if (!emoji) continue;
        const key = row.drink_id ?? emoji; // fallback op emoji als drink_id null
        const existing = g.counts.get(key);
        if (existing) {
          existing.count += 1;
        } else {
          g.counts.set(key, {
            emoji,
            count: 1,
            drinkId: row.drink_id ?? undefined,
          });
        }
      }

      const bucketItems: FeedBucketItem[] = Array.from(byGroup.values()).map((g) => ({
        groupId: g.groupId,
        groupName: g.groupName,
        groupAvatarUrl: g.groupAvatarUrl,
        isLive: liveGroupIds.has(g.groupId),
        drinkCounts: Array.from(g.counts.values()).sort((a, b) => b.count - a.count),
      }));

      return {
        key: bucket.key,
        label: bucket.label,
        items: bucketItems,
      };
    });

    // groupTalliesByBucket sorteert al desc op bucketStart; we houden die volgorde.
    return out;
  }, [feedRows, liveGroupIds, nowMs]);

  // Optimistic remove van een suggestie — roep aan na een succesvolle follow.
  const removeSuggestion = useCallback((groupId: string) => {
    setSuggestions((prev) => prev.filter((s) => s.groupId !== groupId));
  }, []);

  return {
    buckets,
    suggestions,
    liveGroupIds,
    loading,
    error,
    refresh: fetchAll,
    removeSuggestion,
  };
}
