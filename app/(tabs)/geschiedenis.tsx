import React, { useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/components/useColorScheme';
import { getTheme, type Theme, auroraPalettes } from '@/src/theme';
import { useHistory, formatTimeAgo } from '@/src/hooks/useHistory';
import { AuroraPresetView } from '@/src/components/AuroraBackground';
import { AnimatedCard } from '@/src/components/AnimatedCard';

const SCREEN_W = Dimensions.get('window').width;
const DESIGN_W = 390;
const s = (v: number) => (v / DESIGN_W) * SCREEN_W;

export default function GeschiedenisScreen() {
  const mode = useColorScheme();
  const t = getTheme(mode);
  const styles = useMemo(() => createStyles(t), [mode]);
  const insets = useSafeAreaInsets();

  const { history, loading: historyLoading, refresh: refreshHistory, loadMore, loadingMore } = useHistory();

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient colors={['#0E0D1C', '#202020']} style={StyleSheet.absoluteFillObject} />

      {/* Status bar spacer + aurora + title */}
      <View style={{ paddingTop: insets.top }}>
        {/* Aurora */}
        <View style={styles.auroraWrap} pointerEvents="none">
          <AuroraPresetView preset="header" colors={[...auroraPalettes.history]} animated />
        </View>

        {/* Title */}
        <Text style={styles.title}>Geschiedenis</Text>
      </View>

      {/* History list */}
      <View style={{ flex: 1 }}>
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
    </View>
  );
}

function createStyles(t: Theme) {
  return StyleSheet.create({
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

    // ── Scroll content ──
    historyScrollContent: {
      paddingTop: s(16),
      paddingBottom: 120,
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
