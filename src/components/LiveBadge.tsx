import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { brand } from '@/src/theme';

// ─── Types ────────────────────────────────────────────────────────────────────

type LiveBadgeSize = 'sm' | 'md';

interface LiveBadgeProps {
  /** 'sm' voor feed-item (default), 'md' voor avatar-rij hoekje */
  size?: LiveBadgeSize;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function LiveBadge({ size = 'sm' }: LiveBadgeProps) {
  const isMd = size === 'md';

  return (
    <View style={styles.container}>
      <Text style={[styles.dot, isMd && styles.dotMd]}>{'•'}</Text>
      <Text style={[styles.label, isMd && styles.labelMd]}>LIVE</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,254,150,0.15)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    gap: 3,
  },
  dot: {
    color: brand.green,
    fontSize: 9,
    lineHeight: 14,
  },
  dotMd: {
    fontSize: 8,
  },
  label: {
    color: brand.green,
    fontSize: 9,
    fontFamily: 'Unbounded',
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  labelMd: {
    fontSize: 8,
  },
});
