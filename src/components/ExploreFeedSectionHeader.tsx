import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { brand, colors, space, typography } from '@/src/theme';

interface ExploreFeedSectionHeaderProps {
  label: string;
  variant?: 'default' | 'muted';
}

/**
 * Section header voor de Explore-feed. Default is uppercase overline;
 * muted-variant (voor suggesties-sectie) is iets lichter en niet uppercase.
 */
export default function ExploreFeedSectionHeader({
  label,
  variant = 'default',
}: ExploreFeedSectionHeaderProps) {
  return (
    <View style={styles.wrap}>
      <Text style={variant === 'muted' ? styles.labelMuted : styles.labelDefault}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: space[4],
    paddingTop: space[4],
    paddingBottom: space[2],
  },
  labelDefault: {
    ...typography.overline,
    fontFamily: 'Unbounded',
    color: brand.inactive,
  },
  labelMuted: {
    ...typography.caption,
    fontFamily: 'Unbounded',
    color: colors.dark.text.tertiary,
    fontWeight: '500',
  },
});
