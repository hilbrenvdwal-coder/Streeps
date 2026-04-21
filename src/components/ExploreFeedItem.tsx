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
// Pill approximations — voor collision-check/bounds
const PILL_ESTIMATED_WIDTH = 60;
const PILL_ESTIMATED_HEIGHT = 28;

// Extra rand-buffer zodat pills niet tegen de kaartrand plakken
const EDGE_BUFFER = 8;
// Avatar+naam zone reservering (top-left) — breedte × hoogte
const AVATAR_ZONE_W = 150;
const AVATAR_ZONE_H = 30;
// LIVE-badge zone reservering (bottom-right) — breedte × hoogte
const LIVE_ZONE_W = 80;
const LIVE_ZONE_H = 30;
// Max jitter als fractie van celbreedte/hoogte
const JITTER_FRACTION = 0.15;

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
 * Kies grid-kolommen en -rijen voor N pills.
 * Doel: zo vierkant mogelijk, met voorkeur voor meer kolommen dan rijen.
 *
 * N=1  → 1×1
 * N=2  → 2×1
 * N=3  → 3×1
 * N=4  → 2×2
 * N=5-6→ 3×2
 * N=7-9→ 3×3
 * N≥10 → 4×ceil(N/4)
 */
function chooseGrid(n: number): { cols: number; rows: number } {
  if (n <= 1) return { cols: 1, rows: 1 };
  if (n <= 2) return { cols: 2, rows: 1 };
  if (n <= 3) return { cols: 3, rows: 1 };
  if (n <= 4) return { cols: 2, rows: 2 };
  if (n <= 6) return { cols: 3, rows: 2 };
  if (n <= 9) return { cols: 3, rows: 3 };
  return { cols: 4, rows: Math.ceil(n / 4) };
}

/**
 * Controleer of een punt (cx, cy) — het centrum van een pill — in een
 * gereserveerde zone valt (top-left avatar of bottom-right LIVE badge).
 * cx/cy zijn relatief aan de canvas-linkerbovenhoek.
 */
function inReservedZone(
  cx: number,
  cy: number,
  canvasW: number,
  canvasH: number,
): boolean {
  // Avatar-naam zone: top-left
  if (cx < AVATAR_ZONE_W && cy < AVATAR_ZONE_H) return true;
  // LIVE-badge zone: bottom-right
  if (
    cx > canvasW - LIVE_ZONE_W - PILL_ESTIMATED_WIDTH &&
    cy > canvasH - LIVE_ZONE_H
  )
    return true;
  return false;
}

/**
 * Plaats N pills via jittered-grid binnen het beschikbare canvas.
 *
 * Canvas-bounds:
 *   - X: [HORIZONTAL_PADDING + EDGE_BUFFER … containerWidth - HORIZONTAL_PADDING - EDGE_BUFFER - PILL_W]
 *   - Y: [TOP_BAR_HEIGHT + VERTICAL_PADDING + EDGE_BUFFER … ITEM_HEIGHT - BOTTOM_RESERVE - EDGE_BUFFER - PILL_H]
 *
 * Grid-cellen worden gelijkmatig verdeeld; elke pill krijgt het cel-centrum
 * plus een kleine deterministisch jitter (max JITTER_FRACTION × celafmeting).
 *
 * Gereserveerde zones (avatar top-left, LIVE bottom-right) worden gemeden;
 * indien een cel daarin valt wordt de jitter als tegengesteld gespiegeld.
 */
function computePillLayouts(
  count: number,
  containerWidth: number,
  seed: string,
): PillLayout[] {
  if (count === 0) return [];

  const rng = createRng(seed);

  // Canvas-bounds voor pill-origins (top-left hoek van pill)
  const canvasX0 = HORIZONTAL_PADDING + EDGE_BUFFER;
  const canvasX1 = containerWidth - HORIZONTAL_PADDING - EDGE_BUFFER - PILL_ESTIMATED_WIDTH;
  const canvasY0 = TOP_BAR_HEIGHT + VERTICAL_PADDING + EDGE_BUFFER;
  const canvasY1 = ITEM_HEIGHT - BOTTOM_RESERVE - EDGE_BUFFER - PILL_ESTIMATED_HEIGHT;

  const canvasW = Math.max(1, canvasX1 - canvasX0);
  const canvasH = Math.max(1, canvasY1 - canvasY0);

  // N=1: gecentreerd, geen grid nodig
  if (count === 1) {
    const x = canvasX0 + canvasW / 2 - PILL_ESTIMATED_WIDTH / 2;
    const y = canvasY0 + canvasH / 2 - PILL_ESTIMATED_HEIGHT / 2;
    return [
      {
        x,
        y,
        ampX: 3 + rng() * 3,
        ampY: 3 + rng() * 3,
        duration: 2000 + Math.floor(rng() * 2000),
        delay: Math.floor(rng() * 1500),
        phaseX: rng() * Math.PI * 2,
        phaseY: rng() * Math.PI * 2,
      },
    ];
  }

  const { cols, rows } = chooseGrid(count);
  const cellW = canvasW / cols;
  const cellH = canvasH / rows;

  // Max jitter in absolute pt
  const maxJitterX = cellW * JITTER_FRACTION;
  const maxJitterY = cellH * JITTER_FRACTION;

  const layouts: PillLayout[] = [];

  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);

    // Cel-centrum (relatief aan canvas)
    const cellCenterX = (col + 0.5) * cellW;
    const cellCenterY = (row + 0.5) * cellH;

    // Deterministisch jitter
    const jitterX = (rng() * 2 - 1) * maxJitterX;
    const jitterY = (rng() * 2 - 1) * maxJitterY;

    // Pill top-left (relatief aan canvas-origin)
    let relX = cellCenterX + jitterX - PILL_ESTIMATED_WIDTH / 2;
    let relY = cellCenterY + jitterY - PILL_ESTIMATED_HEIGHT / 2;

    // Absolute canvas-ruimte voor reserved-zone check (centrum van pill)
    const pillCenterX = relX + PILL_ESTIMATED_WIDTH / 2;
    const pillCenterY = relY + PILL_ESTIMATED_HEIGHT / 2;

    // Als pill in reserved zone: spiegel jitter om cel-centrum
    if (inReservedZone(pillCenterX + canvasX0, pillCenterY + canvasY0, containerWidth, canvasH)) {
      relX = cellCenterX - jitterX - PILL_ESTIMATED_WIDTH / 2;
      relY = cellCenterY - jitterY - PILL_ESTIMATED_HEIGHT / 2;
    }

    // Clampen zodat pill binnen canvas-bounds blijft
    const x = canvasX0 + Math.max(0, Math.min(relX, canvasW - PILL_ESTIMATED_WIDTH));
    const y = canvasY0 + Math.max(0, Math.min(relY, canvasH - PILL_ESTIMATED_HEIGHT));

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
