import React from 'react';
import { StyleSheet, View, Text, Pressable } from 'react-native';
import { type Theme } from '@/src/theme';

interface CounterControlProps {
  value: number;
  onIncrement: () => void;
  onDecrement: () => void;
  theme: Theme;
}

export default function CounterControl({ value, onIncrement, onDecrement, theme: t }: CounterControlProps) {
  return (
    <View style={styles.row}>
      {/* Minus */}
      <Pressable
        style={[styles.btn, { borderColor: t.brand.magenta, borderWidth: 2 }]}
        onPress={onDecrement}
      >
        <Text style={[styles.btnIcon, { color: t.brand.magenta }]}>{'\u2212'}</Text>
      </Pressable>

      {/* Counter display */}
      <View style={[styles.display, { backgroundColor: t.colors.surface.raised }]}>
        <Text style={[styles.value, { color: t.colors.text.primary }]}>{value}</Text>
      </View>

      {/* Plus */}
      <Pressable
        style={[styles.btn, { borderColor: t.brand.green, borderWidth: 2 }]}
        onPress={onIncrement}
      >
        <Text style={[styles.btnIcon, { color: t.brand.green }]}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  btn: {
    width: 73,
    height: 73,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnIcon: {
    fontSize: 28,
    fontWeight: '700',
  },
  display: {
    width: 73,
    height: 73,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontSize: 32,
    fontWeight: '700',
  },
});
