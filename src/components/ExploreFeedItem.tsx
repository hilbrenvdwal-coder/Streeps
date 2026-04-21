import React, { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import AvatarPlaceholder from '@/src/components/AvatarPlaceholder';
import { LiveBadge } from '@/src/components/LiveBadge';
import { colors, radius, space, typography } from '@/src/theme';

export interface ExploreFeedItemGroup {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface ExploreFeedDrinkCount {
  emoji: string;
  count: number;
}

interface ExploreFeedItemProps {
  group: ExploreFeedItemGroup;
  isLive: boolean;
  drinkCounts: ExploreFeedDrinkCount[];
  onPress: () => void;
  /** Optionele stabiele seed voor pill-positionering (bijv. bucket-key). */
  seedKey?: string;
}

// ─── Layout-constants ────────────────────────────────────────────────────────

const AVATAR_SIZE = 32;
const ITEM_HEIGHT = 200;
const HORIZONTAL_PADDING = space[3]; // 12
const VERTICAL_PADDING = space[2]; // 8
const TOP_BAR_HEIGHT = AVATAR_SIZE + space[2]; // 32 + 8 = 40
const BOTTOM_RESERVE = 28; // ruimte voor LIVE-badge rechts-onder
// Pill approximations — voor clamping/bounds
const PILL_ESTIMATED_WIDTH = 60;
const PILL_ESTIMATED_HEIGHT = 28;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Kleine deterministische hash → float in [0,1). Mulberry32-achtige PRNG
 * gebaseerd op een string-seed, zodat pill-posities stabiel zijn tussen
 * re-renders en niet springen.
 */
function createRng(seed: string): () => number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface PillLayout {
  x: number;
  y: number;
  // Animatie-parameters (stabiele seeds → stabiele animaties)
  ampX: number;
  ampY: number;
  duration: number;
  delay: number;
  phaseX: number;
  phaseY: number;
}

/**
 * Plaats N pills pseudo-random binnen het beschikbare canvas.
 * Canvas is ITEM_HEIGHT hoog × containerWidth breed, maar we reserveren:
 *   - top: TOP_BAR_HEIGHT (avatar+naam)
 *   - bottom: BOTTOM_RESERVE (LIVE-badge rechts-onder)
 *   - sides: HORIZONTAL_PADDING
 */
function computePillLayouts(
  count: number,
  containerWidth: number,
  seed: string,
): PillLayout[] {
  const rng = createRng(seed);
  const minX = HORIZONTAL_PADDING;
  const maxX = Math.max(
    minX + 1,
    containerWidth - HORIZONTAL_PADDING - PILL_ESTIMATED_WIDTH,
  );
  const minY = TOP_BAR_HEIGHT + VERTICAL_PADDING;
  const maxY = Math.max(
    minY + 1,
    ITEM_HEIGHT - BOTTOM_RESERVE - PILL_ESTIMATED_HEIGHT,
  );

  const layouts: PillLayout[] = [];
  for (let i = 0; i < count; i++) {
    const x = minX + rng() * (maxX - minX);
    const y = minY + rng() * (maxY - minY);
    layouts.push({
      x,
      y,
      // Klein, organisch — 3-6pt amplitude
      ampX: 3 + rng() * 3,
      ampY: 3 + rng() * 3,
      // 2000-4000ms voor subtiele drift
      duration: 2000 + Math.floor(rng() * 2000),
      delay: Math.floor(rng() * 1500),
      phaseX: rng() * Math.PI * 2,
      phaseY: rng() * Math.PI * 2,
    });
  }
  return layouts;
}

// ─── FloatingPill ────────────────────────────────────────────────────────────

interface FloatingPillProps {
  layout: PillLayout;
  emoji: string;
  count: number;
}

function FloatingPill({ layout, emoji, count }: FloatingPillProps) {
  const tx = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loopX = Animated.loop(
      Animated.sequence([
        Animated.timing(tx, {
          toValue: 1,
          duration: layout.duration,
          delay: layout.delay,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(tx, {
          toValue: -1,
          duration: layout.duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(tx, {
          toValue: 0,
          duration: layout.duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    const loopY = Animated.loop(
      Animated.sequence([
        Animated.timing(ty, {
          toValue: -1,
          duration: layout.duration + 300,
          delay: layout.delay + 200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(ty, {
          toValue: 1,
          duration: layout.duration + 300,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(ty, {
          toValue: 0,
          duration: layout.duration + 300,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    loopX.start();
    loopY.start();

    return () => {
      loopX.stop();
      loopY.stop();
    };
  }, [tx, ty, layout.duration, layout.delay]);

  const translateX = tx.interpolate({
    inputRange: [-1, 1],
    outputRange: [-layout.ampX, layout.ampX],
  });
  const translateY = ty.interpolate({
    inputRange: [-1, 1],
    outputRange: [-layout.ampY, layout.ampY],
  });

  return (
    <Animated.View
      style={[
        styles.pill,
        {
          left: layout.x,
          top: layout.y,
          transform: [{ translateX }, { translateY }],
        },
      ]}
      pointerEvents="none"
    >
      <Text style={styles.pillEmoji}>{emoji}</Text>
      <Text style={styles.pillCount}> {count}</Text>
    </Animated.View>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────

export default function ExploreFeedItem({
  group,
  isLive,
  drinkCounts,
  onPress,
  seedKey,
}: ExploreFeedItemProps) {
  // Wordt ingevuld door onLayout; default valt terug op een redelijke breedte.
  const [containerWidth, setContainerWidth] = React.useState(0);

  const seed = `${group.id}:${seedKey ?? ''}:${drinkCounts.length}`;

  const layouts = useMemo(
    () =>
      containerWidth > 0
        ? computePillLayouts(drinkCounts.length, containerWidth, seed)
        : [],
    [drinkCounts.length, containerWidth, seed],
  );

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (w !== containerWidth) setContainerWidth(w);
      }}
    >
      {/* Top row: avatar + naam */}
      <View style={styles.topRow}>
        <View style={styles.avatarWrap}>
          {group.avatarUrl ? (
            <Image
              source={{ uri: group.avatarUrl }}
              style={styles.avatarImg}
              contentFit="cover"
              transition={150}
            />
          ) : (
            <AvatarPlaceholder size={AVATAR_SIZE} label={initials(group.name)} />
          )}
        </View>
        <Text style={styles.name} numberOfLines={1}>
          {group.name}
        </Text>
      </View>

      {/* Pills — random geplaatst & zwevend */}
      {containerWidth > 0 &&
        drinkCounts.map((d, i) => {
          const layout = layouts[i];
          if (!layout) return null;
          return (
            <FloatingPill
              key={`${d.emoji}-${i}`}
              layout={layout}
              emoji={d.emoji}
              count={d.count}
            />
          );
        })}

      {/* LIVE-badge rechts onder */}
      {isLive && (
        <View style={styles.liveBadgeWrap} pointerEvents="none">
          <LiveBadge size="sm" />
        </View>
      )}
    </Pressable>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  row: {
    height: ITEM_HEIGHT,
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingTop: VERTICAL_PADDING,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.dark.border.default,
    position: 'relative',
    overflow: 'hidden',
  },
  rowPressed: {
    opacity: 0.7,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
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
  name: {
    ...typography.body,
    fontFamily: 'Unbounded',
    color: colors.dark.text.primary,
    fontWeight: '500',
    flexShrink: 1,
  },
  pill: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[2],
    paddingVertical: space[1],
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  pillEmoji: {
    fontSize: 14,
    lineHeight: 18,
  },
  pillCount: {
    fontSize: 14,
    lineHeight: 18,
    fontFamily: 'Unbounded',
    color: colors.dark.text.primary,
  },
  liveBadgeWrap: {
    position: 'absolute',
    right: HORIZONTAL_PADDING,
    bottom: space[2],
  },
});
