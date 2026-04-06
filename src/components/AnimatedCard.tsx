import React, { useEffect, useRef } from 'react';
import { Animated, AccessibilityInfo, ViewStyle } from 'react-native';

interface AnimatedCardProps {
  index: number;
  children: React.ReactNode;
  staggerDelay?: number;
  translateY?: number;
  enabled?: boolean;
  style?: ViewStyle;
}

export function AnimatedCard({
  index,
  children,
  staggerDelay = 35,
  translateY: initialTranslateY = 16,
  enabled = true,
  style,
}: AnimatedCardProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(initialTranslateY)).current;

  useEffect(() => {
    if (!enabled) return;

    // Reset to start values when enabled transitions to true
    opacity.setValue(0);
    translateY.setValue(initialTranslateY);

    AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (reduceMotion) {
        opacity.setValue(1);
        translateY.setValue(0);
        return;
      }

      const delay = index * staggerDelay;

      Animated.parallel([
        Animated.spring(opacity, {
          toValue: 1,
          delay,
          damping: 20,
          stiffness: 180,
          mass: 1,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          delay,
          damping: 20,
          stiffness: 180,
          mass: 1,
          useNativeDriver: true,
        }),
      ]).start();
    });
  }, [enabled]);

  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <Animated.View style={[{ opacity, transform: [{ translateY }] }, style]}>
      {children}
    </Animated.View>
  );
}
