import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AuroraPresetView } from './AuroraBackground';

/**
 * Aurora background for auth screens — uses the 'login' preset
 * with 8 PNG shapes exported from Login screen.svg.
 */

export default function AuroraLogin() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={['#0E0D1C', '#202020']}
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
