import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Animated, Easing, StyleSheet, View, Text, Pressable, Modal, Platform, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
  credit = 0,
  onConfirm,
  onCancel,
}: Props) {
  const { width: SCREEN_W, height: SCREEN_H } = useWindowDimensions();
  const [show, setShow] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const slideY = useRef(new Animated.Value(300)).current;

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
      Animated.parallel([
        Animated.timing(overlayOpacity, { toValue: 1, duration: 250, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(slideY, { toValue: 0, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
    } else if (show && !confirming) {
      Animated.parallel([
        Animated.timing(overlayOpacity, { toValue: 0, duration: 200, easing: Easing.in(Easing.ease), useNativeDriver: true }),
        Animated.timing(slideY, { toValue: 300, duration: 250, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      ]).start(() => setShow(false));
    }
  }, [visible]);

  const handleConfirm = useCallback(() => {
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
        <Animated.View style={[s.overlayBg, { opacity: overlayOpacity }]} />

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
          <Pressable style={s.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={s.handle} />
            <Text style={s.title}>Weet je zeker dat je</Text>
            <View style={s.counterBox}>
              <Text style={s.counterValue}>{count}</Text>
              {credit > 0 && (
                <View style={s.creditBadge}>
                  <Text style={s.creditText}>-{Math.min(credit, count)}</Text>
                </View>
              )}
            </View>
            <Text style={s.subtitle}>
              {categoryName} streepjes wilt toevoegen?
            </Text>
            <Pressable style={s.confirmBtn} onPress={handleConfirm} disabled={confirming}>
              <Ionicons name="checkmark-sharp" size={80} color="#FFFFFF" style={s.checkIcon} />
            </Pressable>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlayBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
  },
  sheet: {
    backgroundColor: 'rgba(21, 21, 21, 0.92)',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    paddingHorizontal: 20,
    paddingBottom: 40,
    alignItems: 'center',
  },
  handle: {
    width: 142,
    height: 4,
    borderRadius: 3,
    backgroundColor: 'rgba(217, 217, 217, 0.46)',
    marginTop: 8,
    marginBottom: 24,
  },
  title: {
    fontFamily: 'Unbounded',
    fontSize: 24,
    fontWeight: '400',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 20,
  },
  counterBox: {
    width: 75,
    height: 75,
    borderRadius: 16,
    backgroundColor: 'rgba(61, 61, 61, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    ...Platform.select({
      ios: { shadowColor: '#FF0085', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 12 },
      android: { elevation: 4 },
      default: {},
    }),
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
  subtitle: {
    fontFamily: 'Unbounded',
    fontSize: 16,
    fontWeight: '400',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  confirmBtn: {
    alignSelf: 'stretch',
    marginHorizontal: 20,
    marginBottom: 24,
    height: 180,
    borderRadius: 25,
    backgroundColor: '#00FE96',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: '#00FE96', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 15.5 },
      android: { elevation: 8 },
      default: {},
    }),
  },
  checkIcon: {
    // Make the checkmark visually bolder with text shadow
    ...Platform.select({
      ios: { shadowColor: 'rgba(255,255,255,0.5)', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 4 },
      default: {},
    }),
  },

  // Aurora flash — scale transforms from view center (245, 185).
  // Blobs sit at ~(180, 16), which is 169px above view center.
  // So place view center 169px below screen center to compensate.
  flashWrap: {
    position: 'absolute',
    width: 490,
    height: 370,
    overflow: 'visible',
  },
});
