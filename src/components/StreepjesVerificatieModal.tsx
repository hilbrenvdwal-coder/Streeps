import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  View,
  Text,
  Pressable,
  Modal,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { AuroraPresetView } from './AuroraBackground';

const FLASH_AURORA_COLORS = ['#00FE96', '#F1F1F1', '#00BEAE', '#FFFFFF'];

const SPLASH_MESSAGES: Record<string, string[]> = {
  '1': ['Eentje kan geen kwaad', 'Proostje!', 'Een goede keuze'],
  '2': ['Twee is altijd beter', 'Lekker bezig!', 'Dubbel genieten'],
  '3': ['Drie is een feestje', 'Het gaat lekker!', 'Hattrick!'],
  '4': ['Vier?! Toe maar!', 'Jij gaat lekker', 'Gezellig hoor'],
  '5': ['Vijf stuks, respect!', 'Jij houdt van gezelligheid', 'Dat wordt een avond'],
};
const SPLASH_MESSAGES_6PLUS = ['Jij meent het!', 'Gaat lekker vanavond!', 'Ik tel niet meer mee', 'Legendestatus'];

function getSplashMessage(count: number): string {
  const pool = count >= 6 ? SPLASH_MESSAGES_6PLUS : (SPLASH_MESSAGES[String(count)] ?? SPLASH_MESSAGES_6PLUS);
  return pool[Math.floor(Math.random() * pool.length)];
}

interface Props {
  visible: boolean;
  count: number;
  categoryName: string;
  categoryColor: string;
  categoryPrice?: number; // price per tally in cents
  credit?: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function StreepjesVerificatieModal({
  visible,
  count,
  categoryName,
  categoryColor,
  categoryPrice,
  credit = 0,
  onConfirm,
  onCancel,
}: Props) {
  const { width: SCREEN_W, height: SCREEN_H } = useWindowDimensions();
  const [show, setShow] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // Animations
  const scrimOpacity = useRef(new Animated.Value(0)).current;
  const slideY = useRef(new Animated.Value(300)).current;
  const cardScale = useRef(new Animated.Value(0.8)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const confirmScale = useRef(new Animated.Value(1)).current;

  // Aurora flash
  const flashScale = useRef(new Animated.Value(0)).current;
  const flashOpacity = useRef(new Animated.Value(0)).current;

  // Price calculations (prices are in cents)
  const hasPrice = categoryPrice != null && categoryPrice > 0;
  const pricePerUnit = hasPrice ? (categoryPrice / 100).toFixed(2).replace('.', ',') : null;
  const totalPrice = hasPrice ? ((categoryPrice * count) / 100).toFixed(2).replace('.', ',') : null;

  // Splash message — stable per count value, changes when count changes
  const splashMessage = useMemo(() => getSplashMessage(count), [count]);

  useEffect(() => {
    if (visible) {
      setShow(true);
      setConfirming(false);
      scrimOpacity.setValue(0);
      slideY.setValue(300);
      cardScale.setValue(0.8);
      cardOpacity.setValue(0);
      confirmScale.setValue(1);
      flashScale.setValue(0);
      flashOpacity.setValue(0);

      Animated.parallel([
        // Scrim fade in
        Animated.timing(scrimOpacity, {
          toValue: 1,
          duration: 250,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        // Sheet spring up
        Animated.spring(slideY, {
          toValue: 0,
          damping: 20,
          stiffness: 180,
          mass: 1,
          useNativeDriver: true,
        }),
        // Info card stagger
        Animated.sequence([
          Animated.delay(100),
          Animated.parallel([
            Animated.spring(cardScale, {
              toValue: 1,
              damping: 16,
              stiffness: 160,
              mass: 1,
              useNativeDriver: true,
            }),
            Animated.timing(cardOpacity, {
              toValue: 1,
              duration: 250,
              easing: Easing.out(Easing.ease),
              useNativeDriver: true,
            }),
          ]),
        ]),
      ]).start();
    } else if (show && !confirming) {
      // Close cancel
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Animated.parallel([
        Animated.timing(slideY, {
          toValue: 300,
          duration: 250,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(scrimOpacity, {
          toValue: 0,
          duration: 200,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start(() => setShow(false));
    }
  }, [visible]);

  const handleConfirm = useCallback(() => {
    setConfirming(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Fire onConfirm immediately — don't wait for animation
    onConfirm();

    flashScale.setValue(0);
    flashOpacity.setValue(0);

    // Confirm pulse + card shrink + sheet slide down + aurora flash
    Animated.sequence([
      // Confirm button pulse
      Animated.sequence([
        Animated.spring(confirmScale, {
          toValue: 1.05,
          damping: 10,
          stiffness: 300,
          mass: 1,
          useNativeDriver: true,
        }),
        Animated.spring(confirmScale, {
          toValue: 1,
          damping: 10,
          stiffness: 300,
          mass: 1,
          useNativeDriver: true,
        }),
      ]),
      // Card shrink + sheet slide + aurora
      Animated.parallel([
        Animated.timing(cardScale, {
          toValue: 0.8,
          duration: 200,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(cardOpacity, {
          toValue: 0,
          duration: 200,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(slideY, {
          toValue: 600,
          duration: 300,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(flashOpacity, {
          toValue: 1,
          duration: 400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.spring(flashScale, {
          toValue: 1,
          damping: 14,
          stiffness: 120,
          mass: 1,
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(250),
      // Fade out everything
      Animated.parallel([
        Animated.timing(flashOpacity, {
          toValue: 0,
          duration: 400,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scrimOpacity, {
          toValue: 0,
          duration: 400,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      setShow(false);
      setConfirming(false);
    });
  }, [onConfirm]);

  const handleCancel = useCallback(() => {
    if (confirming) return;
    onCancel();
  }, [confirming, onCancel]);

  if (!show) return null;

  const flashTransform = {
    opacity: flashOpacity,
    transform: [
      {
        scale: flashScale.interpolate({
          inputRange: [0, 1],
          outputRange: [0.3, 2.5],
        }),
      },
    ],
  };

  return (
    <Modal visible transparent animationType="none">
      <Pressable style={{ flex: 1 }} onPress={handleCancel}>
        {/* Blurred backdrop */}
        <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: scrimOpacity }]}>
          <BlurView
            intensity={30}
            tint="dark"
            style={StyleSheet.absoluteFillObject}
            experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined}
          />
          <View style={s.scrim} />
        </Animated.View>

        {/* Aurora flash -- real aurora preset, scaled to fill screen */}
        <Animated.View
          style={[
            s.flashWrap,
            { top: SCREEN_H / 2 - 16, left: SCREEN_W / 2 - 180 },
            flashTransform,
          ]}
          pointerEvents="none"
        >
          <AuroraPresetView
            preset="header"
            colors={FLASH_AURORA_COLORS}
            animated
          />
        </Animated.View>

        <View style={{ flex: 1 }} />

        {/* Sheet */}
        <Animated.View style={{ transform: [{ translateY: slideY }] }}>
          <Pressable style={s.sheet} onPress={(e) => e.stopPropagation()}>
            <BlurView
              intensity={40}
              tint="dark"
              style={StyleSheet.absoluteFillObject}
              experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined}
            />
            {/* Zone 1: Header */}
            <View style={s.handle} />
            <Text style={s.title}>Bevestig je streepjes</Text>

            {/* Zone 2: Info Card */}
            <Animated.View
              style={[
                s.infoCard,
                {
                  transform: [{ scale: cardScale }],
                  opacity: cardOpacity,
                },
              ]}
            >
              {/* Left: count */}
              <View style={s.infoLeft}>
                <View style={s.countContainer}>
                  <Text style={s.countText}>{count}</Text>
                </View>
                {credit > 0 && (
                  <View style={s.creditBadge}>
                    <Text style={s.creditText}>-{Math.min(credit, count)}</Text>
                  </View>
                )}
              </View>

              {/* Right: stacked info */}
              <View style={s.infoRight}>
                <View style={[s.catBadge, { backgroundColor: categoryColor + '20' }]}>
                  <Text style={[s.catBadgeText, { color: categoryColor }]} numberOfLines={1}>
                    {categoryName}
                  </Text>
                </View>
                {hasPrice && (
                  <Text style={s.pricePerUnit}>
                    {'\u20AC'}{pricePerUnit} per stuk
                  </Text>
                )}
              </View>
            </Animated.View>

            {/* Splash message */}
            <Text style={s.splashText}>{splashMessage}</Text>

            {/* Zone 3: Actions */}
            <Animated.View
              style={[
                s.confirmBtn,
                {
                  transform: [{ scale: confirmScale }],
                  ...Platform.select({
                    ios: {
                      shadowColor: '#00FE96',
                      shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: 0.5,
                      shadowRadius: 16,
                    },
                    android: { elevation: 8 },
                    default: {},
                  }),
                },
              ]}
            >
              <Pressable
                style={s.confirmBtnInner}
                onPress={handleConfirm}
                disabled={confirming}
                android_ripple={{ color: 'rgba(0,0,0,0.15)' }}
              >
                <Ionicons name="checkmark-sharp" size={24} color="#1A1A2E" />
                <Text style={s.confirmText}>Bevestig</Text>
              </Pressable>
            </Animated.View>

            <Pressable
              style={s.cancelBtn}
              onPress={handleCancel}
              disabled={confirming}
            >
              <Text style={s.cancelText}>Annuleren</Text>
            </Pressable>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  sheet: {
    backgroundColor: 'rgba(10, 10, 12, 0.65)',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    paddingHorizontal: 20,
    paddingBottom: 40,
    alignItems: 'center',
    overflow: 'hidden',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginTop: 10,
    marginBottom: 20,
  },
  title: {
    fontFamily: 'Unbounded-SemiBold',
    fontSize: 22,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 20,
  },

  // Info Card
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1C',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    alignSelf: 'stretch',
  },
  infoLeft: {
    marginRight: 16,
    alignItems: 'center',
  },
  countContainer: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countGlow: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    opacity: 0.15,
  },
  countText: {
    fontFamily: 'Unbounded-SemiBold',
    fontSize: 48,
    color: '#FFFFFF',
    lineHeight: 56,
  },
  creditBadge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: 'rgba(0, 217, 163, 0.25)',
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
  infoRight: {
    flex: 1,
    justifyContent: 'center',
  },
  catBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 4,
    alignSelf: 'flex-start',
  },
  catBadgeText: {
    fontFamily: 'Unbounded',
    fontSize: 12,
  },
  pricePerUnit: {
    fontFamily: 'Unbounded',
    fontSize: 14,
    color: '#A0A0B8',
    marginBottom: 2,
  },
  totalPrice: {
    fontFamily: 'Unbounded-Medium',
    fontSize: 16,
    color: '#00BEAE',
  },

  // Splash message
  splashText: {
    fontFamily: 'Unbounded',
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.4)',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 16,
  },

  // Actions
  confirmBtn: {
    alignSelf: 'stretch',
    height: 56,
    borderRadius: 16,
    backgroundColor: '#00FE96',
    overflow: 'hidden',
    marginBottom: 12,
  },
  confirmBtnInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  confirmText: {
    fontFamily: 'Unbounded-SemiBold',
    fontSize: 16,
    color: '#1A1A2E',
  },
  cancelBtn: {
    alignSelf: 'stretch',
    height: 48,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontFamily: 'Unbounded',
    fontSize: 14,
    color: '#A0A0B8',
  },

  // Aurora flash
  flashWrap: {
    position: 'absolute',
    width: 490,
    height: 370,
    overflow: 'visible',
  },
});
