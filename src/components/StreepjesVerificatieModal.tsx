import React from 'react';
import { StyleSheet, View, Text, Pressable, Modal, Image } from 'react-native';
import { brand } from '@/src/theme';
import type { Theme } from '@/src/theme';

interface Props {
  visible: boolean;
  count: number;
  categoryName: string;
  categoryColor: string;
  onConfirm: () => void;
  onCancel: () => void;
  theme: Theme;
}

export default function StreepjesVerificatieModal({
  visible,
  count,
  categoryName,
  categoryColor,
  onConfirm,
  onCancel,
  theme: t,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <Pressable style={styles.overlay} onPress={onCancel}>
        <Pressable style={[styles.sheet, { backgroundColor: t.colors.surface.raised }]} onPress={(e) => e.stopPropagation()}>
          {/* Handle */}
          <View style={[styles.handle, { backgroundColor: t.colors.border.strong }]} />

          {/* Title */}
          <Text style={[styles.title, { color: t.colors.text.primary }]}>
            Weet je zeker dat je
          </Text>

          {/* Counter display */}
          <View style={[styles.counterBox, { backgroundColor: t.colors.surface.default }]}>
            <Text style={[styles.counterValue, { color: t.colors.text.primary }]}>{count}</Text>
          </View>

          {/* Category text */}
          <Text style={[styles.subtitle, { color: t.colors.text.secondary }]}>
            <Text style={{ color: categoryColor, fontWeight: '700' }}>{categoryName}</Text>
            {' '}streepjes wilt toevoegen?
          </Text>

          {/* Green confirm button */}
          <Pressable
            style={[styles.confirmBtn, t.glows.green]}
            onPress={onConfirm}
          >
            <Image
              source={require('../../logo_dark.png')}
              style={styles.confirmLogo}
              resizeMode="contain"
            />
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    alignItems: 'center',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 20,
  },
  counterBox: {
    width: 75,
    height: 75,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  counterValue: {
    fontSize: 36,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 26,
  },
  confirmBtn: {
    width: '100%',
    height: 180,
    borderRadius: 25,
    backgroundColor: brand.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmLogo: {
    width: 80,
    height: 80,
    tintColor: '#FFFFFF',
  },
});
