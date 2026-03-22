import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useColorScheme } from '@/components/useColorScheme';
import { Colors, Brand } from '@/src/constants/Colors';
import { useAuth } from '@/src/contexts/AuthContext';
import { supabase } from '@/src/lib/supabase';
import { formatTimeAgo } from '@/src/hooks/useHistory';

const CATEGORY_COLORS = [Brand.cyan, Brand.magenta, Brand.blue, Brand.purple];

interface SettlementRecord {
  id: string;
  group_name: string;
  amount: number;
  tally_count_1: number;
  tally_count_2: number;
  tally_count_3: number;
  tally_count_4: number;
  created_at: string;
  paid: boolean;
}

interface GroupBill {
  group_id: string;
  group_name: string;
  category_names: string[];
  category_prices: number[];
  counts: Record<number, number>;
  total: number;
}

export default function BillScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const { user } = useAuth();
  const [bills, setBills] = useState<GroupBill[]>([]);
  const [pastSettlements, setPastSettlements] = useState<SettlementRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBills = useCallback(async () => {
    if (!user) return;

    // Get all groups the user is a member of
    const { data: memberships } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('user_id', user.id);

    if (!memberships || memberships.length === 0) {
      setBills([]);
      setLoading(false);
      return;
    }

    const groupIds = memberships.map((m) => m.group_id);

    // Get group details
    const { data: groups } = await supabase
      .from('groups')
      .select('*')
      .in('id', groupIds);

    // Get unsettled tallies for this user
    const { data: tallies } = await supabase
      .from('tallies')
      .select('group_id, category')
      .eq('user_id', user.id)
      .eq('removed', false)
      .is('settlement_id', null)
      .in('group_id', groupIds);

    if (!groups) {
      setBills([]);
      setLoading(false);
      return;
    }

    // Build bills per group
    const billMap: Record<string, GroupBill> = {};
    groups.forEach((g: any) => {
      billMap[g.id] = {
        group_id: g.id,
        group_name: g.name,
        category_names: [
          g.name_category_1 || 'Categorie 1',
          g.name_category_2 || 'Categorie 2',
          g.name_category_3 || 'Categorie 3',
          g.name_category_4 || 'Categorie 4',
        ],
        category_prices: [
          g.price_category_1,
          g.price_category_2,
          g.price_category_3 ?? 0,
          g.price_category_4 ?? 0,
        ],
        counts: {},
        total: 0,
      };
    });

    // Count tallies per group per category
    (tallies || []).forEach((t: any) => {
      const bill = billMap[t.group_id];
      if (!bill) return;
      const cat = t.category ?? 1;
      bill.counts[cat] = (bill.counts[cat] || 0) + 1;
    });

    // Calculate totals
    Object.values(billMap).forEach((bill) => {
      let total = 0;
      for (const [cat, count] of Object.entries(bill.counts)) {
        const catIdx = parseInt(cat) - 1;
        total += count * (bill.category_prices[catIdx] || 0);
      }
      bill.total = total;
    });

    // Sort: highest bill first, filter out zero bills
    const sorted = Object.values(billMap)
      .filter((b) => Object.keys(b.counts).length > 0)
      .sort((a, b) => b.total - a.total);

    setBills(sorted);

    // Fetch past settlements for this user
    const { data: settlementLines } = await supabase
      .from('settlement_lines')
      .select('*, settlement:settlements(group_id, created_at)')
      .eq('user_id', user.id)
      .order('settlement(created_at)', { ascending: false })
      .limit(50);

    if (settlementLines && groups) {
      const groupMap: Record<string, any> = {};
      groups.forEach((g: any) => { groupMap[g.id] = g; });

      setPastSettlements(settlementLines.map((line: any) => {
        const g = groupMap[line.settlement?.group_id];
        return {
          id: line.id,
          group_name: g?.name ?? '?',
          amount: line.amount,
          tally_count_1: line.tally_count_1,
          tally_count_2: line.tally_count_2,
          tally_count_3: line.tally_count_3,
          tally_count_4: line.tally_count_4,
          created_at: line.settlement?.created_at ?? '',
          paid: line.paid,
        };
      }));
    }

    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchBills();
  }, [fetchBills]);

  const grandTotal = bills.reduce((sum, b) => sum + b.total, 0);

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={Brand.magenta} />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchBills} />}
    >
      {/* Total */}
      <View style={styles.totalSection}>
        <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>Totaal openstaand</Text>
        <Text style={[styles.totalAmount, { color: grandTotal > 0 ? Brand.magenta : Brand.cyan }]}>
          {(grandTotal / 100).toFixed(2).replace('.', ',')}
        </Text>
      </View>

      {/* Per group */}
      {bills.length === 0 && (
        <View style={styles.empty}>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            Geen openstaande rekeningen
          </Text>
        </View>
      )}

      {bills.map((bill) => (
        <View
          key={bill.group_id}
          style={[styles.groupCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <View style={styles.groupHeader}>
            <Text style={[styles.groupName, { color: colors.text }]}>{bill.group_name}</Text>
            <Text style={[styles.groupTotal, { color: Brand.magenta }]}>
              {(bill.total / 100).toFixed(2).replace('.', ',')}
            </Text>
          </View>

          {[1, 2, 3, 4].map((cat) => {
            const count = bill.counts[cat] || 0;
            if (count === 0) return null;
            const price = bill.category_prices[cat - 1] || 0;
            const subtotal = count * price;
            return (
              <View key={cat} style={styles.categoryRow}>
                <View style={[styles.catDot, { backgroundColor: CATEGORY_COLORS[(cat - 1) % 4] }]} />
                <Text style={[styles.catName, { color: colors.text }]}>
                  {bill.category_names[cat - 1]}
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                  {count}x {(price / 100).toFixed(2).replace('.', ',')}
                </Text>
                <Text style={[styles.catTotal, { color: colors.text }]}>
                  {(subtotal / 100).toFixed(2).replace('.', ',')}
                </Text>
              </View>
            );
          })}
        </View>
      ))}

      {/* Settlement history */}
      {pastSettlements.length > 0 && (
        <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            AFREKENING GESCHIEDENIS
          </Text>
          {pastSettlements.map((s) => (
            <View
              key={s.id}
              style={[styles.groupCard, { marginHorizontal: 0, backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <View style={styles.groupHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.groupName, { color: colors.text, fontSize: 15 }]}>{s.group_name}</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{formatTimeAgo(s.created_at)}</Text>
                </View>
                <Text style={[styles.groupTotal, { color: s.paid ? Brand.cyan : Brand.magenta }]}>
                  {(s.amount / 100).toFixed(2).replace('.', ',')}
                </Text>
              </View>
              {[s.tally_count_1, s.tally_count_2, s.tally_count_3, s.tally_count_4].map((count, i) => {
                if (count === 0) return null;
                return (
                  <View key={i} style={styles.categoryRow}>
                    <View style={[styles.catDot, { backgroundColor: CATEGORY_COLORS[i] }]} />
                    <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                      {count}x cat. {i + 1}
                    </Text>
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },
  totalSection: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  totalLabel: { fontSize: 14 },
  totalAmount: { fontSize: 48, fontWeight: '700', marginTop: 4 },
  sectionTitle: { fontSize: 12, fontWeight: '600', letterSpacing: 1, marginBottom: 12 },
  empty: { alignItems: 'center', paddingTop: 40 },
  emptyText: { fontSize: 16 },
  groupCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  groupName: { fontSize: 18, fontWeight: '600' },
  groupTotal: { fontSize: 18, fontWeight: '700' },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  catDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  catName: { flex: 1, fontSize: 14 },
  catTotal: { fontSize: 14, fontWeight: '600', marginLeft: 8 },
});
