import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Pressable,
  Dimensions,
  Animated,
  Easing,
  Alert,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/components/useColorScheme';
import { getTheme, type Theme } from '@/src/theme';
import { useAuth } from '@/src/contexts/AuthContext';
import { supabase } from '@/src/lib/supabase';
import { useHistory, formatTimeAgo } from '@/src/hooks/useHistory';
import { AuroraPresetView } from '@/src/components/AuroraBackground';
import * as Haptics from 'expo-haptics';
import { AnimatedCard } from '@/src/components/AnimatedCard';

const SCREEN_W = Dimensions.get('window').width;
const DESIGN_W = 390;
const s = (v: number) => (v / DESIGN_W) * SCREEN_W;

const ACTIVITEIT_AURORA_COLORS = ['#FF0015', '#FF00F5', '#F1F1F1', '#FF00F5'];

interface GroupBill {
  group_id: string;
  group_name: string;
  category_names: string[];
  category_prices: number[];
  counts: Record<number, number>;
  total: number;
  drinks_as_categories?: boolean;
  drink_breakdown?: Array<{ drink_id: string; drink_name: string; drink_emoji: string | null; color: string; count: number; price: number }>;
}

interface SettlementRecord {
  id: string;
  group_name: string;
  amount: number;
  created_at: string;
  paid: boolean;
  admin_name: string;
}

const TABS = [
  { key: 'geschiedenis' as const, label: 'Geschiedenis' },
  { key: 'rekening' as const, label: 'Rekening' },
];

export default function ActiviteitScreen() {
  const mode = useColorScheme();
  const t = getTheme(mode);
  const styles = useMemo(() => createStyles(t), [mode]);
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [tab, setTab] = useState<'rekening' | 'geschiedenis'>('geschiedenis');
  const SCREEN_W = Dimensions.get('window').width;

  // ── Swipeable pager ──
  const pagerRef = useRef<ScrollView>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  // ── Animated tab indicator (driven by scroll position) ──
  const tabLayouts = useRef<{ x: number; w: number }[]>([]).current;
  const tabReady = useRef(false);
  const [tabLayoutsReady, setTabLayoutsReady] = useState(false);

  const onTabLayout = useCallback((index: number, x: number, w: number) => {
    tabLayouts[index] = { x, w };
    if (tabLayouts.filter(Boolean).length === TABS.length && !tabReady.current) {
      tabReady.current = true;
      setTabLayoutsReady(true);
    }
  }, []);

  // Interpolate indicator position from scroll offset
  const tabX = tabLayoutsReady && tabLayouts[0] && tabLayouts[1]
    ? scrollX.interpolate({ inputRange: [0, SCREEN_W], outputRange: [tabLayouts[0].x, tabLayouts[1].x], extrapolate: 'clamp' })
    : new Animated.Value(0);
  const tabW = tabLayoutsReady && tabLayouts[0] && tabLayouts[1]
    ? scrollX.interpolate({ inputRange: [0, SCREEN_W], outputRange: [tabLayouts[0].w, tabLayouts[1].w], extrapolate: 'clamp' })
    : new Animated.Value(0);

  const activeTabIndex = TABS.findIndex((t) => t.key === tab);

  const handleTabPress = (index: number) => {
    setTab(TABS[index].key);
    pagerRef.current?.scrollTo({ x: index * SCREEN_W, animated: true });
  };

  // ── Bill data ──
  const [bills, setBills] = useState<GroupBill[]>([]);
  const [pendingSettlements, setPendingSettlements] = useState<SettlementRecord[]>([]);
  const [pastSettlements, setPastSettlements] = useState<SettlementRecord[]>([]);
  const [billLoading, setBillLoading] = useState(true);

  // ── History data ──
  const { history, loading: historyLoading, refresh: refreshHistory, loadMore, loadingMore } = useHistory();

  const fetchBills = useCallback(async () => {
    if (!user) return;
    setBillLoading(true);
    const { data: memberships } = await supabase.from('group_members').select('group_id').eq('user_id', user.id);
    if (!memberships || memberships.length === 0) { setBills([]); setBillLoading(false); return; }
    const groupIds = memberships.map((m) => m.group_id);
    const { data: groups } = await supabase.from('groups').select('*').in('id', groupIds);
    const { data: tallies } = await supabase.from('tallies').select('group_id, category, drink_id').eq('user_id', user.id).eq('removed', false).is('settlement_id', null).in('group_id', groupIds);
    if (!groups) { setBills([]); setBillLoading(false); return; }

    // Fetch drinks for groups with drinks_as_categories (full details + position per group for index-based color)
    const dacGroupIds = groups.filter((g: any) => g.drinks_as_categories).map((g: any) => g.id);
    // drinksMap: drink_id -> { price_override, name, emoji, category, group_id, drinkIndex (position within its group) }
    let drinksMap: Record<string, { price_override: number | null; name: string; emoji: string | null; category: number; group_id: string; drinkIndex: number }> = {};
    if (dacGroupIds.length > 0) {
      const { data: drinksData } = await supabase
        .from('drinks')
        .select('id, name, emoji, price_override, category, group_id')
        .in('group_id', dacGroupIds)
        .eq('is_available', true)
        .order('category', { ascending: true });
      if (drinksData) {
        // Compute per-group index
        const perGroupIndex: Record<string, number> = {};
        drinksData.forEach((d: any) => {
          const idx = (perGroupIndex[d.group_id] ?? -1) + 1;
          perGroupIndex[d.group_id] = idx;
          drinksMap[d.id] = {
            price_override: d.price_override,
            name: d.name,
            emoji: d.emoji ?? null,
            category: d.category ?? 1,
            group_id: d.group_id,
            drinkIndex: idx,
          };
        });
      }
    }

    const billMap: Record<string, GroupBill> = {};
    groups.forEach((g: any) => {
      billMap[g.id] = {
        group_id: g.id, group_name: g.name,
        category_names: [g.name_category_1 || 'Categorie 1', g.name_category_2 || 'Categorie 2', g.name_category_3 || 'Categorie 3', g.name_category_4 || 'Categorie 4'],
        category_prices: [g.price_category_1, g.price_category_2, g.price_category_3 ?? 0, g.price_category_4 ?? 0],
        counts: {}, total: 0,
        drinks_as_categories: g.drinks_as_categories ?? false,
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
      if (bill.drinks_as_categories) {
        // Drink-based pricing + breakdown per drink
        const breakdownMap: Record<string, { drink_id: string; drink_name: string; drink_emoji: string | null; color: string; count: number; price: number }> = {};
        (tallies || []).forEach((tally: any) => {
          if (tally.group_id !== bill.group_id) return;
          const drink = tally.drink_id ? drinksMap[tally.drink_id] : null;
          if (drink) {
            const price = drink.price_override != null
              ? drink.price_override
              : (bill.category_prices[(drink.category ?? 1) - 1] || 0);
            total += price;
            if (!breakdownMap[tally.drink_id]) {
              breakdownMap[tally.drink_id] = {
                drink_id: tally.drink_id,
                drink_name: drink.name,
                drink_emoji: drink.emoji,
                color: t.categoryColors[drink.drinkIndex % 4],
                count: 0,
                price,
              };
            }
            breakdownMap[tally.drink_id].count += 1;
          } else {
            // Fallback: no drink_id — count toward category price (kept in counts)
            total += bill.category_prices[(tally.category ?? 1) - 1] || 0;
          }
        });
        bill.drink_breakdown = Object.values(breakdownMap);
      } else {
        for (const [cat, count] of Object.entries(bill.counts)) {
          total += count * (bill.category_prices[parseInt(cat) - 1] || 0);
        }
      }
      bill.total = total;
    });
    const sorted = Object.values(billMap).filter((b) => Object.keys(b.counts).length > 0).sort((a, b) => b.total - a.total);
    setBills(sorted);

    const { data: settlementLines } = await supabase.from('settlement_lines').select('*, settlement:settlements(group_id, created_at, created_by)').eq('user_id', user.id).order('settlement(created_at)', { ascending: false }).limit(50);
    if (settlementLines && groups) {
      const groupMap: Record<string, any> = {};
      groups.forEach((g: any) => { groupMap[g.id] = g; });

      // Fetch admin names
      const adminIds = [...new Set(
        settlementLines.map((line: any) => line.settlement?.created_by).filter(Boolean)
      )];
      let adminNames: Record<string, string> = {};
      if (adminIds.length > 0) {
        const { data: adminProfiles } = await supabase.from('profiles').select('id, full_name').in('id', adminIds);
        (adminProfiles || []).forEach((p: any) => { adminNames[p.id] = p.full_name; });
      }

      const allRecords: SettlementRecord[] = settlementLines.map((line: any) => {
        const g = groupMap[line.settlement?.group_id];
        return {
          id: line.id,
          group_name: g?.name ?? '?',
          amount: line.amount,
          created_at: line.settlement?.created_at ?? '',
          paid: line.paid,
          admin_name: adminNames[line.settlement?.created_by] ?? 'Beheerder',
        };
      });

      setPendingSettlements(allRecords.filter((r) => !r.paid));
      setPastSettlements(allRecords.filter((r) => r.paid));
    }
    setBillLoading(false);
  }, [user]);

  const markAsPaid = useCallback(async (lineId: string) => {
    const { error } = await supabase
      .from('settlement_lines')
      .update({ paid: true })
      .eq('id', lineId);
    if (!error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      fetchBills();
    } else {
      Alert.alert('Fout', 'Kon betaling niet markeren. Probeer opnieuw.');
    }
  }, [fetchBills]);

  const confirmMarkAsPaid = useCallback((settlement: SettlementRecord) => {
    Alert.alert(
      'Betaling bevestigen',
      `Weet je zeker dat je \u20AC${(settlement.amount / 100).toFixed(2).replace('.', ',')} voor ${settlement.group_name} als betaald wilt markeren?`,
      [
        { text: 'Annuleren', style: 'cancel' },
        { text: 'Betaald', style: 'default', onPress: () => markAsPaid(settlement.id) },
      ]
    );
  }, [markAsPaid]);

  useEffect(() => { fetchBills(); }, [fetchBills]);

  const grandTotal = bills.reduce((sum, b) => sum + b.total, 0);

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient colors={['#0E0D1C', '#202020']} style={StyleSheet.absoluteFillObject} />

      {/* Status bar spacer + aurora + title + tab switcher are fixed at top */}
      <View style={{ paddingTop: insets.top }}>
        {/* Aurora */}
        <View style={styles.auroraWrap} pointerEvents="none">
          <AuroraPresetView preset="header" colors={ACTIVITEIT_AURORA_COLORS} animated />
        </View>

        {/* Title */}
        <Text style={styles.title}>Activiteit</Text>

        {/* Tab switcher */}
        <View style={styles.tabBar}>
          <Animated.View style={[styles.tabIndicator, { left: tabX, width: tabW }]} />
          {TABS.map((t, i) => {
            const activeOpacity = scrollX.interpolate({
              inputRange: [0, SCREEN_W],
              outputRange: i === 0 ? [1, 0] : [0, 1],
              extrapolate: 'clamp',
            });
            return (
              <Pressable
                key={t.key}
                style={styles.tabBtn}
                onPress={() => handleTabPress(i)}
                onLayout={(e) => onTabLayout(i, e.nativeEvent.layout.x, e.nativeEvent.layout.width)}
              >
                <Text style={styles.tabText}>{t.label}</Text>
                <Animated.Text style={[styles.tabText, styles.tabTextActive, { position: 'absolute', opacity: activeOpacity }]}>
                  {t.label}
                </Animated.Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Swipeable content pager */}
      <Animated.ScrollView
        ref={pagerRef as any}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
        onMomentumScrollEnd={(e) => {
          const page = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
          if (TABS[page]) setTab(TABS[page].key);
        }}
        style={{ flex: 1 }}
      >
        {/* Page 0: Geschiedenis */}
        <View style={{ width: SCREEN_W, flex: 1 }}>
          <MaskedView
            style={{ flex: 1 }}
            maskElement={
              <View style={{ flex: 1 }}>
                <LinearGradient colors={['transparent', '#000']} style={{ height: 32 }} />
                <View style={{ flex: 1, backgroundColor: '#000' }} />
              </View>
            }
          >
          <FlatList
            data={history}
            keyExtractor={(item) => item.id}
            onRefresh={refreshHistory}
            refreshing={historyLoading}
            contentContainerStyle={styles.historyScrollContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              historyLoading
                ? <ActivityIndicator size="large" color="#FF004D" style={{ marginTop: 80 }} />
                : <Text style={styles.emptyText}>Nog geen streepjes gezet</Text>
            }
            onEndReached={loadMore}
            onEndReachedThreshold={0.3}
            ListFooterComponent={
              loadingMore
                ? <ActivityIndicator size="small" color="#FF004D" style={{ paddingVertical: 24 }} />
                : null
            }
            renderItem={({ item, index }) => {
              const catColor = t.categoryColors[(item.category - 1) % 4];
              const catLabel = item.type === 'gift_sent'
                ? `Gedoneerd · ${item.drinks_as_categories && item.drink_name ? item.drink_name : `Cat ${item.category}`}`
                : (item.drinks_as_categories && item.drink_name
                    ? `${item.drink_emoji ? item.drink_emoji + ' ' : ''}${item.drink_name}`
                    : `Categorie ${item.category}`);
              const displayCount = item.type === 'gift_sent'
                ? (item.gift_quantity ?? 1)
                : (item.count ?? 1);
              return (
                <AnimatedCard index={index} enabled={index < 15}>
                <View style={[
                  styles.historyCard,
                  item.removed && { opacity: 0.4 },
                ]}>
                  {/* Left: count container */}
                  <View style={styles.historyCountBox}>
                    <Text style={styles.historyCountText}>{displayCount}</Text>
                    {item.type === 'gift_sent' && (
                      <View style={styles.giftIconOverlay}>
                        <Ionicons name="gift" size={14} color="#00BEAE" />
                      </View>
                    )}
                  </View>
                  {/* Right: badge + meta */}
                  <View style={styles.historyRight}>
                    <View style={[styles.historyCatBadge, { backgroundColor: catColor + '20' }]}>
                      <Text style={[styles.historyCatBadgeText, { color: catColor }]}>{catLabel}</Text>
                    </View>
                    <Text style={styles.historyMeta}>
                      {item.group_name} · {formatTimeAgo(item.created_at)}
                    </Text>
                  </View>
                </View>
                </AnimatedCard>
              );
            }}
          />
          </MaskedView>
        </View>

        {/* Page 1: Rekening */}
        <View style={{ width: SCREEN_W, flex: 1 }}>
          <MaskedView
            style={{ flex: 1 }}
            maskElement={
              <View style={{ flex: 1 }}>
                <LinearGradient colors={['transparent', '#000']} style={{ height: 32 }} />
                <View style={{ flex: 1, backgroundColor: '#000' }} />
              </View>
            }
          >
          <ScrollView
            refreshControl={<RefreshControl refreshing={billLoading} onRefresh={fetchBills} tintColor="#FF004D" />}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
          >
            {/* Grand total */}
            <View style={styles.totalSection}>
              <Text style={[styles.totalAmount, grandTotal > 0 ? { color: '#FF004D' } : { color: t.brand.cyan }]}>
                {'\u20AC'}{(grandTotal / 100).toFixed(2).replace('.', ',')}
              </Text>
              <Text style={styles.totalLabel}>
                {grandTotal > 0 ? 'Openstaand' : 'Alles afgerekend'}
              </Text>
            </View>

            {/* Pending settlements - action required */}
            {pendingSettlements.length > 0 && (
              <>
                <Text style={styles.sectionHeader}>OPENSTAAND</Text>
                {pendingSettlements.map((settlement) => (
                  <View key={settlement.id} style={styles.rekItem}>
                    <View style={styles.rekLeft}>
                      <View style={[styles.rekBadge, { backgroundColor: 'rgba(255, 0, 77, 0.12)' }]}>
                        <Text style={[styles.rekBadgeText, { color: '#FF004D' }]}>Openstaand</Text>
                      </View>
                      <Text style={styles.rekMeta}>
                        {settlement.group_name} · {settlement.admin_name}
                      </Text>
                      <Text style={styles.rekMeta}>
                        {formatTimeAgo(settlement.created_at)}
                      </Text>
                    </View>
                    <View style={styles.rekAmountBox}>
                      <Text style={[styles.rekCountText, { color: '#FF004D' }]}>
                        {'\u20AC'}{(settlement.amount / 100).toFixed(2).replace('.', ',')}
                      </Text>
                    </View>
                    <Pressable
                      style={styles.payButton}
                      onPress={() => confirmMarkAsPaid(settlement)}
                    >
                      <Text style={styles.payButtonText}>Betalen</Text>
                    </Pressable>
                  </View>
                ))}
              </>
            )}

            {bills.length === 0 && pendingSettlements.length === 0 && (
              <Text style={styles.emptyText}>Geen openstaande rekeningen</Text>
            )}

            {/* Current bills per group */}
            {bills.length > 0 && (
              <>
                {pendingSettlements.length > 0 && <Text style={styles.sectionHeader}>LOPEND</Text>}
                {bills.map((bill) => (
                  <View key={bill.group_id} style={styles.rekItem}>
                    <View style={styles.rekLeft}>
                      <Text style={styles.rekGroupName}>{bill.group_name}</Text>
                      {bill.drinks_as_categories && bill.drink_breakdown && bill.drink_breakdown.length > 0 ? (
                        bill.drink_breakdown.map((d) => (
                          <View key={d.drink_id} style={styles.rekCatRow}>
                            <View style={[styles.rekCatBadge, { backgroundColor: d.color + '20' }]}>
                              <Text style={[styles.rekCatBadgeText, { color: d.color }]}>
                                {d.drink_emoji ? `${d.drink_emoji} ` : ''}{d.drink_name}
                              </Text>
                            </View>
                            <Text style={styles.rekCatCount}>
                              {d.count}{'\u00D7'} {'\u20AC'}{(d.price / 100).toFixed(2).replace('.', ',')}
                            </Text>
                          </View>
                        ))
                      ) : (
                        [1, 2, 3, 4].map((cat) => {
                          const count = bill.counts[cat] || 0;
                          if (count === 0) return null;
                          const price = bill.category_prices[cat - 1] || 0;
                          const catColor = t.categoryColors[(cat - 1) % 4];
                          return (
                            <View key={cat} style={styles.rekCatRow}>
                              <View style={[styles.rekCatBadge, { backgroundColor: catColor + '20' }]}>
                                <Text style={[styles.rekCatBadgeText, { color: catColor }]}>
                                  {bill.category_names[cat - 1]}
                                </Text>
                              </View>
                              <Text style={styles.rekCatCount}>
                                {count}{'\u00D7'} {'\u20AC'}{(price / 100).toFixed(2).replace('.', ',')}
                              </Text>
                            </View>
                          );
                        })
                      )}
                    </View>
                    <View style={styles.rekAmountBox}>
                      <Text style={[styles.rekCountText, { color: '#FF004D' }]}>
                        {'\u20AC'}{(bill.total / 100).toFixed(2).replace('.', ',')}
                      </Text>
                    </View>
                  </View>
                ))}
              </>
            )}

            {/* Past settlements */}
            {pastSettlements.length > 0 && (
              <>
                <Text style={styles.sectionHeader}>AFGEREKEND</Text>
                {pastSettlements.map((settlement) => (
                  <View key={settlement.id} style={styles.rekItem}>
                    <View style={styles.rekLeft}>
                      <View style={[styles.rekBadge, { backgroundColor: 'rgba(0, 190, 174, 0.12)' }]}>
                        <Text style={[styles.rekBadgeText, { color: '#00BEAE' }]}>Betaald</Text>
                      </View>
                      <Text style={styles.rekMeta}>
                        {settlement.group_name} · {formatTimeAgo(settlement.created_at)}
                      </Text>
                    </View>
                    <View style={styles.rekAmountBox}>
                      <Text style={[styles.rekCountText, { color: '#00BEAE' }]}>
                        {'\u20AC'}{(settlement.amount / 100).toFixed(2).replace('.', ',')}
                      </Text>
                    </View>
                  </View>
                ))}
              </>
            )}
          </ScrollView>
          </MaskedView>
        </View>
      </Animated.ScrollView>
    </View>
  );
}

function createStyles(t: Theme) {
  return StyleSheet.create({
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    // Aurora
    auroraWrap: {
      position: 'absolute',
      left: -20,
      top: 0,
      zIndex: 0,
    },

    // Title
    title: {
      fontFamily: 'Unbounded',
      fontSize: 24,
      fontWeight: '400',
      color: '#FFFFFF',
      paddingHorizontal: s(21),
      paddingTop: s(10),
    },

    // ── Tab switcher (from SVG: rx=25, h=50, bg=rgba(78,78,78,0.4)) ──
    tabBar: {
      flexDirection: 'row',
      marginHorizontal: s(25),
      marginTop: s(16),
      height: s(50),
      borderRadius: 25,
      backgroundColor: 'rgba(78, 78, 78, 0.4)',
      padding: s(5),
      alignItems: 'center',
    },
    tabIndicator: {
      position: 'absolute',
      top: s(5),
      bottom: s(5),
      borderRadius: 20,
      backgroundColor: 'rgba(255, 0, 77, 0.19)',
    },
    tabBtn: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      borderRadius: 20,
    },
    tabText: {
      fontFamily: 'Unbounded',
      fontSize: 14,
      fontWeight: '500',
      color: '#848484',
    },
    tabTextActive: {
      color: '#FF004D',
    },

    // ── Scroll content ──
    scrollContent: {
      paddingHorizontal: s(23),
      paddingTop: s(16),
      paddingBottom: 120,
    },
    historyScrollContent: {
      paddingTop: s(16),
      paddingBottom: 120,
    },

    // ── Total ──
    totalSection: {
      alignItems: 'center',
      paddingVertical: s(24),
    },
    totalAmount: {
      fontFamily: 'Unbounded',
      fontSize: 48,
      fontWeight: '700',
    },
    totalLabel: {
      fontFamily: 'Unbounded',
      color: '#848484',
      fontSize: 14,
      marginTop: 4,
    },

    // ── Section header ──
    sectionHeader: {
      fontFamily: 'Unbounded',
      fontSize: 14,
      fontWeight: '400',
      color: '#848484',
      marginTop: s(20),
      marginBottom: s(8),
    },

    // ── Rekening items (transparent rows with dividers) ──
    rekItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    },
    rekAmountBox: {
      minWidth: 80,
      alignItems: 'flex-end',
      marginLeft: 14,
    },
    rekCountText: {
      fontFamily: 'Unbounded-SemiBold',
      fontSize: 22,
      fontWeight: '700',
    },
    rekLeft: {
      flex: 1,
      justifyContent: 'space-evenly',
    },
    rekGroupName: {
      fontFamily: 'Unbounded',
      fontSize: 13,
      fontWeight: '500',
      color: '#FFFFFF',
      marginBottom: 2,
    },
    rekBadge: {
      alignSelf: 'flex-start',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      marginBottom: 4,
    },
    rekBadgeText: {
      fontFamily: 'Unbounded',
      fontSize: 11,
      fontWeight: '500',
    },
    rekMeta: {
      fontFamily: 'Unbounded',
      fontSize: 11,
      color: '#848484',
      marginTop: 1,
    },
    rekCatRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 6,
      gap: 8,
    },
    rekCatBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      alignSelf: 'flex-start',
    },
    rekCatBadgeText: {
      fontFamily: 'Unbounded',
      fontSize: 11,
      fontWeight: '500',
    },
    rekCatCount: {
      fontFamily: 'Unbounded',
      fontSize: 12,
      color: '#848484',
      fontWeight: '700',
    },
    payButton: {
      backgroundColor: '#00BEAE',
      borderRadius: 16,
      paddingHorizontal: s(16),
      paddingVertical: s(10),
      marginLeft: s(12),
    },
    payButtonText: {
      fontFamily: 'Unbounded',
      fontSize: 12,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    catDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      marginRight: 10,
    },

    // ── History card (matches confirmatie modal info card) ──
    historyCard: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      backgroundColor: 'transparent',
      padding: 16,
      marginBottom: 0,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255,255,255,0.06)',
    },
    historyCountBox: {
      width: 64,
      height: 64,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    giftIconOverlay: {
      position: 'absolute' as const,
      top: 2,
      right: 2,
      backgroundColor: 'rgba(0, 190, 174, 0.15)',
      borderRadius: 10,
      padding: 3,
    },
    historyCountText: {
      fontFamily: 'Unbounded-SemiBold',
      fontSize: 36,
      color: '#FFFFFF',
    },
    historyRight: {
      flex: 1,
      marginLeft: 16,
      justifyContent: 'space-evenly' as const,
      height: 64,
    },
    historyCatBadge: {
      alignSelf: 'flex-start' as const,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 7,
    },
    historyCatBadgeText: {
      fontFamily: 'Unbounded',
      fontSize: 11,
      fontWeight: '500' as const,
    },
    historyMeta: {
      fontFamily: 'Unbounded',
      color: '#848484',
      fontSize: 11,
    },

    // ── Empty state ──
    emptyText: {
      fontFamily: 'Unbounded',
      color: '#848484',
      textAlign: 'center',
      paddingTop: 80,
      fontSize: 16,
    },
  });
}
