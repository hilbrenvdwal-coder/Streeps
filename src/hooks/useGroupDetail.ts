import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Group, GroupMember, Drink, Profile } from '../types/database';

export function useGroupDetail(groupId: string) {
  const { user } = useAuth();
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<(GroupMember & { profile: Profile })[]>([]);
  const [drinks, setDrinks] = useState<Drink[]>([]);
  const [tallyCounts, setTallyCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!user || !groupId) return;

    const [groupRes, membersRes, drinksRes] = await Promise.all([
      supabase.from('groups').select('*').eq('id', groupId).single(),
      supabase
        .from('group_members')
        .select('*, profile:profiles(*)')
        .eq('group_id', groupId),
      supabase
        .from('drinks')
        .select('*')
        .eq('group_id', groupId)
        .eq('is_available', true)
        .order('category', { ascending: true }),
    ]);

    if (groupRes.data) setGroup(groupRes.data);
    if (membersRes.data) {
      setMembers(membersRes.data as any);
      const me = membersRes.data.find((m: any) => m.user_id === user.id);
      setIsAdmin(me?.is_admin ?? false);
    }
    if (drinksRes.data) setDrinks(drinksRes.data as any);

    // Get tally counts per member
    if (membersRes.data) {
      const counts: Record<string, number> = {};
      await Promise.all(
        membersRes.data.map(async (member: any) => {
          const { count } = await supabase
            .from('tallies')
            .select('id', { count: 'exact', head: true })
            .eq('group_id', groupId)
            .eq('user_id', member.user_id)
            .eq('removed', false);
          counts[member.user_id] = count ?? 0;
        })
      );
      setTallyCounts(counts);
    }

    setLoading(false);
  }, [user, groupId]);

  useEffect(() => {
    fetchAll();

    // Subscribe to realtime changes
    const talliesChannel = supabase
      .channel(`tallies:${groupId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tallies',
        filter: `group_id=eq.${groupId}`,
      }, () => fetchAll())
      .subscribe();

    const membersChannel = supabase
      .channel(`members:${groupId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'group_members',
        filter: `group_id=eq.${groupId}`,
      }, () => fetchAll())
      .subscribe();

    return () => {
      supabase.removeChannel(talliesChannel);
      supabase.removeChannel(membersChannel);
    };
  }, [fetchAll]);

  const addTally = async (drinkId: string, forUserId?: string) => {
    if (!user) return;
    const targetUserId = forUserId ?? user.id;

    await supabase.from('tallies').insert({
      group_id: groupId,
      user_id: targetUserId,
      drink_id: drinkId,
      added_by: user.id,
    });
  };

  const toggleActive = async () => {
    if (!user) return;
    const me = members.find((m) => m.user_id === user.id);
    if (!me) return;

    await supabase
      .from('group_members')
      .update({ is_active: !me.is_active })
      .eq('group_id', groupId)
      .eq('user_id', user.id);
  };

  return {
    group,
    members,
    drinks,
    tallyCounts,
    loading,
    isAdmin,
    addTally,
    toggleActive,
    refresh: fetchAll,
  };
}
