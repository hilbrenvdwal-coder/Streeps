import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AvatarPlaceholder from '@/src/components/AvatarPlaceholder';
import { supabase } from '@/src/lib/supabase';
import { brand, colors, radius, space, typography } from '@/src/theme';
import { useSwipeDismiss } from '@/src/hooks/useSwipeDismiss';

// ─── Types ───────────────────────────────────────────────────────────────────

interface SearchResult {
  id: string;
  name: string;
  avatarUrl: string | null;
  memberCount: number;
  followerCount: number;
}

interface SearchRpcRow {
  id: string;
  name: string;
  avatar_url: string | null;
  member_count: number;
  last_activity_at: string | null;
  follower_count: number;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onGroupPress: (groupId: string) => void;
}

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ─── Result row ──────────────────────────────────────────────────────────────

const AVATAR_SIZE = 40;

interface ResultRowProps {
  item: SearchResult;
  onPress: () => void;
}

function ResultRow({ item, onPress }: ResultRowProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [rowStyles.row, pressed && rowStyles.rowPressed]}
    >
      <View style={rowStyles.avatarWrap}>
        {item.avatarUrl ? (
          <Image
            source={{ uri: item.avatarUrl }}
            style={rowStyles.avatarImg}
            contentFit="cover"
            transition={150}
          />
        ) : (
          <AvatarPlaceholder size={AVATAR_SIZE} label={initials(item.name)} />
        )}
      </View>
      <View style={rowStyles.middle}>
        <Text style={rowStyles.name} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={rowStyles.subline} numberOfLines={1}>
          {item.memberCount} {item.memberCount === 1 ? 'lid' : 'leden'}
        </Text>
      </View>
    </Pressable>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    gap: space[3],
  },
  rowPressed: {
    opacity: 0.7,
  },
  avatarWrap: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  avatarImg: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: radius.full,
    backgroundColor: colors.dark.surface.default,
  },
  middle: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    ...typography.body,
    fontFamily: 'Unbounded',
    color: colors.dark.text.primary,
    fontWeight: '500',
  },
  subline: {
    ...typography.caption,
    fontFamily: 'Unbounded',
    color: brand.inactive,
    marginTop: 2,
  },
});

// ─── Main overlay ────────────────────────────────────────────────────────────

export default function SearchGroupsModal({ visible, onClose, onGroupPress }: Props) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [show, setShow] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;
  const { swipeX, scrimOpacity, panHandlers } = useSwipeDismiss(onClose, anim);

  // Seq-guard zodat stale responses niet over een nieuwere heenkomen.
  const searchSeqRef = useRef(0);
  // Debounce-timer voor query-wijzigingen.
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(async (q: string) => {
    const seq = ++searchSeqRef.current;
    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcErr } = await supabase.rpc('search_groups_by_name', {
        p_query: q,
        p_limit: 10,
      });
      if (rpcErr) throw rpcErr;
      if (seq !== searchSeqRef.current) return;
      const rows = (data ?? []) as SearchRpcRow[];
      setResults(
        rows.map((r) => ({
          id: r.id,
          name: r.name,
          avatarUrl: r.avatar_url,
          memberCount: r.member_count,
          followerCount: r.follower_count,
        })),
      );
      setLoading(false);
    } catch (e: any) {
      if (seq !== searchSeqRef.current) return;
      console.error('[SearchGroupsModal] search failed:', e?.message ?? e);
      setError('Kon niet zoeken. Probeer opnieuw.');
      setResults([]);
      setLoading(false);
    }
  }, []);

  // Debounce op query
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    const q = query.trim();
    if (q.length < MIN_QUERY_LENGTH) {
      // Geen zoekactie, maar cancel eventuele in-flight state.
      searchSeqRef.current++;
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }
    debounceTimerRef.current = setTimeout(() => {
      runSearch(q);
    }, DEBOUNCE_MS);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [query, runSearch]);

  // Open/close animatie + state reset NA sluiten.
  useEffect(() => {
    if (visible && !show) {
      swipeX.setValue(0);
      setShow(true);
      anim.setValue(0);
      Animated.spring(anim, { toValue: 1, damping: 20, stiffness: 200, mass: 1, useNativeDriver: true }).start();
    } else if (!visible && show) {
      Animated.timing(anim, { toValue: 0, duration: 300, easing: Easing.out(Easing.ease), useNativeDriver: true }).start(() => {
        setShow(false);
        // Reset search state NA animatie zodat lijst niet flickert
        setQuery('');
        setResults([]);
        setError(null);
        setLoading(false);
        searchSeqRef.current += 1;
      });
    }
  }, [visible, show, anim, swipeX]);

  const animateClose = useCallback(() => {
    Animated.timing(anim, { toValue: 0, duration: 300, easing: Easing.out(Easing.ease), useNativeDriver: true }).start(() => {
      onClose();
    });
  }, [anim, onClose]);

  const handleResultPress = useCallback(
    (groupId: string) => {
      Keyboard.dismiss();
      onGroupPress(groupId);
      onClose();
    },
    [onGroupPress, onClose],
  );

  const trimmed = query.trim();
  const showEmptyHint = trimmed.length < MIN_QUERY_LENGTH;
  const showNoResults =
    !loading && !showEmptyHint && !error && results.length === 0;

  if (!show) return null;

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: scrimOpacity }]} pointerEvents="auto">
        <BlurView
          intensity={30}
          tint="dark"
          experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.scrim} />
        <Pressable style={StyleSheet.absoluteFillObject} onPress={() => { Keyboard.dismiss(); animateClose(); }} />
      </Animated.View>

      <Animated.View
        style={[
          styles.content,
          {
            paddingTop: insets.top + 12,
            opacity: anim,
            transform: [{ translateX: Animated.add(swipeX, anim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] })) }],
          },
        ]}
        pointerEvents="auto"
        {...panHandlers}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          {/* Header */}
          <View style={styles.header}>
            <Pressable
              onPress={() => { Keyboard.dismiss(); animateClose(); }}
              hitSlop={12}
              style={styles.backBtn}
            >
              <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
            </Pressable>
            <Text style={styles.title}>Zoeken</Text>
            <View style={styles.backBtn} />
          </View>

          {/* Zoekbalk */}
          <View style={styles.searchWrap}>
            <Ionicons name="search-outline" size={18} color="#848484" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.input}
              placeholder="Zoek groepen..."
              placeholderTextColor="#848484"
              value={query}
              onChangeText={setQuery}
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
          </View>

          {/* Body */}
          <View style={styles.body}>
            {showEmptyHint ? (
              <View style={styles.stateWrap}>
                <Text style={styles.stateText}>Begin met typen...</Text>
              </View>
            ) : loading ? (
              <View style={styles.stateWrap}>
                <ActivityIndicator color={brand.inactive} />
              </View>
            ) : error ? (
              <View style={styles.stateWrap}>
                <Text style={styles.stateText}>{error}</Text>
              </View>
            ) : showNoResults ? (
              <View style={styles.stateWrap}>
                <Text style={styles.stateText}>Geen groepen gevonden</Text>
              </View>
            ) : (
              <FlatList
                data={results}
                keyExtractor={(r) => r.id}
                renderItem={({ item }) => (
                  <ResultRow item={item} onPress={() => handleResultPress(item.id)} />
                )}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.listContent}
              />
            )}
          </View>
        </KeyboardAvoidingView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.75)' },
  content: { flex: 1, paddingHorizontal: 20 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: 'Unbounded',
    fontSize: 18,
    color: '#FFFFFF',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.full,
    paddingHorizontal: 16,
    height: 48,
    marginBottom: 16,
  },
  input: {
    flex: 1,
    color: colors.dark.text.primary,
    ...typography.body,
    fontFamily: 'Unbounded',
    padding: 0,
  },
  body: {
    flex: 1,
  },
  stateWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: space[8],
    paddingHorizontal: space[6],
  },
  stateText: {
    ...typography.body,
    fontFamily: 'Unbounded',
    color: brand.inactive,
    textAlign: 'center',
  },
  listContent: {
    paddingVertical: space[2],
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.dark.border.default,
    marginHorizontal: space[3],
  },
});
