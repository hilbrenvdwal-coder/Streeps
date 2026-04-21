import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

/**
 * Represents a group the current user "follows" in the feed sense.
 *
 * Follow-semantics:
 *   - Being a group member automatically counts as "following" that group.
 *   - Additionally, rows in `group_follows(user_id, group_id)` make a group
 *     followed explicitly — typically used for groups the user is NOT a
 *     member of (e.g. friend groups).
 *
 * `followedGroups` is the UNION of both, deduplicated on group id, sorted by
 * last activity desc.
 */
export interface FollowedGroup {
  id: string;
  name: string;
  avatarUrl: string | null;
  /** True if the user is a member of the group (auto-follow via membership). */
  isMember: boolean;
  /** True if an explicit row exists in `group_follows` for this user+group. */
  isExplicitFollow: boolean;
  memberCount: number;
  lastActivityAt: string | null;
}

// How often we allow a tally-driven refetch to run (ms).
const TALLY_REFETCH_DEBOUNCE_MS = 5000;

interface GroupRow {
  id: string;
  name: string;
  avatar_url: string | null;
}

interface JoinedGroupRow {
  group_id: string;
  groups: GroupRow | GroupRow[] | null;
}

// Normalise the `groups(...)` join which Supabase returns as either an object
// or (rarely) an array depending on the PostgREST response shape.
function pickGroup(groups: GroupRow | GroupRow[] | null | undefined): GroupRow | null {
  if (!groups) return null;
  if (Array.isArray(groups)) return groups[0] ?? null;
  return groups;
}

export function useFollows() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [followedGroups, setFollowedGroups] = useState<FollowedGroup[]>([]);
  const [explicitFollowIds, setExplicitFollowIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Track the latest in-flight fetch so we can ignore stale responses.
  const fetchSeqRef = useRef(0);
  // Debounce timer for tally-driven refetches.
  const tallyRefetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchAll = useCallback(async () => {
    if (!userId) {
      setFollowedGroups([]);
      setExplicitFollowIds(new Set());
      setLoading(false);
      return;
    }

    const seq = ++fetchSeqRef.current;

    try {
      // ---- Query A: own member groups ----
      const membersPromise = supabase
        .from('group_members')
        .select('group_id, groups(id, name, avatar_url)')
        .eq('user_id', userId);

      // ---- Query B: own explicit follows ----
      const followsPromise = supabase
        .from('group_follows')
        .select('group_id, groups(id, name, avatar_url)')
        .eq('user_id', userId);

      const [membersRes, followsRes] = await Promise.all([membersPromise, followsPromise]);

      if (membersRes.error) {
        // A failure here is fatal — members are the primary source of truth.
        throw membersRes.error;
      }

      // `group_follows` may not yet exist in every environment (Feed Batch A
      // is a separate deploy). Treat a missing-table error as "no follows"
      // instead of crashing the hook.
      const followsRows: JoinedGroupRow[] = followsRes.error ? [] : ((followsRes.data ?? []) as JoinedGroupRow[]);
      const membersRows: JoinedGroupRow[] = (membersRes.data ?? []) as JoinedGroupRow[];

      const memberGroupIds = new Set<string>();
      const explicitIds = new Set<string>();
      const groupMap = new Map<string, GroupRow>();

      for (const row of membersRows) {
        const g = pickGroup(row.groups);
        if (!g) continue;
        memberGroupIds.add(g.id);
        groupMap.set(g.id, g);
      }
      for (const row of followsRows) {
        const g = pickGroup(row.groups);
        if (!g) continue;
        explicitIds.add(g.id);
        // Don't overwrite an existing entry — identical either way.
        if (!groupMap.has(g.id)) groupMap.set(g.id, g);
      }

      const allGroupIds = Array.from(groupMap.keys());

      // Short-circuit: no groups to enrich.
      if (allGroupIds.length === 0) {
        if (seq !== fetchSeqRef.current) return;
        setFollowedGroups([]);
        setExplicitFollowIds(explicitIds);
        setError(null);
        setLoading(false);
        return;
      }

      // ---- Batch enrichment: member count + last activity ----
      // One query for all member rows across the relevant groups, one query
      // for the most-recent-tally timestamp per group. We aggregate client-side
      // which keeps the RPC surface small and avoids N+1 round-trips.
      const [allMembersRes, recentTalliesRes] = await Promise.all([
        supabase
          .from('group_members')
          .select('group_id')
          .in('group_id', allGroupIds),
        supabase
          .from('tallies')
          .select('group_id, created_at')
          .in('group_id', allGroupIds)
          .eq('removed', false)
          .order('created_at', { ascending: false }),
      ]);

      const memberCounts = new Map<string, number>();
      if (!allMembersRes.error && allMembersRes.data) {
        for (const row of allMembersRes.data as { group_id: string }[]) {
          memberCounts.set(row.group_id, (memberCounts.get(row.group_id) ?? 0) + 1);
        }
      }

      // Because we ordered by created_at desc, the first hit per group wins.
      const lastActivity = new Map<string, string>();
      if (!recentTalliesRes.error && recentTalliesRes.data) {
        for (const row of recentTalliesRes.data as { group_id: string; created_at: string }[]) {
          if (!lastActivity.has(row.group_id)) {
            lastActivity.set(row.group_id, row.created_at);
          }
        }
      }

      const enriched: FollowedGroup[] = allGroupIds.map((id) => {
        const g = groupMap.get(id)!;
        return {
          id: g.id,
          name: g.name,
          avatarUrl: g.avatar_url ?? null,
          isMember: memberGroupIds.has(id),
          isExplicitFollow: explicitIds.has(id),
          memberCount: memberCounts.get(id) ?? 0,
          lastActivityAt: lastActivity.get(id) ?? null,
        };
      });

      // Sort by last activity desc, nulls last, then by name for stability.
      enriched.sort((a, b) => {
        const aTs = a.lastActivityAt;
        const bTs = b.lastActivityAt;
        if (aTs && bTs) {
          if (aTs === bTs) return a.name.localeCompare(b.name);
          return aTs < bTs ? 1 : -1;
        }
        if (aTs) return -1;
        if (bTs) return 1;
        return a.name.localeCompare(b.name);
      });

      // Only commit if we're still the latest in-flight fetch.
      if (seq !== fetchSeqRef.current) return;

      setFollowedGroups(enriched);
      setExplicitFollowIds(explicitIds);
      setError(null);
      setLoading(false);
    } catch (e: any) {
      if (seq !== fetchSeqRef.current) return;
      console.error('[useFollows] fetch failed:', e?.message ?? e);
      setError(e instanceof Error ? e : new Error(String(e)));
      setLoading(false);
    }
  }, [userId]);

  // Debounced version for realtime tally events — tallies can fire dozens of
  // times in a burst, we only care about ~refreshing last_activity every 5s.
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

    // All .on() calls must be chained BEFORE .subscribe() — Supabase Realtime
    // does not allow adding postgres_changes callbacks after subscribe().
    // We consolidate all three tables onto one channel to avoid any risk of
    // channel-name reuse across effect re-runs (e.g. StrictMode double-mount).
    const channel = supabase
      .channel(`follows:user:${userId}`)
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
      // Tally events are a firehose; debounce to avoid rerender storms.
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
  }, [userId, fetchAll, scheduleTallyRefetch]);

  // ---- Mutations ----

  const follow = useCallback(async (groupId: string): Promise<void> => {
    if (!userId) throw new Error('Niet ingelogd');

    // Capture rollback state.
    const prevExplicit = explicitFollowIds;
    const prevGroups = followedGroups;

    // Optimistic: update explicit set + mark the group in the list.
    const nextExplicit = new Set(prevExplicit);
    nextExplicit.add(groupId);
    setExplicitFollowIds(nextExplicit);

    const existingIdx = prevGroups.findIndex((g) => g.id === groupId);
    if (existingIdx >= 0) {
      const copy = prevGroups.slice();
      copy[existingIdx] = { ...copy[existingIdx], isExplicitFollow: true };
      setFollowedGroups(copy);
    }

    const { error: insertError } = await supabase
      .from('group_follows')
      .insert({ user_id: userId, group_id: groupId });

    if (insertError) {
      // 23505 = unique_violation → already following, which is fine.
      const code = (insertError as any).code;
      if (code !== '23505') {
        setExplicitFollowIds(prevExplicit);
        setFollowedGroups(prevGroups);
        throw insertError;
      }
    }

    // Refresh to pick up the group metadata for freshly-followed non-member groups.
    await fetchAll();
  }, [userId, explicitFollowIds, followedGroups, fetchAll]);

  const unfollow = useCallback(async (groupId: string): Promise<void> => {
    if (!userId) throw new Error('Niet ingelogd');

    const prevExplicit = explicitFollowIds;
    const prevGroups = followedGroups;

    const nextExplicit = new Set(prevExplicit);
    nextExplicit.delete(groupId);
    setExplicitFollowIds(nextExplicit);

    const targetIdx = prevGroups.findIndex((g) => g.id === groupId);
    if (targetIdx >= 0) {
      const target = prevGroups[targetIdx];
      if (target.isMember) {
        // Still followed via membership — just flip the explicit flag.
        const copy = prevGroups.slice();
        copy[targetIdx] = { ...copy[targetIdx], isExplicitFollow: false };
        setFollowedGroups(copy);
      } else {
        // No membership — remove from the list entirely.
        setFollowedGroups(prevGroups.filter((g) => g.id !== groupId));
      }
    }

    const { error: deleteError } = await supabase
      .from('group_follows')
      .delete()
      .match({ user_id: userId, group_id: groupId });

    if (deleteError) {
      setExplicitFollowIds(prevExplicit);
      setFollowedGroups(prevGroups);
      throw deleteError;
    }

    // No forced refetch — realtime + optimistic state already converge, and a
    // refetch would race with rapid toggle-on-toggle-off sequences.
  }, [userId, explicitFollowIds, followedGroups]);

  const memberGroupIdSet = useMemo(
    () => new Set(followedGroups.filter((g) => g.isMember).map((g) => g.id)),
    [followedGroups],
  );

  const isFollowing = useCallback(
    (groupId: string) => memberGroupIdSet.has(groupId) || explicitFollowIds.has(groupId),
    [memberGroupIdSet, explicitFollowIds],
  );

  const isExplicitFollower = useCallback(
    (groupId: string) => explicitFollowIds.has(groupId),
    [explicitFollowIds],
  );

  return {
    followedGroups,
    explicitFollowIds,
    loading,
    error,
    follow,
    unfollow,
    isFollowing,
    isExplicitFollower,
    refresh: fetchAll,
  };
}
