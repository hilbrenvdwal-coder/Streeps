import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AvatarPlaceholder from '@/src/components/AvatarPlaceholder';
import { supabase } from '@/src/lib/supabase';
import { brand, colors, radius, space, typography } from '@/src/theme';

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

// ─── Main modal ──────────────────────────────────────────────────────────────

export default function SearchGroupsModal({ visible, onClose, onGroupPress }: Props) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<TextInput | null>(null);

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

  // Reset state bij sluiten.
  useEffect(() => {
    if (!visible) {
      setQuery('');
      setResults([]);
      setError(null);
      setLoading(false);
      searchSeqRef.current++;
    }
  }, [visible]);

  const handleClose = useCallback(() => {
    Keyboard.dismiss();
    onClose();
  }, [onClose]);

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

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.root}>
        <LinearGradient
          colors={[brand.bg.from, brand.bg.to]}
          style={StyleSheet.absoluteFillObject}
        />

        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + space[2] }]}>
          <Pressable
            onPress={handleClose}
            hitSlop={10}
            style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
          >
            <Ionicons name="close" size={24} color={colors.dark.text.primary} />
          </Pressable>
          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={setQuery}
            placeholder="Zoek een groep"
            placeholderTextColor={brand.inactive}
            autoFocus
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            style={styles.input}
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
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[3],
    paddingBottom: space[3],
    gap: space[2],
  },
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
  },
  pressed: {
    opacity: 0.6,
  },
  input: {
    flex: 1,
    height: 40,
    paddingHorizontal: space[3],
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.08)',
    color: colors.dark.text.primary,
    ...typography.body,
    fontFamily: 'Unbounded',
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
