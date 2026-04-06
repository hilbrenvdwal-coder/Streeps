import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, Pressable, View, Animated, Easing, Platform } from 'react-native';
import { AuroraPresetView, type AuroraPreset } from './AuroraBackground';

/**
 * Category Row — Figma nodes 122:36, 122:89, 122:80, 122:71
 *
 * 350×50, borderRadius 25, aurora blob background per category.
 * Font: Unbounded 20px regular, white. Name left, price right.
 * Gap between rows: 9px (handled by parent via marginBottom).
 *
 * Selected state: animated glow border + shadow (same pattern as AI chat input glow).
 */

interface CategoryRowProps {
  name: string;
  price: number;       // cents
  color: string;       // kept for selected glow color
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
// Each layer is a different hue — real aurora color combos, not just lighter variants
const CATEGORY_AURORA: Record<number, string[]> = {
  1: ['#00BEAE', '#4A6CF7', '#00FE96', '#8B5CF6'],  // teal → blauw → groen → paars
  2: ['#FF004D', '#FF00F5', '#FF6B00', '#8B5CF6'],  // rood → magenta → oranje → paars
  3: ['#4A6CF7', '#00BEAE', '#8B5CF6', '#00FE96'],  // blauw → teal → paars → groen
  4: ['#8B5CF6', '#FF004D', '#4A6CF7', '#FF00F5'],  // paars → rood → blauw → magenta
};

// Glow shadow + border colors per category (theme color)
const GLOW_COLORS: Record<number, string> = {
  1: '#00BEAE',
  2: '#FF004D',
  3: '#4A6CF7',
  4: '#8B5CF6',
};

const GLOW_BORDER_COLORS: Record<number, string> = {
  1: '#00D9A3',
  2: '#FF3377',
  3: '#6B8AFF',
  4: '#A47BFF',
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

  // Shared glow animation value
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(glowAnim, {
      toValue: selected ? 1 : 0,
      duration: 150,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: false,
    }).start();
  }, [selected]);

  // Glow interpolations (same pattern as AI chat input)
  const glowBorderWidth = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1.5] });
  const glowBorderColor = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['transparent', GLOW_BORDER_COLORS[catKey]],
  });
  const glowShadowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.7] });

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
      {/* Press scale wrapper (native driver) — must be separate from glow (non-native) */}
      <Animated.View style={{ transform: [{ scale: pressScale }] }}>
        {/* Glow wrapper — shadow animates in (non-native driver) */}
        <Animated.View
          style={[
            s.glowWrap,
            {
              shadowColor: GLOW_COLORS[catKey],
              shadowOpacity: glowShadowOpacity,
              ...(Platform.OS === 'android' ? { elevation: selected ? 8 : 0 } : {}),
            },
          ]}
        >
          {/* Bar — fixed size, no animated margin/border */}
          <View style={s.bar}>
            <View style={s.auroraContainer} pointerEvents="none">
              <AuroraPresetView preset={preset} colors={CATEGORY_AURORA[catKey]} animated={selected} noMask />
            </View>
            <Text style={s.name}>{name}</Text>
            <Text style={s.price}>{priceStr}</Text>
          </View>
          {/* Absolute border overlay — does NOT affect layout */}
          <Animated.View
            style={[
              s.borderOverlay,
              {
                borderWidth: glowBorderWidth,
                borderColor: glowBorderColor,
              },
            ]}
            pointerEvents="none"
          />
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  wrapper: { marginBottom: 9 },
  glowWrap: {
    borderRadius: 25,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 8,
  },
  borderOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 25,
  },
  bar: {
    width: 350,
    maxWidth: '100%',
    alignSelf: 'center',
    height: 50,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    overflow: 'hidden',
  },
  auroraContainer: {
    position: 'absolute',
    // Aurora is 380x80 (mask bbox), bar is 350x50
    // Center: left = (350-380)/2 = -15, top = (50-80)/2 = -15
    top: -15,
    left: -15,
    width: 380,
    height: 80,
  },
  name: {
    fontFamily: 'Unbounded',
    fontSize: 20,
    fontWeight: '400',
    color: '#FFFFFF',
    zIndex: 1,
  },
  price: {
    fontFamily: 'Unbounded',
    fontSize: 20,
    fontWeight: '400',
    color: '#FFFFFF',
    zIndex: 1,
  },
});
