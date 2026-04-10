import React, { useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  Pressable,
  View,
  Animated,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

/**
 * Category Row — Premium glassmorphism pill selector
 *
 * 350×50, borderRadius 25, dark frosted glass background.
 * Category color is used as a subtle left accent bar + selected glow.
 * Font: Unbounded 18px. Name left (with color dot), price right.
 * Gap between rows: 9px (handled by parent via marginBottom).
 *
 * Selected state: color accent intensifies, glow border, elevated shadow, inner shimmer.
 * Unselected state: muted frosted glass with subtle color hint.
 */

interface CategoryRowProps {
  name: string;
  price: number;       // cents
  color: string;       // category accent color
  categoryIndex?: number; // 1–4
  selected?: boolean;
  onPress: () => void;
}

// Per-category color configs for rich visual treatment
const CATEGORY_ACCENTS: Record<number, {
  glow: string;
  glowLight: string;
  gradientStart: string;
  gradientEnd: string;
  dotColor: string;
}> = {
  1: {
    glow: '#00BEAE',
    glowLight: '#00BEAE40',
    gradientStart: '#00BEAE18',
    gradientEnd: '#00BEAE04',
    dotColor: '#00BEAE',
  },
  2: {
    glow: '#FF004D',
    glowLight: '#FF004D40',
    gradientStart: '#FF004D18',
    gradientEnd: '#FF004D04',
    dotColor: '#FF004D',
  },
  3: {
    glow: '#4A6CF7',
    glowLight: '#4A6CF740',
    gradientStart: '#4A6CF718',
    gradientEnd: '#4A6CF704',
    dotColor: '#4A6CF7',
  },
  4: {
    glow: '#8B5CF6',
    glowLight: '#8B5CF640',
    gradientStart: '#8B5CF618',
    gradientEnd: '#8B5CF604',
    dotColor: '#8B5CF6',
  },
};

export default function CategoryRow({
  name,
  price,
  color,
  categoryIndex = 1,
  selected,
  onPress,
}: CategoryRowProps) {
  const priceStr = `\u20AC ${(price / 100).toFixed(2).replace('.', ',')}`;
  const catKey = ((categoryIndex - 1) % 4) + 1;
  const accent = CATEGORY_ACCENTS[catKey];

  // ─── Selection animation (spring-based) ───
  const selectAnim = useRef(new Animated.Value(selected ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(selectAnim, {
      toValue: selected ? 1 : 0,
      damping: 18,
      stiffness: 180,
      mass: 0.8,
      useNativeDriver: false,
    }).start();
  }, [selected]);

  // ─── Press scale animation (spring-based, native driver) ───
  const pressScale = useRef(new Animated.Value(1)).current;

  const onPressIn = () => {
    Animated.spring(pressScale, {
      toValue: 0.965,
      damping: 15,
      stiffness: 200,
      useNativeDriver: true,
    }).start();
  };

  const onPressOut = () => {
    Animated.spring(pressScale, {
      toValue: 1,
      damping: 12,
      stiffness: 160,
      useNativeDriver: true,
    }).start();
  };

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  // ─── Animated interpolations ───

  // Border glow
  const borderColor = selectAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [`${accent.glow}15`, `${accent.glow}90`],
  });

  const borderWidth = selectAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.5],
  });

  // Background opacity shift
  const bgOpacity = selectAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.6, 1],
  });

  // Accent bar width animation
  const accentBarWidth = selectAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [3, 3.5],
  });

  // Accent bar opacity
  const accentBarOpacity = selectAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 1],
  });

  // Dot glow scale
  const dotScale = selectAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.85, 1],
  });

  // Shadow intensity (iOS only)
  const shadowOpacity = selectAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.5],
  });

  const shadowRadius = selectAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 16],
  });

  // Price text color shift
  const priceColor = selectAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#666680', '#A0A0B8'],
  });

  // Name text color shift
  const nameColor = selectAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#C8C8D8', '#FFFFFF'],
  });

  // Inner gradient overlay opacity
  const shimmerOpacity = selectAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.35],
  });

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={s.wrapper}
    >
      {/* Scale wrapper (native driver) */}
      <Animated.View style={{ transform: [{ scale: pressScale }] }}>
        {/* Shadow/glow wrapper (non-native for color interpolation) */}
        <Animated.View
          style={[
            s.shadowWrap,
            Platform.OS === 'ios'
              ? {
                  shadowColor: accent.glow,
                  shadowOpacity: shadowOpacity,
                  shadowRadius: shadowRadius,
                  shadowOffset: { width: 0, height: 2 },
                }
              : {
                  elevation: selected ? 6 : 0,
                },
          ]}
        >
          {/* Main pill container */}
          <Animated.View
            style={[
              s.pill,
              {
                borderWidth: borderWidth,
                borderColor: borderColor,
              },
            ]}
          >
            {/* Frosted glass background */}
            <Animated.View style={[s.glassBase, { opacity: bgOpacity }]} />

            {/* Category color gradient wash — subtle left-to-right */}
            <LinearGradient
              colors={[accent.gradientStart, accent.gradientEnd, 'transparent'] as [string, string, ...string[]]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 0.7, y: 0.5 }}
              style={s.colorWash}
              pointerEvents="none"
            />

            {/* Selected shimmer — top highlight line */}
            <Animated.View style={[s.shimmerOverlay, { opacity: shimmerOpacity }]} pointerEvents="none">
              <LinearGradient
                colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.02)', 'transparent'] as [string, string, ...string[]]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFillObject}
              />
            </Animated.View>

            {/* Left accent bar */}
            <Animated.View
              style={[
                s.accentBar,
                {
                  width: accentBarWidth,
                  opacity: accentBarOpacity,
                  backgroundColor: accent.glow,
                },
              ]}
              pointerEvents="none"
            />

            {/* Content row */}
            <View style={s.content}>
              {/* Left: dot + name */}
              <View style={s.nameGroup}>
                <Animated.View
                  style={[
                    s.dot,
                    {
                      backgroundColor: accent.dotColor,
                      transform: [{ scale: dotScale }],
                    },
                  ]}
                >
                  {/* Inner glow of dot */}
                  <View style={[s.dotInner, { backgroundColor: accent.glow }]} />
                </Animated.View>
                <Animated.Text style={[s.name, { color: nameColor }]}>
                  {name}
                </Animated.Text>
              </View>

              {/* Right: price */}
              <Animated.Text style={[s.price, { color: priceColor }]}>
                {priceStr}
              </Animated.Text>
            </View>
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  wrapper: {
    marginBottom: 9,
  },

  shadowWrap: {
    borderRadius: 25,
  },

  pill: {
    width: 350,
    maxWidth: '100%',
    alignSelf: 'center',
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
    position: 'relative',
  },

  // Dark frosted glass base
  glassBase: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1A1A2E',
  },

  // Subtle category color wash from left
  colorWash: {
    ...StyleSheet.absoluteFillObject,
  },

  // Shimmer overlay for selected state
  shimmerOverlay: {
    ...StyleSheet.absoluteFillObject,
  },

  // Vertical accent bar on the left edge
  accentBar: {
    position: 'absolute',
    left: 0,
    top: 10,
    bottom: 10,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
  },

  // Content layout
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 20,
    paddingRight: 24,
    height: '100%',
  },

  nameGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  // Color indicator dot
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },

  dotInner: {
    width: 4,
    height: 4,
    borderRadius: 2,
    opacity: 0.6,
  },

  name: {
    fontFamily: 'Unbounded',
    fontSize: 18,
    fontWeight: '400',
  },

  price: {
    fontFamily: 'Unbounded',
    fontSize: 16,
    fontWeight: '400',
    // Tabular figures for consistent price alignment
    fontVariant: ['tabular-nums'],
  },
});
