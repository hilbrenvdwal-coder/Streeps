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
import { brand, colors, components, radius, space, typography } from '@/src/theme';

const CLEARSCREEN_IMG = require('../../assets/clearscreen.png');
const CLEARSCREEN_ASPECT = 681 / 305;

const SPLASH_MESSAGES: Record<string, string[]> = {
  '1': ['Eentje kan geen kwaad', 'Proostje!', 'Een goede keuze'],
  '2': ['Twee is altijd beter', 'Lekker bezig!', 'Dubbel genieten'],
  '3': ['Drie is een feestje', 'Het gaat lekker!', 'Hattrick!'],
  '4': ['Vier?! Toe maar!', 'Jij gaat lekker', 'Gezellig hoor'],
  '5': ['Vijf stuks, respect!', 'Jij houdt van gezelligheid', 'Dat wordt een avond'],
};
const SPLASH_MESSAGES_6PLUS = ['Jij meent het!', 'Gaat lekker vanavond!', 'Ik tel niet meer mee', 'Legendestatus'];

function getSplashMessage(count: number): string {
  if (count === 67) return '67 ahaha, maar je bent niet serieus toch?';
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

  // Clearscreen sweep
  const sweepY = useRef(new Animated.Value(0)).current;
  const sweepOpacity = useRef(new Animated.Value(0)).current;

  const SWEEP_W = SCREEN_H * CLEARSCREEN_ASPECT * 1.1;
  const SWEEP_H = SWEEP_W / CLEARSCREEN_ASPECT;

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
      sweepY.setValue(SCREEN_H);
      sweepOpacity.setValue(0);

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

    // Fire onConfirm immediately
    onConfirm();

    sweepY.setValue(SCREEN_H);
    sweepOpacity.setValue(0);

    // Skip button pulse — start close animation directly
    Animated.sequence([
      // Card shrink + sheet slide + sweep
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
        Animated.timing(sweepY, {
          toValue: -SWEEP_H,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(sweepOpacity, {
          toValue: 1,
          duration: 150,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scrimOpacity, {
          toValue: 0,
          duration: 900,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
      // Fade out everything
      Animated.parallel([
        Animated.timing(sweepOpacity, {
          toValue: 0,
          duration: 300,
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

        {/* Clearscreen sweep */}
        <Animated.Image
          source={CLEARSCREEN_IMG}
          style={[
            s.sweepImage,
            {
              width: SWEEP_W,
              height: SWEEP_H,
              left: 0,
              top: 0,
              opacity: sweepOpacity,
              transform: [
                { translateX: (SCREEN_W - SWEEP_W) / 2 },
                { translateY: sweepY },
              ],
            },
          ]}
          resizeMode="stretch"
          pointerEvents="none"
        />

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
                      shadowColor: brand.green,
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
                <Ionicons name="checkmark-sharp" size={24} color={colors.dark.text.inverse} />
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
    // Sheet bg kept as rgba literal per addendum (custom translucent backdrop); no exact token match
    backgroundColor: 'rgba(10, 10, 12, 0.65)',
    // TODO(theme-migration): sheet borderTopRadius 25 kept literal; no exact radius scale match (xl=20, 2xl=24). components.modal.borderRadius=20 would shift -5px which exceeds 4px threshold.
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    paddingHorizontal: space[5],
    paddingBottom: space[10],
    alignItems: 'center',
    overflow: 'hidden',
  },
  handle: {
    width: components.modal.handleWidth,
    height: components.modal.handleHeight,
    borderRadius: 2,
    // Handle bg kept as rgba literal per addendum (translucent white over blur)
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginTop: 10,
    marginBottom: space[5],
  },
  title: {
    fontFamily: 'Unbounded-SemiBold',
    fontSize: typography.heading2.fontSize,
    color: colors.dark.text.primary,
    textAlign: 'center',
    marginBottom: space[5],
  },

  // Info Card
  infoCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    // TODO(theme-migration): infoCard bg #1A1A1C mapped to colors.dark.surface.default (#252540); +10 luminance shift + hue moves neutral -> bluish, exceeds 4px perceptual threshold
    backgroundColor: colors.dark.surface.default,
    borderRadius: radius.lg,
    padding: space[4],
    marginBottom: space[6],
    alignSelf: 'stretch',
  },
  infoLeft: {
    marginRight: space[4],
    alignItems: 'center',
  },
  countContainer: {
    minWidth: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space[1],
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
    fontSize: typography.tally.fontSize,
    color: colors.dark.text.primary,
    lineHeight: typography.tally.lineHeight,
  },
  creditBadge: {
    position: 'absolute',
    top: -4,
    right: -8,
    // Credit badge bg kept as rgba literal per addendum (semi-transparent green tint)
    backgroundColor: 'rgba(0, 217, 163, 0.25)',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  creditText: {
    fontFamily: 'Unbounded',
    // TODO(theme-migration): creditText fontSize 11 = typography.overline.fontSize, mapped
    fontSize: typography.overline.fontSize,
    color: brand.cyan,
    fontWeight: '600',
  },
  infoRight: {
    flex: 1,
    justifyContent: 'space-evenly',
  },
  catBadge: {
    paddingHorizontal: space[3],
    paddingVertical: 6,
    borderRadius: 10,
    marginBottom: space[1],
    alignSelf: 'flex-start',
  },
  catBadgeText: {
    fontFamily: 'Unbounded',
    // TODO(theme-migration): catBadgeText fontSize 15 kept literal; no exact typography scale match (bodySm=14, body=16)
    fontSize: 15,
  },
  pricePerUnit: {
    fontFamily: 'Unbounded',
    fontSize: typography.bodySm.fontSize,
    color: colors.dark.text.secondary,
    marginBottom: 2,
  },
  totalPrice: {
    fontFamily: 'Unbounded-Medium',
    fontSize: typography.body.fontSize,
    color: brand.cyan,
  },

  // Splash message
  splashText: {
    fontFamily: 'Unbounded',
    // TODO(theme-migration): splashText fontSize 13 kept literal; no exact typography scale match
    fontSize: 13,
    // Splash text color kept as rgba literal per addendum (translucent white)
    color: 'rgba(255, 255, 255, 0.4)',
    textAlign: 'center',
    marginTop: 0,
    marginBottom: space[4],
  },

  // Actions
  confirmBtn: {
    alignSelf: 'stretch',
    height: 56,
    borderRadius: radius.lg,
    backgroundColor: brand.green,
    overflow: 'hidden',
    marginBottom: space[3],
  },
  confirmBtnInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
  },
  confirmText: {
    fontFamily: 'Unbounded-SemiBold',
    fontSize: typography.body.fontSize,
    color: colors.dark.text.inverse,
  },
  cancelBtn: {
    alignSelf: 'stretch',
    height: 48,
    borderRadius: radius.full,
    borderWidth: 1,
    // Cancel border kept as rgba literal per addendum (translucent white)
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontFamily: 'Unbounded',
    fontSize: typography.bodySm.fontSize,
    color: colors.dark.text.secondary,
  },

  // Clearscreen sweep
  sweepImage: {
    position: 'absolute',
  },
});
