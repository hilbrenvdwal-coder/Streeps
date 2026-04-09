import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Animated, Easing, StyleSheet, View, Text, Pressable, Modal, Platform, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { AuroraPresetView } from './AuroraBackground';
const FLASH_AURORA_COLORS = ['#00FE96', '#F1F1F1', '#00BEAE', '#FFFFFF'];

interface Props {
  visible: boolean;
  count: number;
  categoryName: string;
  categoryColor: string;
  credit?: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function StreepjesVerificatieModal({
  visible,
  count,
  categoryName,
  categoryColor,
  credit = 0,
  onConfirm,
  onCancel,
}: Props) {
  const { width: SCREEN_W, height: SCREEN_H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [show, setShow] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const slideY = useRef(new Animated.Value(300)).current;

  // Press scale for confirm button
  const pressScale = useRef(new Animated.Value(1)).current;
  const onPressIn = () => {
    Animated.spring(pressScale, { toValue: 0.97, useNativeDriver: true, damping: 15, stiffness: 200 }).start();
  };
  const onPressOut = () => {
    Animated.spring(pressScale, { toValue: 1, useNativeDriver: true, damping: 15, stiffness: 200 }).start();
  };

  // Aurora flash
  const flashScale = useRef(new Animated.Value(0)).current;
  const flashOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setShow(true);
      setConfirming(false);
      overlayOpacity.setValue(0);
      slideY.setValue(300);
      flashScale.setValue(0);
      flashOpacity.setValue(0);
      pressScale.setValue(1);
      Animated.parallel([
        Animated.timing(overlayOpacity, { toValue: 1, duration: 250, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.spring(slideY, { toValue: 0, damping: 20, stiffness: 200, mass: 1, useNativeDriver: true }),
      ]).start();
    } else if (show && !confirming) {
      Animated.parallel([
        Animated.timing(overlayOpacity, { toValue: 0, duration: 200, easing: Easing.in(Easing.ease), useNativeDriver: true }),
        Animated.timing(slideY, { toValue: 300, duration: 250, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      ]).start(() => setShow(false));
    }
  }, [visible]);

  const handleConfirm = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setConfirming(true);

    flashScale.setValue(0);
    flashOpacity.setValue(0);

    // Aurora flash — sheet slides down, aurora fades in
    Animated.sequence([
      Animated.parallel([
        Animated.timing(slideY, { toValue: 600, duration: 300, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        Animated.timing(flashOpacity, { toValue: 1, duration: 400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.spring(flashScale, { toValue: 1, damping: 14, stiffness: 120, mass: 1, useNativeDriver: true }),
      ]),
      Animated.delay(250),
      Animated.parallel([
        Animated.timing(flashOpacity, { toValue: 0, duration: 400, easing: Easing.in(Easing.ease), useNativeDriver: true }),
        Animated.timing(overlayOpacity, { toValue: 0, duration: 400, easing: Easing.in(Easing.ease), useNativeDriver: true }),
      ]),
    ]).start(() => {
      setShow(false);
      setConfirming(false);
      onConfirm();
    });
  }, [onConfirm]);

  if (!show) return null;

  const flashTransform = {
    opacity: flashOpacity,
    transform: [{
      scale: flashScale.interpolate({
        inputRange: [0, 1],
        outputRange: [0.3, 2.5],
      }),
    }],
  };

  return (
    <Modal visible transparent animationType="none">
      <Pressable style={{ flex: 1 }} onPress={confirming ? undefined : onCancel}>
        {/* Scrim: BlurView + dark overlay */}
        <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: overlayOpacity }]} pointerEvents="none">
          <BlurView
            intensity={30}
            tint="dark"
            experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={s.scrimOverlay} />
        </Animated.View>

        {/* Aurora flash — real aurora preset, scaled to fill screen */}
        <Animated.View style={[s.flashWrap, { top: SCREEN_H / 2 - 16, left: SCREEN_W / 2 - 180 }, flashTransform]} pointerEvents="none">
          <AuroraPresetView
            preset="header"
            colors={FLASH_AURORA_COLORS}
            animated
          />
        </Animated.View>

        <View style={{ flex: 1 }} />
        <Animated.View style={{ transform: [{ translateY: slideY }] }}>
          <Pressable style={[s.sheet, { paddingBottom: insets.bottom + 16 }]} onPress={(e) => e.stopPropagation()}>
            {/* Handle */}
            <View style={s.handle} />

            {/* Title */}
            <Text style={s.title}>Weet je zeker dat je</Text>

            {/* Counter box with category glow */}
            <View style={[s.counterBox, Platform.select({
              ios: { shadowColor: categoryColor, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 12 },
              android: { elevation: 4 },
              default: {},
            })]}>
              <Text style={s.counterValue}>{count}</Text>
              {credit > 0 && (
                <View style={s.creditBadge}>
                  <Text style={s.creditText}>-{Math.min(credit, count)}</Text>
                </View>
              )}
            </View>

            {/* Subtitle with category badge */}
            <View style={s.subtitleWrap}>
              <View style={[s.catBadge, { backgroundColor: categoryColor + '20' }]}>
                <Text style={[s.catBadgeText, { color: categoryColor }]}>{categoryName}</Text>
              </View>
              <Text style={s.subtitleText}> streepjes</Text>
            </View>
            <Text style={[s.subtitleText, { marginBottom: 32 }]}>wilt toevoegen?</Text>

            {/* Confirm button with press scale */}
            <Animated.View style={{ alignSelf: 'stretch', transform: [{ scale: pressScale }] }}>
              <Pressable
                style={s.confirmBtn}
                onPress={handleConfirm}
                onPressIn={onPressIn}
                onPressOut={onPressOut}
                disabled={confirming}
              >
                <Ionicons name="checkmark-circle" size={22} color="#0F0F1E" style={{ marginRight: 8 }} />
                <Text style={s.confirmText}>Bevestigen</Text>
              </Pressable>
            </Animated.View>

            {/* Cancel button */}
            <Pressable style={s.cancelBtn} onPress={confirming ? undefined : onCancel}>
              <Text style={s.cancelText}>Annuleren</Text>
            </Pressable>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  scrimOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: 'rgba(30,30,50,0.85)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginTop: 12,
    marginBottom: 28,
  },
  title: {
    fontFamily: 'Unbounded',
    fontSize: 20,
    fontWeight: '400',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 20,
  },
  counterBox: {
    width: 70,
    height: 70,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  counterValue: {
    fontFamily: 'Unbounded',
    fontSize: 32,
    fontWeight: '400',
    color: '#FFFFFF',
  },
  creditBadge: {
    position: 'absolute',
    top: -6,
    right: -10,
    backgroundColor: 'rgba(0,217,163,0.25)',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  creditText: {
    fontFamily: 'Unbounded',
    fontSize: 11,
    color: '#00BEAE',
    fontWeight: '600',
  },
  subtitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  catBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  catBadgeText: {
    fontFamily: 'Unbounded',
    fontSize: 14,
    fontWeight: '500',
  },
  subtitleText: {
    fontFamily: 'Unbounded',
    fontSize: 16,
    fontWeight: '400',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  confirmBtn: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    height: 56,
    borderRadius: 9999,
    backgroundColor: '#00FE96',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: '#00FE96', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 16 },
      android: { elevation: 8 },
      default: {},
    }),
  },
  confirmText: {
    fontFamily: 'Unbounded',
    fontSize: 18,
    fontWeight: '700',
    color: '#0F0F1E',
  },
  cancelBtn: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  cancelText: {
    fontFamily: 'Unbounded',
    fontSize: 16,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.5)',
  },

  // Aurora flash
  flashWrap: {
    position: 'absolute',
    width: 490,
    height: 370,
    overflow: 'visible',
  },
});
