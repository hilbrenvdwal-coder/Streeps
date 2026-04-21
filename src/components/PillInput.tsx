import React, { useState } from 'react';
import { StyleSheet, View, TextInput, Pressable, type TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius, colors } from '@/src/theme';

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
    borderRadius: radius.full,
    // TODO(theme-migration): components.input.pill.backgroundColor is '#E8E8F0' — differs from Figma login pill '#D9D9D9' by visible hue/luminance. Kept hardcoded.
    backgroundColor: '#D9D9D9',
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 26,
    paddingRight: 18,
  },
  input: {
    flex: 1,
    // TODO(theme-migration): no matching typography token for fontSize 15 (body=16, bodySm=14); keeping custom to avoid hierarchy shift.
    fontSize: 15,
    color: colors.dark.text.inverse,
    height: 50,
  },
  eye: {
    marginLeft: 8,
  },
});
