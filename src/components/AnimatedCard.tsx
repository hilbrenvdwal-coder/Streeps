import React, { useEffect } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withSpring,
  useReducedMotion,
} from 'react-native-reanimated';
import { ViewStyle } from 'react-native';

interface AnimatedCardProps {
  index: number;
  children: React.ReactNode;
  staggerDelay?: number;    // default 35ms
  translateY?: number;       // default 16px
  enabled?: boolean;         // default true
  style?: ViewStyle;
}

const SPRING_CONFIG = {
  damping: 20,
  stiffness: 180,
  mass: 1,
};

export function AnimatedCard({
  index,
  children,
  staggerDelay = 35,
  translateY: initialTranslateY = 16,
  enabled = true,
  style,
}: AnimatedCardProps) {
  const shouldReduceMotion = useReducedMotion();
  const opacity = useSharedValue(enabled && !shouldReduceMotion ? 0 : 1);
  const translateY = useSharedValue(enabled && !shouldReduceMotion ? initialTranslateY : 0);

  useEffect(() => {
    if (!enabled || shouldReduceMotion) return;
    const delay = index * staggerDelay;
    opacity.value = withDelay(delay, withSpring(1, SPRING_CONFIG));
    translateY.value = withDelay(delay, withSpring(0, SPRING_CONFIG));
  }, [enabled]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  if (!enabled || shouldReduceMotion) {
    return <>{children}</>;
  }

  return (
    <Animated.View style={[animatedStyle, style]}>
      {children}
    </Animated.View>
  );
}
