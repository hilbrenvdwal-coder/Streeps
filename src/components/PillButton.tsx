import React, { useRef } from 'react';
import { StyleSheet, Text, Pressable, Animated, Platform, type ViewStyle, type TextStyle } from 'react-native';
import { brand, radius, fontWeights, animation, getTheme } from '@/src/theme';

const theme = getTheme('dark');

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
  color = brand.magenta,
  textColor = theme.colors.text.primary,
  glow,
  onPress,
  disabled,
  style,
  textStyle,
}: PillButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () =>
    Animated.timing(scale, { toValue: animation.press.scale, duration: 150, useNativeDriver: true }).start();
  const onPressOut = () =>
    Animated.timing(scale, { toValue: 1, duration: 250, useNativeDriver: true }).start();

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        style={[
          styles.button,
          { backgroundColor: color, shadowColor: color },
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
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
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
    fontWeight: fontWeights.bold,
  },
  disabled: {
    opacity: animation.disabled.opacity,
  },
});
