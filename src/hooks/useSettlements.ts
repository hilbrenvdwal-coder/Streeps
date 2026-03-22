import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Group } from '../types/database';

interface UnsettledMember {
  user_id: string;
  full_name: string;
  counts: Record<number, number>; // category -> count
  amount: number; // total in cents
}

interface SettlementHistoryItem {
  id: string;
  total_amount: number;
  created_at: string;
  lines: {
    user_id: string;
    full_name: string;
    amount: number;
    tally_count_1: number;
    tally_count_2: number;
    tally_count_3: number;
    tally_count_4: number;
  }[];
}

export function useSettlements(groupId: string) {
  const { user } = useAuth();
  const [settling, setSettling] = useState(false);
  const [history, setHistory] = useState<SettlementHistoryItem[]>([]);

  const getUnsettledTallies = useCallback(async (group: Group) => {
    const { data: tallies } = await supabase
      .from('tallies')
      .select('user_id, category, profiles!tallies_user_id_fkey(full_name)')
      .eq('group_id', groupId)
      .eq('removed', false)
      .is('settlement_id', null);

    if (!tallies || tallies.length === 0) return [];

    // Group by user
    const memberMap: Record<string, UnsettledMember> = {};
    tallies.forEach((t: any) => {
      const uid = t.user_id;
      if (!memberMap[uid]) {
        memberMap[uid] = {
          user_id: uid,
          full_name: t.profiles?.full_name ?? 'Onbekend',
          counts: {},
          amount: 0,
        };
      }
      const cat = t.category ?? 1;
      memberMap[uid].counts[cat] = (memberMap[uid].counts[cat] || 0) + 1;
    });

    // Calculate amounts
    Object.values(memberMap).forEach((member) => {
      let total = 0;
      for (const [cat, count] of Object.entries(member.counts)) {
        const catNum = parseInt(cat);
        let price = 0;
        switch (catNum) {
          case 1: price = group.price_category_1; break;
          case 2: price = group.price_category_2; break;
          case 3: price = group.price_category_3 ?? 0; break;
          case 4: price = group.price_category_4 ?? 0; break;
        }
        total += count * price;
      }
      member.amount = total;
    });

    return Object.values(memberMap);
  }, [groupId]);

  const createSettlement = useCallback(async (group: Group, selectedUserIds: string[]) => {
    if (!user) return;
    setSettling(true);

    // Get all unsettled tallies for selected users
    const { data: tallies } = await supabase
      .from('tallies')
      .select('id, user_id, category')
      .eq('group_id', groupId)
      .eq('removed', false)
      .is('settlement_id', null)
      .in('user_id', selectedUserIds);

    if (!tallies || tallies.length === 0) {
      setSettling(false);
      return;
    }

    // Calculate per user
    const userCounts: Record<string, Record<number, number>> = {};
    tallies.forEach((t) => {
      if (!userCounts[t.user_id]) userCounts[t.user_id] = {};
      const cat = t.category ?? 1;
      userCounts[t.user_id][cat] = (userCounts[t.user_id][cat] || 0) + 1;
    });

    // Calculate total
    let totalAmount = 0;
    const lines = Object.entries(userCounts).map(([userId, counts]) => {
      let amount = 0;
      for (const [cat, count] of Object.entries(counts)) {
        const catNum = parseInt(cat);
        let price = 0;
        switch (catNum) {
          case 1: price = group.price_category_1; break;
          case 2: price = group.price_category_2; break;
          case 3: price = group.price_category_3 ?? 0; break;
          case 4: price = group.price_category_4 ?? 0; break;
        }
        amount += count * price;
      }
      totalAmount += amount;
      return {
        user_id: userId,
        amount,
        tally_count_1: counts[1] || 0,
        tally_count_2: counts[2] || 0,
        tally_count_3: counts[3] || 0,
        tally_count_4: counts[4] || 0,
      };
    });

    // Insert settlement
    const { data: settlement, error: settleErr } = await supabase
      .from('settlements')
      .insert({
        group_id: groupId,
        created_by: user.id,
        total_amount: totalAmount,
        settled_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (settleErr || !settlement) {
      console.error('Error creating settlement:', settleErr);
      setSettling(false);
      return;
    }

    // Insert settlement lines
    await supabase.from('settlement_lines').insert(
      lines.map((line) => ({
        ...line,
        settlement_id: settlement.id,
      }))
    );

    // Link tallies to settlement
    const tallyIds = tallies.map((t) => t.id);
    await supabase
      .from('tallies')
      .update({ settlement_id: settlement.id })
      .in('id', tallyIds);

    setSettling(false);
  }, [groupId, user]);

  const fetchHistory = useCallback(async () => {
    const { data: settlements } = await supabase
      .from('settlements')
      .select('*, lines:settlement_lines(*, profile:profiles(full_name))')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (settlements) {
      setHistory(settlements.map((s: any) => ({
        id: s.id,
        total_amount: s.total_amount,
        created_at: s.created_at,
        lines: (s.lines || []).map((l: any) => ({
          ...l,
          full_name: l.profile?.full_name ?? 'Onbekend',
        })),
      })));
    }
  }, [groupId]);

  return {
    settling,
    history,
    getUnsettledTallies,
    createSettlement,
    fetchHistory,
  };
}
