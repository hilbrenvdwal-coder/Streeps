import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, Pressable, View, Animated, Easing, Platform } from 'react-native';

/**
 * Category Row — pill-shaped row with left accent strip in category color.
 *
 * Height: 50, borderRadius: 25 (pill shape).
 * Font: Unbounded 20px regular, white. Name left, price right.
 * Gap between rows: 9px (handled by parent via marginBottom).
 *
 * Selected state: animated glow border + tinted background + shadow.
 */

interface CategoryRowProps {
  name: string;
  price: number;       // cents
  color: string;       // category color — used for accent, glow, selected tint
  categoryIndex?: number; // kept for API compat, not used for styling anymore
  selected?: boolean;
  onPress: () => void;
}

export default function CategoryRow({
  name,
  price,
  color,
  selected,
  onPress,
}: CategoryRowProps) {
  const priceStr = `\u20AC ${(price / 100).toFixed(2).replace('.', ',')}`;

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

  // Glow interpolations
  const animatedBg = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#252540', color + '15'],
  });
  const animatedBorderColor = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#2D2D44', color],
  });
  const animatedBorderWidth = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.5],
  });
  const animatedAccentWidth = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [3, 4],
  });
  const animatedPriceColor = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#A0A0B8', color],
  });
  const animatedShadowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.3],
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
      {/* Press scale wrapper (native driver) — must be separate from glow (non-native) */}
      <Animated.View style={{ transform: [{ scale: pressScale }] }}>
        {/* Glow wrapper — shadow animates in (non-native driver) */}
        <Animated.View
          style={[
            s.glowWrap,
            {
              shadowColor: color,
              shadowOpacity: animatedShadowOpacity,
              ...(Platform.OS === 'android' ? { elevation: selected ? 8 : 0 } : {}),
            },
          ]}
        >
          {/* Bar — responsive width, accent strip inside */}
          <Animated.View
            style={[
              s.bar,
              {
                backgroundColor: animatedBg,
                borderColor: animatedBorderColor,
                borderWidth: animatedBorderWidth,
              },
            ]}
          >
            {/* Left accent strip */}
            <Animated.View
              style={[
                s.accentStrip,
                {
                  backgroundColor: color,
                  width: animatedAccentWidth,
                },
              ]}
            />
            <Text style={s.name}>{name}</Text>
            <Animated.Text style={[s.price, { color: animatedPriceColor }]}>
              {priceStr}
            </Animated.Text>
          </Animated.View>
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
    shadowRadius: 12,
  },
  bar: {
    width: '100%',
    height: 50,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingLeft: 20,
    overflow: 'hidden',
  },
  accentStrip: {
    position: 'absolute',
    left: 0,
    top: 8,
    bottom: 8,
    borderRadius: 2,
  },
  name: {
    fontFamily: 'Unbounded',
    fontSize: 20,
    fontWeight: '400',
    color: '#FFFFFF',
  },
  price: {
    fontFamily: 'Unbounded',
    fontSize: 20,
    fontWeight: '400',
  },
});
