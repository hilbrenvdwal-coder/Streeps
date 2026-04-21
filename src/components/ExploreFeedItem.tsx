import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  GestureResponderEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AvatarPlaceholder from '@/src/components/AvatarPlaceholder';
import { LiveBadge } from '@/src/components/LiveBadge';
import { brand, colors, radius, space, typography } from '@/src/theme';

export interface ExploreFeedItemGroup {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface ExploreFeedDrinkCount {
  emoji: string;
  count: number;
  drinkId?: string;
  name?: string;
}

interface ExploreFeedItemProps {
  group: ExploreFeedItemGroup;
  isLive: boolean;
  drinkCounts: ExploreFeedDrinkCount[];
  onPress: () => void;
  /** Optionele stabiele seed voor pill-positionering (bijv. bucket-key). */
  seedKey?: string;
  /** Session-only like-state, beheerd door parent. */
  liked: boolean;
  /** Toggle-callback; bepaalt zelf of het een like of unlike is. */
  onToggleLike: () => void;
}

// ─── Layout-constants ────────────────────────────────────────────────────────

const AVATAR_SIZE = 32;
const ITEM_HEIGHT = 200;
const HORIZONTAL_PADDING = space[3]; // 12
const VERTICAL_PADDING = space[2]; // 8
const TOP_BAR_HEIGHT = AVATAR_SIZE + space[2]; // 32 + 8 = 40
const BOTTOM_RESERVE = 28; // ruimte voor LIVE-badge rechts-onder
// Double-tap window (ms) — Instagram-achtige drempel
const DOUBLE_TAP_MS = 280;
// Like-knop icon-afmetingen (voor fly-to target-berekening)
const LIKE_ICON_SIZE = 22;
const LIKE_HIT_SLOP = 8;
// Heart burst icon size
const BURST_ICON_SIZE = 96;
// Pill approximations — voor collision-check/bounds
const PILL_ESTIMATED_WIDTH = 60;
const PILL_ESTIMATED_HEIGHT = 28;

// Extra rand-buffer zodat pills niet tegen de kaartrand plakken
const EDGE_BUFFER = 12;
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
  label?: string;
  pillId: string;
  isExpanded: boolean;
  onPress: () => void;
  /** Container-breedte voor edge-detectie (label links vs rechts). */
  containerWidth: number;
}

function FloatingPill({
  layout,
  emoji,
  count,
  label,
  isExpanded,
  onPress,
  containerWidth,
}: FloatingPillProps) {
  const tx = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const labelOpacity = useRef(new Animated.Value(0)).current;
  const labelTranslateX = useRef(new Animated.Value(-4)).current;

  // Bepaal of label links of rechts van de pill komt (bij te dichte rechterrand).
  const labelGoesLeft =
    containerWidth > 0 &&
    layout.x > containerWidth - HORIZONTAL_PADDING - 180;

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

  // Expand / collapse animatie.
  useEffect(() => {
    if (isExpanded) {
      Animated.parallel([
        Animated.timing(scale, {
          toValue: 1.25,
          duration: 220,
          easing: Easing.out(Easing.back(1.4)),
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(80),
          Animated.parallel([
            Animated.timing(labelOpacity, {
              toValue: 1,
              duration: 180,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.timing(labelTranslateX, {
              toValue: 0,
              duration: 180,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
          ]),
        ]),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(labelOpacity, {
          toValue: 0,
          duration: 150,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(labelTranslateX, {
          toValue: -4,
          duration: 150,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 220,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isExpanded, scale, labelOpacity, labelTranslateX]);

  const translateX = tx.interpolate({
    inputRange: [-1, 1],
    outputRange: [-layout.ampX, layout.ampX],
  });
  const translateY = ty.interpolate({
    inputRange: [-1, 1],
    outputRange: [-layout.ampY, layout.ampY],
  });

  // Bij label-links invertoen we de slide-richting zodat hij vanuit de pill
  // "uitschuift" in plaats van er vandaan.
  const labelTranslateXFinal = labelGoesLeft
    ? labelTranslateX.interpolate({
        inputRange: [-4, 0],
        outputRange: [4, 0],
      })
    : labelTranslateX;

  const handlePress = (e: GestureResponderEvent) => {
    // Stop bubbling zodat de parent Pressable geen single-tap naar group-overlay triggert.
    e?.stopPropagation?.();
    onPress();
  };

  const accessibilityLabel = label ? `${label}, ${count}` : `${emoji}, ${count}`;

  return (
    <Animated.View
      style={[
        styles.pillWrap,
        {
          left: layout.x,
          top: layout.y,
          zIndex: isExpanded ? 10 : 1,
          elevation: isExpanded ? 6 : 0,
          transform: [{ translateX }, { translateY }, { scale }],
        },
      ]}
    >
      <Pressable
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        hitSlop={4}
        style={styles.pill}
      >
        <Text style={styles.pillEmoji}>{emoji}</Text>
        <Text style={styles.pillCount}> {count}</Text>
      </Pressable>
      {label ? (
        <Animated.Text
          numberOfLines={1}
          ellipsizeMode="tail"
          pointerEvents="none"
          style={[
            styles.pillLabel,
            labelGoesLeft
              ? { right: '100%', marginRight: space[1], textAlign: 'right' }
              : { left: '100%', marginLeft: space[1] },
            {
              opacity: labelOpacity,
              transform: [{ translateX: labelTranslateXFinal }],
            },
          ]}
        >
          {label}
        </Animated.Text>
      ) : null}
    </Animated.View>
  );
}

// ─── HeartBurst ─────────────────────────────────────────────────────────────

interface HeartBurstProps {
  /** Tap-positie (relatief aan item-container) waar burst verschijnt. */
  x: number;
  y: number;
  /** Doel-positie (midden van like-knop, relatief aan container). */
  targetX: number;
  targetY: number;
  onComplete: () => void;
}

/**
 * Instagram-stijl dubbele-tik hart:
 *  1. (0-400ms)   scale 0 → 1.3 → 1.0, opacity 0 → 1 — verschijnt op tap-punt
 *  2. (400-500ms) hold
 *  3. (500-900ms) vliegt naar like-knop (target), krimpt & fade
 *
 * Twee gestapelde iconen (streepsRed + magenta, kleine X-offset) geven een
 * chromatische glitch-vibe.
 */
function HeartBurst({ x, y, targetX, targetY, onComplete }: HeartBurstProps) {
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const fly = useRef(new Animated.Value(0)).current; // 0 = op tap-punt, 1 = op target

  useEffect(() => {
    Animated.sequence([
      // Fase 1: appear met overshoot
      Animated.parallel([
        Animated.timing(scale, {
          toValue: 1.3,
          duration: 250,
          easing: Easing.out(Easing.back(2)),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(scale, {
        toValue: 1.0,
        duration: 150,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
      // Fase 2: hold
      Animated.delay(100),
      // Fase 3: fly to target + shrink + fade
      Animated.parallel([
        Animated.timing(fly, {
          toValue: 1,
          duration: 400,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 0.3,
          duration: 400,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 400,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      onComplete();
    });
    // We willen dit precies éénmaal laten lopen per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Burst vertrekt bij tap-punt (x, y) en eindigt bij target.
  // De View zit ge-"center-anchor"d: we plaatsen de top-left op (x - ICON/2, y - ICON/2)
  // en animeren translateX/Y van 0 naar (target - tap).
  const dx = targetX - x;
  const dy = targetY - y;

  const translateX = fly.interpolate({
    inputRange: [0, 1],
    outputRange: [0, dx],
  });
  const translateY = fly.interpolate({
    inputRange: [0, 1],
    outputRange: [0, dy],
  });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View
        style={[
          styles.burstWrap,
          {
            left: x - BURST_ICON_SIZE / 2,
            top: y - BURST_ICON_SIZE / 2,
            opacity,
            transform: [{ translateX }, { translateY }, { scale }],
          },
        ]}
        pointerEvents="none"
      >
        {/* Laag 1: streepsRed (licht links) */}
        <Ionicons
          name="heart"
          size={BURST_ICON_SIZE}
          color={brand.streepsRed}
          style={[styles.burstIcon, { transform: [{ translateX: -2 }] }]}
        />
        {/* Laag 2: magenta (licht rechts) */}
        <Ionicons
          name="heart"
          size={BURST_ICON_SIZE}
          color={brand.magenta}
          style={[styles.burstIcon, { transform: [{ translateX: 2 }] }]}
        />
      </Animated.View>
    </View>
  );
}

// ─── LikeButton ─────────────────────────────────────────────────────────────

interface LikeButtonProps {
  liked: boolean;
  onPress: () => void;
}

function LikeButton({ liked, onPress }: LikeButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    // Scale-bounce bij elke flip
    Animated.sequence([
      Animated.spring(scale, {
        toValue: 0.8,
        useNativeDriver: true,
        damping: 14,
        stiffness: 260,
      }),
      Animated.spring(scale, {
        toValue: 1.15,
        useNativeDriver: true,
        damping: 10,
        stiffness: 220,
      }),
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        damping: 12,
        stiffness: 200,
      }),
    ]).start();
  }, [liked, scale]);

  const handlePress = (e: GestureResponderEvent) => {
    // Stop bubbling zodat de parent-Pressable geen tap registreert
    e?.stopPropagation?.();
    if (liked) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      hitSlop={LIKE_HIT_SLOP}
      style={styles.likeBtnWrap}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <Ionicons
          name={liked ? 'heart' : 'heart-outline'}
          size={LIKE_ICON_SIZE}
          color={liked ? brand.magenta : brand.streepsWhite}
        />
      </Animated.View>
    </Pressable>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────

export default function ExploreFeedItem({
  group,
  isLive,
  drinkCounts,
  onPress,
  seedKey,
  liked,
  onToggleLike,
}: ExploreFeedItemProps) {
  // Wordt ingevuld door onLayout; default valt terug op een redelijke breedte.
  const [containerWidth, setContainerWidth] = useState(0);

  const seed = `${group.id}:${seedKey ?? ''}:${drinkCounts.length}`;

  const layouts = useMemo(
    () =>
      containerWidth > 0
        ? computePillLayouts(drinkCounts.length, containerWidth, seed)
        : [],
    [drinkCounts.length, containerWidth, seed],
  );

  // ── Double-tap detectie ────────────────────────────────────────────────────
  const lastTapRef = useRef(0);
  const singleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Pill expand state ─────────────────────────────────────────────────────
  const [expandedPillId, setExpandedPillId] = useState<string | null>(null);
  const collapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlePillPress = useCallback((pillId: string) => {
    if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
    setExpandedPillId(pillId);
    collapseTimerRef.current = setTimeout(() => {
      setExpandedPillId(null);
      collapseTimerRef.current = null;
    }, 2500);
  }, []);

  // Cleanup collapse-timer bij unmount.
  useEffect(() => {
    return () => {
      if (collapseTimerRef.current) {
        clearTimeout(collapseTimerRef.current);
        collapseTimerRef.current = null;
      }
    };
  }, []);

  // ── Burst-animatie state (increment key per burst → forceer remount) ──────
  const [burstKey, setBurstKey] = useState(0);
  const [burstX, setBurstX] = useState(0);
  const [burstY, setBurstY] = useState(0);

  // Target voor fly-to = midden van like-knop.
  // Knop staat op: left=HORIZONTAL_PADDING, bottom=space[2], icon-size=22.
  // → centerX = HORIZONTAL_PADDING + LIKE_ICON_SIZE/2
  // → centerY = ITEM_HEIGHT - space[2] - LIKE_ICON_SIZE/2
  const likeTargetX = HORIZONTAL_PADDING + LIKE_ICON_SIZE / 2;
  const likeTargetY = ITEM_HEIGHT - space[2] - LIKE_ICON_SIZE / 2;

  // Cleanup: pending single-tap timer afbreken bij unmount
  useEffect(() => {
    return () => {
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
        singleTapTimerRef.current = null;
      }
    };
  }, []);

  const triggerBurst = useCallback((x: number, y: number) => {
    setBurstX(x);
    setBurstY(y);
    setBurstKey((k) => k + 1);
  }, []);

  const handleDoubleTap = useCallback(
    (x: number, y: number) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      // Like als nog niet geliked; burst speelt altijd af (ook al-geliked =
      // Instagram-style bevestiging, geen unlike).
      if (!liked) {
        onToggleLike();
      }
      triggerBurst(x, y);
    },
    [liked, onToggleLike, triggerBurst],
  );

  const handlePress = useCallback(
    (e: GestureResponderEvent) => {
      const now = Date.now();
      const { locationX, locationY } = e.nativeEvent;

      if (now - lastTapRef.current < DOUBLE_TAP_MS) {
        // Double tap: cancel pending single-tap en trigger burst
        if (singleTapTimerRef.current) {
          clearTimeout(singleTapTimerRef.current);
          singleTapTimerRef.current = null;
        }
        lastTapRef.current = 0;
        handleDoubleTap(locationX, locationY);
        return;
      }
      lastTapRef.current = now;
      // Defer single-tap action (opent overlay) met DOUBLE_TAP_MS
      singleTapTimerRef.current = setTimeout(() => {
        singleTapTimerRef.current = null;
        onPress();
      }, DOUBLE_TAP_MS);
    },
    [handleDoubleTap, onPress],
  );

  return (
    <Pressable
      onPress={handlePress}
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
          const pillId = d.drinkId ?? `${d.emoji}-${i}`;
          return (
            <FloatingPill
              key={`${d.emoji}-${i}`}
              layout={layout}
              emoji={d.emoji}
              count={d.count}
              label={d.name}
              pillId={pillId}
              isExpanded={expandedPillId === pillId}
              onPress={() => handlePillPress(pillId)}
              containerWidth={containerWidth}
            />
          );
        })}

      {/* LIVE-badge rechts onder */}
      {isLive && (
        <View style={styles.liveBadgeWrap} pointerEvents="none">
          <LiveBadge size="sm" />
        </View>
      )}

      {/* Like-knop links onder (Pressable vangt eigen tap, parent niet) */}
      <View style={styles.likeBtnAbsolute}>
        <LikeButton liked={liked} onPress={onToggleLike} />
      </View>

      {/* Heart-burst overlay — remount per burst via key */}
      {burstKey > 0 && (
        <HeartBurst
          key={burstKey}
          x={burstX}
          y={burstY}
          targetX={likeTargetX}
          targetY={likeTargetY}
          onComplete={() => {
            // Laat burstKey staan; volgende burst increment hem verder.
            // Component unmount automatisch doordat we hem op-key niet meer
            // renderen — maar omdat burstKey > 0 blijft, blijft hij in de tree.
            // Dat is OK: opacity is 0, pointerEvents=none.
          }}
        />
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
  pillWrap: {
    position: 'absolute',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[2],
    paddingVertical: space[1],
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  pillLabel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    textAlignVertical: 'center',
    maxWidth: 120,
    color: brand.streepsWhite,
    fontSize: 12,
    lineHeight: 28,
    fontFamily: 'Unbounded',
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
  likeBtnAbsolute: {
    position: 'absolute',
    left: HORIZONTAL_PADDING,
    bottom: space[2],
    // Ensure the button sits visually & tap-prioritized above the row
    zIndex: 2,
  },
  likeBtnWrap: {
    width: LIKE_ICON_SIZE,
    height: LIKE_ICON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  burstWrap: {
    position: 'absolute',
    width: BURST_ICON_SIZE,
    height: BURST_ICON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  burstIcon: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
});
