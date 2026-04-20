import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { getOrCreateGroupChat } from './useChat';
import type { Group } from '../types/database';

interface GroupWithStats extends Group {
  member_count: number;
  my_tally_count: number;
  is_active: boolean;
  avatar_url: string | null;
  last_tally_at: string | null;
}

export function useGroups() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<GroupWithStats[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchGroups = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('groups')
      .select(`
        *,
        group_members!inner(user_id, is_active)
      `)
      .eq('group_members.user_id', user.id);

    if (error || !data) {
      console.error('Error fetching groups:', error);
      setLoading(false);
      return;
    }

    // For each group, get member count and my tally count
    const groupsWithStats = await Promise.all(
      data.map(async (group: any) => {
        const [membersRes, talliesRes, lastTallyRes] = await Promise.all([
          supabase
            .from('group_members')
            .select('id', { count: 'exact', head: true })
            .eq('group_id', group.id),
          supabase
            .from('tallies')
            .select('id', { count: 'exact', head: true })
            .eq('group_id', group.id)
            .eq('user_id', user.id)
            .eq('removed', false),
          supabase
            .from('tallies')
            .select('created_at')
            .eq('group_id', group.id)
            .eq('removed', false)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

        const myMembership = Array.isArray(group.group_members) ? group.group_members[0] : null;
        return {
          ...group,
          group_members: undefined,
          member_count: membersRes.count ?? 0,
          my_tally_count: talliesRes.count ?? 0,
          is_active: myMembership?.is_active ?? false,
          last_tally_at: lastTallyRes.data?.created_at ?? null,
        } as GroupWithStats;
      })
    );

    setGroups(groupsWithStats);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchGroups();

    if (!user) return;

    // Subscribe to all group_members changes (catches active status updates across groups)
    const membersChannel = supabase
      .channel('my-memberships')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'group_members',
      }, () => fetchGroups())
      .subscribe();

    // Subscribe to group updates (name, avatar changes)
    const groupsChannel = supabase
      .channel('my-groups')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'groups',
      }, () => fetchGroups())
      .subscribe();

    return () => {
      supabase.removeChannel(membersChannel);
      supabase.removeChannel(groupsChannel);
    };
  }, [fetchGroups, user]);

  const createGroup = async (name: string) => {
    if (!user) return null;

    // Create the group
    const { data: group, error } = await supabase
      .from('groups')
      .insert({ name, created_by: user.id, drinks_as_categories: true })
      .select()
      .single();

    if (error || !group) {
      console.error('Error creating group:', error?.message, error?.details, error?.hint);
      return { error: error?.message ?? 'Groep aanmaken mislukt' };
    }

    // Add creator as admin member
    const { error: memberError } = await supabase.from('group_members').insert({
      group_id: group.id,
      user_id: user.id,
      is_admin: true,
    });
    if (memberError) {
      console.error('Error adding member:', memberError.message);
      return { error: memberError.message };
    }

    // Add default drinks (with price_override since we default to drinks_as_categories mode)
    const { error: drinksError } = await supabase.from('drinks').insert([
      { group_id: group.id, name: 'Bier', category: 1, emoji: '🍺', price_override: 150 },
      { group_id: group.id, name: 'Wijn', category: 2, emoji: '🍷', price_override: 300 },
      { group_id: group.id, name: '0.0', category: 1, emoji: '🚗', price_override: 150 },
      { group_id: group.id, name: 'Fris', category: 1, emoji: '🥤', price_override: 150 },
      { group_id: group.id, name: 'Cocktail', category: 2, emoji: '🍸', price_override: 450 },
    ]);
    if (drinksError) {
      console.error('Error adding drinks:', drinksError.message);
    }

    // Auto-create group chat with creator as first member
    try {
      await getOrCreateGroupChat(group.id, [user.id]);
    } catch (e) {
      console.error('Error creating group chat:', e);
    }

    await fetchGroups();
    return { data: group, error: null };
  };

  const joinGroup = async (inviteCode: string) => {
    if (!user) return { error: 'Niet ingelogd' };

    // Find group by invite code
    const { data: group, error } = await supabase
      .from('groups')
      .select('id')
      .eq('invite_code', inviteCode.toLowerCase().trim())
      .single();

    if (error || !group) return { error: 'Groep niet gevonden' };

    // Check if already a member
    const { data: existing } = await supabase
      .from('group_members')
      .select('id')
      .eq('group_id', group.id)
      .eq('user_id', user.id)
      .single();

    if (existing) return { error: 'Je bent al lid van deze groep' };

    const { error: joinError } = await supabase.from('group_members').insert({
      group_id: group.id,
      user_id: user.id,
    });

    if (joinError) return { error: 'Kon niet deelnemen' };

    // Auto-add new member to group chat (RPC handles member insertion)
    try {
      await getOrCreateGroupChat(group.id, [user.id]);
    } catch (e) {
      console.error('Error joining group chat:', e);
    }

    await fetchGroups();
    return { error: null };
  };

  return { groups, loading, createGroup, joinGroup, refresh: fetchGroups };
}
