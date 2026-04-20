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
  const [groupTotalCents, setGroupTotalCents] = useState(0);

  const getCategoryPrice = useCallback((group: Group, catNum: number): number => {
    switch (catNum) {
      case 1: return group.price_category_1;
      case 2: return group.price_category_2;
      case 3: return group.price_category_3 ?? 0;
      case 4: return group.price_category_4 ?? 0;
      default: return 0;
    }
  }, []);

  const getUnsettledTallies = useCallback(async (group: Group) => {
    const { data: tallies } = await supabase
      .from('tallies')
      .select('user_id, category, drink_id, profiles!tallies_user_id_fkey(full_name)')
      .eq('group_id', groupId)
      .eq('removed', false)
      .is('settlement_id', null);

    if (!tallies || tallies.length === 0) return [];

    // Fetch drinks for drink-based pricing
    let drinksMap: Record<string, { price_override: number | null }> = {};
    if (group.drinks_as_categories) {
      const { data: drinksData } = await supabase
        .from('drinks')
        .select('id, price_override')
        .eq('group_id', groupId);
      if (drinksData) {
        drinksData.forEach((d: any) => { drinksMap[d.id] = { price_override: d.price_override }; });
      }
    }

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

    // Calculate amounts — dual path
    if (group.drinks_as_categories) {
      // Drink-based pricing: calculate per tally using drink's price_override
      Object.values(memberMap).forEach((member) => { member.amount = 0; });
      tallies.forEach((t: any) => {
        const uid = t.user_id;
        const member = memberMap[uid];
        if (!member) return;
        if (t.drink_id && drinksMap[t.drink_id]?.price_override != null) {
          member.amount += drinksMap[t.drink_id].price_override!;
        } else {
          // Fallback to category price
          member.amount += getCategoryPrice(group, t.category ?? 1);
        }
      });
    } else {
      // Category-based pricing (original logic)
      Object.values(memberMap).forEach((member) => {
        let total = 0;
        for (const [cat, count] of Object.entries(member.counts)) {
          total += count * getCategoryPrice(group, parseInt(cat));
        }
        member.amount = total;
      });
    }

    // Fetch credits for all members in this group
    const { data: allGifts } = await supabase
      .from('tally_gifts')
      .select('recipient_id, category, quantity, redeemed')
      .eq('group_id', groupId);

    // Build credit map and subtract from amounts
    if (allGifts) {
      const creditsByUser: Record<string, Record<number, number>> = {};
      allGifts.forEach((g: any) => {
        const remaining = (g.quantity ?? 0) - (g.redeemed ?? 0);
        if (remaining > 0) {
          if (!creditsByUser[g.recipient_id]) creditsByUser[g.recipient_id] = {};
          creditsByUser[g.recipient_id][g.category] =
            (creditsByUser[g.recipient_id][g.category] || 0) + remaining;
        }
      });

      Object.values(memberMap).forEach((member: any) => {
        const userCredits = creditsByUser[member.user_id];
        if (!userCredits) return;
        for (const [cat, creditCount] of Object.entries(userCredits)) {
          const catNum = parseInt(cat);
          const price = getCategoryPrice(group, catNum);
          member.amount -= (creditCount as number) * price;
        }
        member.amount = Math.max(0, member.amount);
      });
    }

    return Object.values(memberMap);
  }, [groupId]);

  const createSettlement = useCallback(async (group: Group, selectedUserIds: string[]) => {
    if (!user) return;
    setSettling(true);

    // Get all unsettled tallies for selected users
    const { data: tallies } = await supabase
      .from('tallies')
      .select('id, user_id, category, drink_id')
      .eq('group_id', groupId)
      .eq('removed', false)
      .is('settlement_id', null)
      .in('user_id', selectedUserIds);

    if (!tallies || tallies.length === 0) {
      setSettling(false);
      return;
    }

    // Fetch drinks for drink-based pricing
    let drinksMap: Record<string, { price_override: number | null }> = {};
    if (group.drinks_as_categories) {
      const { data: drinksData } = await supabase
        .from('drinks')
        .select('id, price_override')
        .eq('group_id', groupId);
      if (drinksData) {
        drinksData.forEach((d: any) => { drinksMap[d.id] = { price_override: d.price_override }; });
      }
    }

    // Calculate per user
    const userCounts: Record<string, Record<number, number>> = {};
    tallies.forEach((t) => {
      if (!userCounts[t.user_id]) userCounts[t.user_id] = {};
      const cat = t.category ?? 1;
      userCounts[t.user_id][cat] = (userCounts[t.user_id][cat] || 0) + 1;
    });

    // Calculate total — dual path
    let totalAmount = 0;
    let lines: { user_id: string; amount: number; tally_count_1: number; tally_count_2: number; tally_count_3: number; tally_count_4: number }[];

    if (group.drinks_as_categories) {
      // Drink-based pricing: per-tally calculation
      const userAmounts: Record<string, number> = {};
      tallies.forEach((t) => {
        if (!userAmounts[t.user_id]) userAmounts[t.user_id] = 0;
        if (t.drink_id && drinksMap[t.drink_id]?.price_override != null) {
          userAmounts[t.user_id] += drinksMap[t.drink_id].price_override!;
        } else {
          userAmounts[t.user_id] += getCategoryPrice(group, t.category ?? 1);
        }
      });
      lines = Object.entries(userCounts).map(([userId, counts]) => {
        const amount = userAmounts[userId] || 0;
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
    } else {
      // Category-based pricing (original logic)
      lines = Object.entries(userCounts).map(([userId, counts]) => {
        let amount = 0;
        for (const [cat, count] of Object.entries(counts)) {
          amount += count * getCategoryPrice(group, parseInt(cat));
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
    }

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

  const refreshGroupTotal = useCallback(async (group: Group) => {
    try {
      const members = await getUnsettledTallies(group);
      const total = members.reduce((s, m) => s + m.amount, 0);
      setGroupTotalCents(total);
    } catch (e) {
      // stil falen — geen blocker voor UI
      console.warn('[useSettlements] refreshGroupTotal failed', e);
    }
  }, [getUnsettledTallies]);

  return {
    settling,
    history,
    groupTotalCents,
    getUnsettledTallies,
    createSettlement,
    fetchHistory,
    refreshGroupTotal,
  };
}
