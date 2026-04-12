import React, { useCallback, useEffect } from 'react';
import { StyleSheet, Pressable, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolateColor,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

/**
 * CategoryRow — pill-shaped category selector button.
 *
 * Styled to match the catBadge pattern used elsewhere in the app:
 * tinted background in the category color, clean and simple.
 */

interface CategoryRowProps {
  name: string;
  price: number;       // cents
  color: string;       // category accent color
  categoryIndex?: number;
  selected?: boolean;
  onPress: () => void;
}

const SPRING_CONFIG = { damping: 18, stiffness: 200 };
const TRANSITION_DURATION = 220;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function CategoryRow({
  name,
  price,
  color,
  categoryIndex = 1,
  selected = false,
  onPress,
}: CategoryRowProps) {
  const priceStr = `\u20AC ${(price / 100).toFixed(2).replace('.', ',')}`;

  // Press scale
  const scale = useSharedValue(1);

  // State-transition progress (0 = inactive, 1 = active)
  const selectedProgress = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    selectedProgress.value = withTiming(selected ? 1 : 0, {
      duration: TRANSITION_DURATION,
      easing: Easing.out(Easing.ease),
    });
  }, [selected, selectedProgress]);

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.97, SPRING_CONFIG);
  }, []);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, SPRING_CONFIG);
  }, []);

  const handlePress = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  }, [onPress]);

  const pillAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    backgroundColor: interpolateColor(
      selectedProgress.value,
      [0, 1],
      [color + '1F', color]
    ),
  }));

  const nameAnimatedStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      selectedProgress.value,
      [0, 1],
      [color, '#0F0F1E']
    ),
    fontWeight: '400' as const,
  }));

  const priceAnimatedStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      selectedProgress.value,
      [0, 1],
      [color + '99', 'rgba(15,15,30,0.65)']
    ),
    fontWeight: '400' as const,
  }));

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[s.pill, pillAnimatedStyle]}
    >
      <Animated.Text style={[s.name, nameAnimatedStyle]}>
        {name}
      </Animated.Text>
      <Animated.Text style={[s.price, priceAnimatedStyle]}>
        {priceStr}
      </Animated.Text>
    </AnimatedPressable>
  );
}

const s = StyleSheet.create({
  pill: {
    height: 50,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  name: {
    fontFamily: 'Unbounded',
    fontSize: 18,
  },
  price: {
    fontFamily: 'Unbounded',
    fontSize: 15,
  },
});
