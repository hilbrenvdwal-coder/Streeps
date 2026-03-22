import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Group, GroupMember, Drink, Tally, Profile } from '../types/database';

interface TallyWithDetails extends Tally {
  user_name: string;
}

export function useGroupDetail(groupId: string) {
  const { user } = useAuth();
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<(GroupMember & { profile: Profile })[]>([]);
  const [drinks, setDrinks] = useState<Drink[]>([]);
  const [tallyCounts, setTallyCounts] = useState<Record<string, number>>({});
  const [recentTallies, setRecentTallies] = useState<TallyWithDetails[]>([]);
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

    // Get recent tallies
    const { data: talliesData } = await supabase
      .from('tallies')
      .select('*, profile:profiles!tallies_user_id_fkey(full_name)')
      .eq('group_id', groupId)
      .eq('removed', false)
      .is('settlement_id', null)
      .order('created_at', { ascending: false })
      .limit(50);

    if (talliesData) {
      setRecentTallies(talliesData.map((t: any) => ({
        ...t,
        user_name: t.profile?.full_name ?? 'Onbekend',
      })));
    }

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
            .eq('removed', false)
            .is('settlement_id', null);
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

    const drinksChannel = supabase
      .channel(`drinks:${groupId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'drinks',
        filter: `group_id=eq.${groupId}`,
      }, () => fetchAll())
      .subscribe();

    const groupChannel = supabase
      .channel(`group:${groupId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'groups',
        filter: `id=eq.${groupId}`,
      }, () => fetchAll())
      .subscribe();

    return () => {
      supabase.removeChannel(talliesChannel);
      supabase.removeChannel(membersChannel);
      supabase.removeChannel(drinksChannel);
      supabase.removeChannel(groupChannel);
    };
  }, [fetchAll]);

  const addTally = async (category: number) => {
    if (!user) return;

    await supabase.from('tallies').insert({
      group_id: groupId,
      user_id: user.id,
      category,
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

  const removeTally = async (tallyId: string) => {
    if (!user) return;
    await supabase
      .from('tallies')
      .update({ removed: true, removed_by: user.id, removed_at: new Date().toISOString() })
      .eq('id', tallyId);
  };

  const toggleAdmin = async (userId: string) => {
    if (!user) return;
    const member = members.find((m) => m.user_id === userId);
    if (!member) return;
    await supabase
      .from('group_members')
      .update({ is_admin: !member.is_admin })
      .eq('group_id', groupId)
      .eq('user_id', userId);
  };

  const removeMember = async (userId: string) => {
    if (!user) return;
    await supabase
      .from('group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', userId);
  };

  const updateGroupPrices = async (data: Record<string, any>) => {
    if (!user) return;
    await supabase
      .from('groups')
      .update(data)
      .eq('id', groupId);
  };

  const addDrink = async (name: string, category: number, emoji: string) => {
    if (!user) return;
    await supabase.from('drinks').insert({
      group_id: groupId,
      name,
      category,
      emoji,
    });
  };

  const removeDrink = async (drinkId: string) => {
    if (!user) return;
    await supabase
      .from('drinks')
      .update({ is_available: false })
      .eq('id', drinkId);
  };

  const updateGroupName = async (name: string) => {
    if (!user) return;
    await supabase
      .from('groups')
      .update({ name })
      .eq('id', groupId);
  };

  const deleteGroup = async () => {
    if (!user) return;
    // Delete in order: tallies, drinks, settlements lines, settlements, members, group
    await supabase.from('tallies').delete().eq('group_id', groupId);
    await supabase.from('drinks').delete().eq('group_id', groupId);
    const { data: settlements } = await supabase.from('settlements').select('id').eq('group_id', groupId);
    if (settlements && settlements.length > 0) {
      const ids = settlements.map((s: any) => s.id);
      await supabase.from('settlement_lines').delete().in('settlement_id', ids);
      await supabase.from('settlements').delete().eq('group_id', groupId);
    }
    await supabase.from('group_members').delete().eq('group_id', groupId);
    await supabase.from('groups').delete().eq('id', groupId);
  };

  const leaveGroup = async () => {
    if (!user) return;
    await supabase
      .from('group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', user.id);
  };

  const regenerateInviteCode = async () => {
    if (!user) return;
    const newCode = Math.random().toString(36).substring(2, 10);
    await supabase
      .from('groups')
      .update({ invite_code: newCode })
      .eq('id', groupId);
  };

  return {
    group,
    members,
    drinks,
    tallyCounts,
    recentTallies,
    loading,
    isAdmin,
    addTally,
    toggleActive,
    removeTally,
    toggleAdmin,
    removeMember,
    updateGroupPrices,
    addDrink,
    removeDrink,
    updateGroupName,
    deleteGroup,
    leaveGroup,
    regenerateInviteCode,
    refresh: fetchAll,
  };
}
