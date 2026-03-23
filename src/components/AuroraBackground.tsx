import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { aurora } from '@/src/theme';

export default function AuroraBackground() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={['#0F0F1E', '#1A1A2E', '#0F0F1E']}
        style={StyleSheet.absoluteFill}
      />
      {/* Pink blob — top right */}
      <View style={[styles.blob, styles.pink]} />
      {/* Green blob — top left */}
      <View style={[styles.blob, styles.green]} />
      {/* Purple blob — center top */}
      <View style={[styles.blob, styles.purple]} />
    </View>
  );
}

const styles = StyleSheet.create({
  blob: {
    position: 'absolute',
    borderRadius: 9999,
  },
  pink: {
    width: 300,
    height: 300,
    top: -80,
    right: -60,
    backgroundColor: aurora.pink,
  },
  green: {
    width: 280,
    height: 280,
    top: -60,
    left: -40,
    backgroundColor: aurora.green,
  },
  purple: {
    width: 260,
    height: 260,
    top: -20,
    left: 80,
    backgroundColor: aurora.purple,
  },
});
