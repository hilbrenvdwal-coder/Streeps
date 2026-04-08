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
  const [tallyCategoryCounts, setTallyCategoryCounts] = useState<Record<string, Record<number, number>>>({});
  const [credits, setCredits] = useState<Record<number, number>>({});
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
      const enrichedMembers = membersRes.data.map((m: any) => {
        if (m.is_active && m.last_seen) {
          const lastSeen = new Date(m.last_seen).getTime();
          const thirtyMinAgo = Date.now() - 30 * 60 * 1000;
          if (lastSeen < thirtyMinAgo) {
            return { ...m, is_active: false };
          }
        }
        return m;
      });
      setMembers(enrichedMembers as any);
      const me = enrichedMembers.find((m: any) => m.user_id === user.id);
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

      // Compute tallyCategoryCounts from tallies data
      const catCounts: Record<string, Record<number, number>> = {};
      talliesData.forEach((t: any) => {
        const uid = t.user_id as string;
        const cat = (t.category ?? 1) as number;
        if (!catCounts[uid]) catCounts[uid] = {};
        catCounts[uid][cat] = (catCounts[uid][cat] || 0) + 1;
      });
      setTallyCategoryCounts(catCounts);
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

    // Compute credits (empty for now — no credits table in database yet)
    setCredits({});

    setLoading(false);
  }, [user, groupId]);

  useEffect(() => {
    setLoading(true);
    setGroup(null);
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

  const addTally = async (category: number, count: number = 1) => {
    if (!user) return;

    const rows = Array.from({ length: count }, () => ({
      group_id: groupId,
      user_id: user.id,
      category,
      added_by: user.id,
    }));

    await supabase.from('tallies').insert(rows);
  };

  const toggleActive = async () => {
    if (!user) return;
    const me = members.find((m) => m.user_id === user.id);
    if (!me) return;

    const becomingActive = !me.is_active;

    if (becomingActive) {
      // Deactivate all other groups first
      await supabase
        .from('group_members')
        .update({ is_active: false })
        .eq('user_id', user.id)
        .neq('group_id', groupId);
    }

    await supabase
      .from('group_members')
      .update({ is_active: becomingActive, last_seen: new Date().toISOString() })
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
    await fetchAll();
  };

  const removeDrink = async (drinkId: string) => {
    if (!user) return;
    await supabase
      .from('drinks')
      .update({ is_available: false })
      .eq('id', drinkId);
    await fetchAll();
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

  const addTallyForMember = async (userId: string, drinkId: string) => {
    if (!user) return;
    // Find the drink to get its category
    const drink = drinks.find((d) => d.id === drinkId);
    if (!drink) return;

    await supabase.from('tallies').insert({
      group_id: groupId,
      user_id: userId,
      category: drink.category,
      added_by: user.id,
    });
  };

  const activateMe = async () => {
    if (!user) return;

    // Deactivate all other groups first
    await supabase
      .from('group_members')
      .update({ is_active: false })
      .eq('user_id', user.id)
      .neq('group_id', groupId);

    // Activate in this group
    await supabase
      .from('group_members')
      .update({ is_active: true, last_seen: new Date().toISOString() })
      .eq('group_id', groupId)
      .eq('user_id', user.id);
  };

  const removeOwnAdmin = async () => {
    if (!user) return;
    await supabase
      .from('group_members')
      .update({ is_admin: false })
      .eq('group_id', groupId)
      .eq('user_id', user.id);
  };

  return {
    group,
    members,
    drinks,
    tallyCounts,
    tallyCategoryCounts,
    recentTallies,
    credits,
    loading,
    isAdmin,
    addTally,
    addTallyForMember,
    activateMe,
    removeOwnAdmin,
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
