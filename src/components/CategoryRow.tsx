import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, Pressable, View, Animated, Easing } from 'react-native';
import { AuroraPresetView, type AuroraPreset } from './AuroraBackground';

/**
 * Category Row — Figma nodes 122:36, 122:89, 122:80, 122:71
 *
 * 350×50, borderRadius 25, aurora blob background per category.
 * Font: Unbounded 20px regular, white. Name left, price right.
 * Gap between rows: 9px (handled by parent via marginBottom).
 */

interface CategoryRowProps {
  name: string;
  price: number;       // cents
  color: string;       // kept for selected border color
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

// Streeps brand colors with slight per-ellipse variation
const BRAND_AURORA = ['#FF0085', '#FF00F5', '#00BEAE', '#00FE96'];

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

  // Animate price scale on selection
  const priceScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(priceScale, {
      toValue: selected ? 1.15 : 1,
      duration: 200,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [selected]);

  return (
    <Pressable onPress={onPress} style={s.wrapper}>
      <View style={s.bar}>
        <View style={s.auroraContainer} pointerEvents="none">
          <AuroraPresetView preset={preset} colors={BRAND_AURORA} animated={selected} />
        </View>
        <Text style={s.name}>{name}</Text>
        <Animated.Text style={[s.price, { transform: [{ scale: priceScale }] }]}>
          {priceStr}
        </Animated.Text>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  wrapper: { marginBottom: 9 },
  bar: {
    height: 50,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
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
