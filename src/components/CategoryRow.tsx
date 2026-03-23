import React from 'react';
import { StyleSheet, View, Text, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { type Theme } from '@/src/theme';

interface CategoryRowProps {
  name: string;
  price: number; // in cents
  color: string;
  selected?: boolean;
  onPress: () => void;
  theme: Theme;
}

export default function CategoryRow({ name, price, color, selected, onPress, theme: t }: CategoryRowProps) {
  const priceStr = `\u20AC ${(price / 100).toFixed(2).replace('.', ',')}`;

  return (
    <Pressable onPress={onPress} style={styles.wrapper}>
      <LinearGradient
        colors={[color + '30', color + '10', 'transparent']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={[
          styles.bar,
          selected && { borderWidth: 2, borderColor: color },
        ]}
      >
        <Text style={[styles.name, { color: t.colors.text.primary }]}>{name}</Text>
        <Text style={[styles.price, { color: t.colors.text.primary }]}>{priceStr}</Text>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 8,
  },
  bar: {
    height: 50,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
  },
  price: {
    fontSize: 16,
    fontWeight: '600',
  },
});
