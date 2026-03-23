import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColorScheme } from '@/components/useColorScheme';
import { getTheme, type Theme } from '@/src/theme';
import { useAuth } from '@/src/contexts/AuthContext';
import { supabase } from '@/src/lib/supabase';
import { useHistory, formatTimeAgo } from '@/src/hooks/useHistory';

interface GroupBill {
  group_id: string;
  group_name: string;
  category_names: string[];
  category_prices: number[];
  counts: Record<number, number>;
  total: number;
}

interface SettlementRecord {
  id: string;
  group_name: string;
  amount: number;
  created_at: string;
  paid: boolean;
}

export default function ActiviteitScreen() {
  const mode = useColorScheme();
  const t = getTheme(mode);
  const s = useMemo(() => createStyles(t), [mode]);
  const { user } = useAuth();

  const [tab, setTab] = useState<'rekening' | 'geschiedenis'>('rekening');

  // Bill data
  const [bills, setBills] = useState<GroupBill[]>([]);
  const [pastSettlements, setPastSettlements] = useState<SettlementRecord[]>([]);
  const [billLoading, setBillLoading] = useState(true);

  // History data
  const { history, loading: historyLoading, refresh: refreshHistory } = useHistory();

  const fetchBills = useCallback(async () => {
    if (!user) return;
    setBillLoading(true);
    const { data: memberships } = await supabase.from('group_members').select('group_id').eq('user_id', user.id);
    if (!memberships || memberships.length === 0) { setBills([]); setBillLoading(false); return; }
    const groupIds = memberships.map((m) => m.group_id);
    const { data: groups } = await supabase.from('groups').select('*').in('id', groupIds);
    const { data: tallies } = await supabase.from('tallies').select('group_id, category').eq('user_id', user.id).eq('removed', false).is('settlement_id', null).in('group_id', groupIds);
    if (!groups) { setBills([]); setBillLoading(false); return; }

    const billMap: Record<string, GroupBill> = {};
    groups.forEach((g: any) => {
      billMap[g.id] = {
        group_id: g.id, group_name: g.name,
        category_names: [g.name_category_1 || 'Categorie 1', g.name_category_2 || 'Categorie 2', g.name_category_3 || 'Categorie 3', g.name_category_4 || 'Categorie 4'],
        category_prices: [g.price_category_1, g.price_category_2, g.price_category_3 ?? 0, g.price_category_4 ?? 0],
        counts: {}, total: 0,
      };
    });
    (tallies || []).forEach((tally: any) => {
      const bill = billMap[tally.group_id];
      if (!bill) return;
      const cat = tally.category ?? 1;
      bill.counts[cat] = (bill.counts[cat] || 0) + 1;
    });
    Object.values(billMap).forEach((bill) => {
      let total = 0;
      for (const [cat, count] of Object.entries(bill.counts)) {
        total += count * (bill.category_prices[parseInt(cat) - 1] || 0);
      }
      bill.total = total;
    });
    const sorted = Object.values(billMap).filter((b) => Object.keys(b.counts).length > 0).sort((a, b) => b.total - a.total);
    setBills(sorted);

    const { data: settlementLines } = await supabase.from('settlement_lines').select('*, settlement:settlements(group_id, created_at)').eq('user_id', user.id).order('settlement(created_at)', { ascending: false }).limit(50);
    if (settlementLines && groups) {
      const groupMap: Record<string, any> = {};
      groups.forEach((g: any) => { groupMap[g.id] = g; });
      setPastSettlements(settlementLines.map((line: any) => {
        const g = groupMap[line.settlement?.group_id];
        return { id: line.id, group_name: g?.name ?? '?', amount: line.amount, created_at: line.settlement?.created_at ?? '', paid: line.paid };
      }));
    }
    setBillLoading(false);
  }, [user]);

  useEffect(() => { fetchBills(); }, [fetchBills]);

  const grandTotal = bills.reduce((sum, b) => sum + b.total, 0);

  const handleRefresh = () => {
    if (tab === 'rekening') fetchBills();
    else refreshHistory();
  };

  const loading = tab === 'rekening' ? billLoading : historyLoading;

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <Text style={[s.headerTitle, { color: t.colors.text.primary }]}>Activiteit</Text>
      </View>

      {/* Segment control */}
      <View style={[s.segmented, { backgroundColor: t.colors.surface.default }]}>
        <Pressable
          style={[s.segmentBtn, tab === 'rekening' && [s.segmentActive, { backgroundColor: t.brand.magenta + '20' }]]}
          onPress={() => setTab('rekening')}
        >
          <Text style={[s.segmentText, { color: t.colors.text.tertiary }, tab === 'rekening' && { color: t.brand.magenta, fontWeight: '600' }]}>
            Rekening
          </Text>
        </Pressable>
        <Pressable
          style={[s.segmentBtn, tab === 'geschiedenis' && [s.segmentActive, { backgroundColor: t.brand.magenta + '20' }]]}
          onPress={() => setTab('geschiedenis')}
        >
          <Text style={[s.segmentText, { color: t.colors.text.tertiary }, tab === 'geschiedenis' && { color: t.brand.magenta, fontWeight: '600' }]}>
            Geschiedenis
          </Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={t.brand.magenta} />
        </View>
      ) : tab === 'rekening' ? (
        <ScrollView
          refreshControl={<RefreshControl refreshing={billLoading} onRefresh={fetchBills} />}
          contentContainerStyle={s.content}
        >
          {/* Grand total */}
          <View style={s.totalSection}>
            <Text style={[s.totalAmount, grandTotal > 0 ? { color: t.brand.magenta } : { color: t.brand.cyan }]}>
              {'\u20AC'}{(grandTotal / 100).toFixed(2).replace('.', ',')}
            </Text>
            <Text style={{ color: t.colors.text.tertiary, fontSize: 14, marginTop: 4 }}>
              {grandTotal > 0 ? 'Openstaand' : 'Alles afgerekend'}
            </Text>
          </View>

          {bills.length === 0 && (
            <Text style={{ color: t.colors.text.tertiary, textAlign: 'center', paddingTop: 40, fontSize: 16 }}>
              Geen openstaande rekeningen
            </Text>
          )}

          {bills.map((bill) => (
            <View key={bill.group_id} style={[s.card, { backgroundColor: t.colors.surface.raised }]}>
              <View style={s.cardHeader}>
                <Text style={[s.cardTitle, { color: t.colors.text.primary }]}>{bill.group_name}</Text>
                <Text style={{ ...t.typography.heading3, color: t.brand.magenta }}>
                  {'\u20AC'}{(bill.total / 100).toFixed(2).replace('.', ',')}
                </Text>
              </View>
              {[1, 2, 3, 4].map((cat) => {
                const count = bill.counts[cat] || 0;
                if (count === 0) return null;
                const price = bill.category_prices[cat - 1] || 0;
                const subtotal = count * price;
                return (
                  <View key={cat} style={s.catRow}>
                    <View style={[s.catDot, { backgroundColor: t.categoryColors[(cat - 1) % 4] }]} />
                    <Text style={[s.catName, { color: t.colors.text.primary }]}>{bill.category_names[cat - 1]}</Text>
                    <Text style={{ color: t.colors.text.tertiary, fontSize: 12, marginRight: 12 }}>
                      {count}{'\u00D7'}{'\u20AC'}{(price / 100).toFixed(2).replace('.', ',')}
                    </Text>
                    <Text style={{ color: t.colors.text.primary, fontSize: 16, fontWeight: '500' }}>
                      {'\u20AC'}{(subtotal / 100).toFixed(2).replace('.', ',')}
                    </Text>
                  </View>
                );
              })}
            </View>
          ))}

          {/* Past settlements */}
          {pastSettlements.length > 0 && (
            <>
              <Text style={[s.sectionHeader, { color: t.colors.text.tertiary }]}>GESCHIEDENIS</Text>
              <View style={[s.card, { backgroundColor: t.colors.surface.raised }]}>
                {pastSettlements.map((settlement, i) => (
                  <React.Fragment key={settlement.id}>
                    {i > 0 && <View style={{ height: 1, backgroundColor: t.colors.border.default }} />}
                    <View style={s.historyRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: t.colors.text.primary, fontSize: 16, fontWeight: '500' }}>{settlement.group_name}</Text>
                        <Text style={{ color: t.colors.text.tertiary, fontSize: 12, marginTop: 2 }}>{formatTimeAgo(settlement.created_at)}</Text>
                      </View>
                      <Text style={{ ...t.typography.heading3, color: settlement.paid ? t.brand.cyan : t.brand.magenta }}>
                        {'\u20AC'}{(settlement.amount / 100).toFixed(2).replace('.', ',')}
                      </Text>
                    </View>
                  </React.Fragment>
                ))}
              </View>
            </>
          )}
        </ScrollView>
      ) : (
        <FlatList
          data={history}
          keyExtractor={(item) => item.id}
          onRefresh={refreshHistory}
          refreshing={historyLoading}
          contentContainerStyle={s.content}
          ListEmptyComponent={
            <Text style={{ color: t.colors.text.tertiary, textAlign: 'center', paddingTop: 80, fontSize: 16 }}>
              Nog geen streepjes gezet
            </Text>
          }
          renderItem={({ item, index }) => {
            const catColor = t.categoryColors[(item.category - 1) % 4];
            return (
              <View style={[
                s.historyItem,
                { backgroundColor: t.colors.surface.raised },
                index === 0 && { borderTopLeftRadius: 16, borderTopRightRadius: 16 },
                index === history.length - 1 && { borderBottomLeftRadius: 16, borderBottomRightRadius: 16 },
                item.removed && { opacity: 0.4 },
              ]}>
                <View style={[s.catDot, { backgroundColor: catColor }]} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: t.colors.text.primary, fontSize: 16, fontWeight: '500' }}>
                    Categorie {item.category}{item.removed ? ' (verwijderd)' : ''}
                  </Text>
                  <Text style={{ color: t.colors.text.tertiary, fontSize: 12, marginTop: 2 }}>
                    {item.group_name} · {formatTimeAgo(item.created_at)}
                  </Text>
                </View>
              </View>
            );
          }}
          ItemSeparatorComponent={() => (
            <View style={{ height: 1, backgroundColor: t.colors.border.default, marginLeft: 38 }} />
          )}
        />
      )}
    </SafeAreaView>
  );
}

function createStyles(t: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.colors.background.primary },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    content: { paddingHorizontal: 20, paddingBottom: 40 },

    header: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 4 },
    headerTitle: { fontSize: 32, fontWeight: '700' },

    // Segment
    segmented: {
      flexDirection: 'row',
      marginHorizontal: 20,
      marginVertical: 12,
      borderRadius: 12,
      padding: 3,
    },
    segmentBtn: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 10,
      alignItems: 'center',
    },
    segmentActive: {},
    segmentText: { fontSize: 14, fontWeight: '500' },

    // Total
    totalSection: { alignItems: 'center', paddingVertical: 24 },
    totalAmount: { fontSize: 48, fontWeight: '700' },

    // Card
    card: { borderRadius: 16, marginBottom: 12, overflow: 'hidden', padding: 16 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    cardTitle: { fontSize: 18, fontWeight: '600' },

    catRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
    catDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
    catName: { fontSize: 14, flex: 1 },

    sectionHeader: { fontSize: 11, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase', marginLeft: 4, marginTop: 20, marginBottom: 8 },

    historyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },

    // History list
    historyItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
  });
}
