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

/**
 * LIVE-indicator pill. Dot-grootte matcht de LIVE-badge op het home-screen
 * (8×8pt) — een echte circle View in plaats van een bullet-char zodat het
 * visueel identiek is aan de rest van de app.
 */
export function LiveBadge({ size = 'sm' }: LiveBadgeProps) {
  const isMd = size === 'md';

  return (
    <View style={styles.container}>
      <View style={[styles.dot, isMd && styles.dotMd]} />
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
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 5,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: brand.green,
  },
  dotMd: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    color: brand.green,
    fontSize: 10,
    fontFamily: 'Unbounded',
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  labelMd: {
    fontSize: 9,
  },
});
