import React, { useState } from 'react';
import { StyleSheet, View, TextInput, Pressable, type TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface PillInputProps extends Omit<TextInputProps, 'style'> {
  isPassword?: boolean;
  style?: any;
}

export default function PillInput({ isPassword, style, ...props }: PillInputProps) {
  const [hidden, setHidden] = useState(true);

  return (
    <View style={[styles.wrapper, style]}>
      <TextInput
        {...props}
        secureTextEntry={isPassword && hidden}
        placeholderTextColor="#999"
        style={styles.input}
      />
      {isPassword && (
        <Pressable onPress={() => setHidden((h) => !h)} style={styles.eye} hitSlop={8}>
          <Ionicons name={hidden ? 'eye-off-outline' : 'eye-outline'} size={20} color="#888" />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    height: 52,
    borderRadius: 9999,
    backgroundColor: '#E8E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1A1A2E',
    height: 52,
  },
  eye: {
    marginLeft: 8,
  },
});
