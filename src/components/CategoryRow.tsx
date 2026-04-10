import React, { useCallback } from 'react';
import { StyleSheet, Text, Pressable, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
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

  const scaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[
        s.pill,
        {
          backgroundColor: selected ? color + '25' : color + '10',
          borderColor: selected ? color + '60' : color + '20',
        },
        scaleStyle,
      ]}
    >
      <Text style={[s.name, { color: selected ? '#FFFFFF' : 'rgba(255,255,255,0.6)' }]}>
        {name}
      </Text>
      <Text style={[s.price, { color: selected ? color : 'rgba(255,255,255,0.3)' }]}>
        {priceStr}
      </Text>
    </AnimatedPressable>
  );
}

const s = StyleSheet.create({
  pill: {
    height: 50,
    borderRadius: 25,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    marginBottom: 9,
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
  },
});
