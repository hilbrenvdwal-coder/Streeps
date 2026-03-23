import React, { useRef } from 'react';
import { StyleSheet, Text, Pressable, Animated, Platform, type ViewStyle, type TextStyle } from 'react-native';

interface PillButtonProps {
  title: string;
  color?: string;
  textColor?: string;
  glow?: object;
  onPress: () => void;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export default function PillButton({
  title,
  color = '#E91E8C',
  textColor = '#FFFFFF',
  glow,
  onPress,
  disabled,
  style,
  textStyle,
}: PillButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () =>
    Animated.timing(scale, { toValue: 0.97, duration: 150, useNativeDriver: true }).start();
  const onPressOut = () =>
    Animated.timing(scale, { toValue: 1, duration: 250, useNativeDriver: true }).start();

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        style={[
          styles.button,
          { backgroundColor: color },
          glow,
          disabled && styles.disabled,
        ]}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={disabled}
      >
        <Text style={[styles.text, { color: textColor }, textStyle]}>{title}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 52,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#E91E8C',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 16,
      },
      android: { elevation: 6 },
      default: {},
    }),
  },
  text: {
    fontSize: 18,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.38,
  },
});
