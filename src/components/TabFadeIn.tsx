import React, { useRef, useCallback } from 'react';
import { Animated, Easing, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  from?: number;
  duration?: number;
};

export default function TabFadeIn({ children, style, from = 0.4, duration = 220 }: Props) {
  const opacity = useRef(new Animated.Value(1)).current;

  useFocusEffect(
    useCallback(() => {
      opacity.setValue(from);
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      return undefined;
    }, [from, duration, opacity])
  );

  return (
    <Animated.View style={[styles.fill, style, { opacity }]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
