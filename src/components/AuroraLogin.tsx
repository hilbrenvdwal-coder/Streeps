import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AuroraPresetView } from './AuroraBackground';
import { brand } from '@/src/theme';

/**
 * Aurora background for auth screens — uses the 'login' preset
 * with 8 PNG shapes exported from Login screen.svg.
 */

export default function AuroraLogin() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        // TODO(theme-migration): second stop '#202020' does not match brand.bg.to (#141414) — hue differs, keeping exact value
        colors={[brand.bg.from, '#202020']}
        locations={[0, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.auroraWrap}>
        <AuroraPresetView preset="login" animated gentle />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  auroraWrap: {
    position: 'absolute',
    left: -100,
    top: -120,
    zIndex: 0,
  },
});
