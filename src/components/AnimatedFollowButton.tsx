import React, { useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { brand, radius, space, typography } from '@/src/theme';

interface AnimatedFollowButtonProps {
  onPress: () => Promise<void>;
  loading?: boolean;
}

/**
 * Mini-variant van de vriend-toevoeg-knop: "Volg" → "Volgend".
 * Blijft in "Volgend" state tot de parent de row verwijdert.
 */
export default function AnimatedFollowButton({ onPress, loading }: AnimatedFollowButtonProps) {
  const progress = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const [followed, setFollowed] = useState(false);
  const [busy, setBusy] = useState(false);

  const handlePress = async (e: any) => {
    e?.stopPropagation?.();
    if (followed || busy || loading) return;
    setBusy(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    Animated.sequence([
      Animated.spring(scale, { toValue: 0.95, useNativeDriver: true, damping: 14, stiffness: 260 }),
      Animated.spring(scale, { toValue: 1.05, useNativeDriver: true, damping: 10, stiffness: 220 }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, damping: 12, stiffness: 200 }),
    ]).start();

    Animated.timing(progress, {
      toValue: 1,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();

    try {
      await onPress();
      setFollowed(true);
    } catch {
      // Rollback bij error
      Animated.timing(progress, {
        toValue: 0,
        duration: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    } finally {
      setBusy(false);
    }
  };

  const bg = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [brand.cyan, brand.green],
  });
  const volgOpacity = progress.interpolate({ inputRange: [0, 0.4, 1], outputRange: [1, 0, 0] });
  const volgendOpacity = progress.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 0, 1] });

  return (
    <Pressable onPress={handlePress} hitSlop={6}>
      <Animated.View style={[styles.btn, { backgroundColor: bg, transform: [{ scale }] }]}>
        <Animated.View style={[styles.contentRow, { opacity: volgOpacity }]}>
          <Text style={styles.label}>Volg</Text>
        </Animated.View>
        <Animated.View style={[styles.contentRow, styles.contentAbsolute, { opacity: volgendOpacity }]}>
          <Ionicons name="checkmark" size={14} color="#FFFFFF" style={styles.check} />
          <Text style={styles.label}>Volgend</Text>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    minWidth: 82,
    height: 32,
    borderRadius: radius.full,
    paddingHorizontal: space[3],
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentAbsolute: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  label: {
    ...typography.captionMedium,
    fontFamily: 'Unbounded',
    fontWeight: '600',
    color: '#FFFFFF',
  },
  check: {
    marginRight: space[1],
  },
});
