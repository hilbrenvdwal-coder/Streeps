import React, { useState } from 'react';
import { StyleSheet, View, TextInput, Pressable, type TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface PillInputProps extends Omit<TextInputProps, 'style'> {
  isPassword?: boolean;
  style?: any;
}

/**
 * Pill-shaped input matching Figma login screen.
 * Figma: 278×50, borderRadius full, bg light gray,
 * text at padding-left 26px from input edge,
 * eye icon 16×16 at right edge with 18px padding.
 */
export default function PillInput({ isPassword, style, ...props }: PillInputProps) {
  const [hidden, setHidden] = useState(true);

  return (
    <View style={[styles.wrapper, style]}>
      <TextInput
        {...props}
        secureTextEntry={isPassword && hidden}
        placeholderTextColor="rgba(100, 100, 120, 0.7)"
        style={styles.input}
      />
      {isPassword && (
        <Pressable onPress={() => setHidden((h) => !h)} style={styles.eye} hitSlop={8}>
          <Ionicons
            name={hidden ? 'eye-off-outline' : 'eye-outline'}
            size={16}
            color="rgba(100, 100, 120, 0.6)"
          />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    height: 50,
    borderRadius: 9999,
    backgroundColor: '#D9D9D9',
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 26,
    paddingRight: 18,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#1A1A2E',
    height: 50,
  },
  eye: {
    marginLeft: 8,
  },
});
