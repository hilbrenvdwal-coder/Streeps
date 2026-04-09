import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, Pressable, View, Animated, Easing, Platform } from 'react-native';
import { AuroraPresetView, type AuroraPreset } from './AuroraBackground';

/**
 * Category Row — badge-style selector
 *
 * Unselected: small pill/badge with category name (left) + subtle price (right)
 * Selected: badge lights up, aurora glow flows from badge rightward behind the row
 *
 * Uses AuroraPresetView (PNG-based aurora) for the glow effect.
 */

interface CategoryRowProps {
  name: string;
  price: number;       // cents
  color: string;       // category color for badge tinting
  categoryIndex?: number; // 1–4 → selects aurora preset
  selected?: boolean;
  onPress: () => void;
}

const CATEGORY_PRESETS: Record<number, AuroraPreset> = {
  1: 'normaal',
  2: 'speciaal',
  3: 'cat3',
  4: 'cat4',
};

// Per-category aurora colors: [outermost → innermost ellipse]
const CATEGORY_AURORA: Record<number, string[]> = {
  1: ['#00BEAE', '#4A6CF7', '#00FE96', '#8B5CF6'],
  2: ['#FF004D', '#FF00F5', '#FF6B00', '#8B5CF6'],
  3: ['#4A6CF7', '#00BEAE', '#8B5CF6', '#00FE96'],
  4: ['#8B5CF6', '#FF004D', '#4A6CF7', '#FF00F5'],
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
  const preset = CATEGORY_PRESETS[((categoryIndex - 1) % 4) + 1];
  const catKey = ((categoryIndex - 1) % 4) + 1;

  // Animation for aurora glow fade in/out
  const glowAnim = useRef(new Animated.Value(selected ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(glowAnim, {
      toValue: selected ? 1 : 0,
      duration: 200,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: false,
    }).start();
  }, [selected]);

  // Badge background interpolation: transparent-ish → fuller color
  const badgeBg = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [color + '20', color + '55'],
  });

  // Badge text color interpolation: category color → white
  const badgeTextColor = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [color, '#FFFFFF'],
  });

  // Price text color interpolation: subtle → bright white
  const priceColor = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#666680', '#FFFFFF'],
  });

  // Aurora container opacity
  const auroraOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  // Glow shadow opacity for selected state
  const shadowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.5],
  });

  // Press feedback: subtle scale
  const pressScale = useRef(new Animated.Value(1)).current;
  const onPressIn = () => {
    Animated.spring(pressScale, { toValue: 0.97, useNativeDriver: true, damping: 15, stiffness: 200 }).start();
  };
  const onPressOut = () => {
    Animated.spring(pressScale, { toValue: 1, useNativeDriver: true, damping: 15, stiffness: 200 }).start();
  };

  return (
    <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut} style={s.wrapper}>
      <Animated.View style={{ transform: [{ scale: pressScale }] }}>
        <Animated.View
          style={[
            s.row,
            {
              shadowColor: color,
              shadowOpacity: shadowOpacity,
              ...(Platform.OS === 'android' ? { elevation: selected ? 6 : 0 } : {}),
            },
          ]}
        >
          {/* Aurora glow background — fades in on selection */}
          <Animated.View style={[s.auroraWrap, { opacity: auroraOpacity }]} pointerEvents="none">
            <AuroraPresetView
              preset={preset}
              colors={CATEGORY_AURORA[catKey]}
              animated={selected}
              noMask
            />
          </Animated.View>

          {/* Badge pill with category name */}
          <Animated.View style={[s.badge, { backgroundColor: badgeBg }]}>
            <Animated.Text style={[s.badgeText, { color: badgeTextColor }]}>
              {name}
            </Animated.Text>
          </Animated.View>

          {/* Price */}
          <Animated.Text style={[s.price, { color: priceColor }]}>
            {priceStr}
          </Animated.Text>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const ROW_HEIGHT = 44;
const ROW_RADIUS = 22;

const s = StyleSheet.create({
  wrapper: { marginBottom: 9 },
  row: {
    height: ROW_HEIGHT,
    borderRadius: ROW_RADIUS,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingRight: 20,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 12,
  },
  auroraWrap: {
    position: 'absolute',
    // Aurora preset for category is 380x80 container
    // Center vertically: (44-80)/2 = -18, shift left so glow flows from badge rightward
    top: -18,
    left: -30,
    width: 380,
    height: 80,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    zIndex: 1,
  },
  badgeText: {
    fontFamily: 'Unbounded',
    fontSize: 13,
    fontWeight: '400',
  },
  price: {
    fontFamily: 'Unbounded',
    fontSize: 13,
    fontWeight: '400',
    zIndex: 1,
  },
});
