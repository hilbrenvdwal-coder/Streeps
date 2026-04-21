import React, { useId } from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { colors } from '@/src/theme';

interface AvatarPlaceholderProps {
  size: number;
  label: string;
  borderRadius?: number;
  fontSize?: number;
  style?: StyleProp<ViewStyle>;
}

export default function AvatarPlaceholder({
  size,
  label,
  borderRadius,
  fontSize,
  style,
}: AvatarPlaceholderProps) {
  const radius = borderRadius ?? size / 2;
  const textSize = fontSize ?? Math.round(size * 0.4);
  const rawId = useId();
  const gradientId = `avatarGrad${rawId.replace(/:/g, '')}`;

  return (
    <View style={[styles.wrap, { width: size, height: size, borderRadius: radius }, style]}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFillObject}>
        <Defs>
          <RadialGradient id={gradientId} cx="50%" cy="50%" rx="50%" ry="50%" fx="50%" fy="50%">
            <Stop offset="0%" stopColor={colors.dark.surface.raised} stopOpacity="0.5" />
            <Stop offset="100%" stopColor={colors.dark.text.secondary} stopOpacity="0.5" />
          </RadialGradient>
        </Defs>
        <Rect width={size} height={size} rx={radius} ry={radius} fill={`url(#${gradientId})`} />
      </Svg>
      <Text style={[styles.label, { fontSize: textSize }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: 'Unbounded-Bold', color: colors.dark.text.primary, includeFontPadding: false },
});
