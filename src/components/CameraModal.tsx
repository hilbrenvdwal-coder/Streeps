import React, { useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  Animated,
  Easing,
  Modal,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import {
  colors,
  radius,
  typography,
  space,
  components,
  animation,
  streepsMagenta,
  streepsCyan,
} from '../theme';

// ─── Types ───────────────────────────────────────────────────────────────────

interface CameraModalProps {
  visible: boolean;
  onClose: () => void;
  onImageCaptured: (uri: string, mimeType?: string) => void;
  title?: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const SHEET_BG = '#1C1C1E';
const SURFACE = '#2C2C2E';
const TEXT_PRIMARY = colors.dark.text.primary;
const TEXT_SECONDARY = colors.dark.text.secondary;
const SCRIM_COLOR = colors.dark.scrim;
const SHEET_RADIUS = radius['2xl'];
const CARD_RADIUS = radius.lg;
const CARD_HEIGHT = 120;
const HANDLE_WIDTH = components.modal.handleWidth;
const HANDLE_HEIGHT = components.modal.handleHeight;
const PRESS_SCALE = animation.press.scale;

const MAGENTA = streepsMagenta;       // #FF0085
const MAGENTA_BG = 'rgba(255, 0, 133, 0.12)';
const CYAN = streepsCyan;             // #00BEAE
const CYAN_BG = 'rgba(0, 190, 174, 0.12)';

// ─── Component ───────────────────────────────────────────────────────────────

export default function CameraModal({
  visible,
  onClose,
  onImageCaptured,
  title = 'Kies een foto',
}: CameraModalProps) {
  const insets = useSafeAreaInsets();

  // ─── Animation values ──────────────────────────────────────────────────
  const scrimAnim = useRef(new Animated.Value(0)).current;
  const sheetAnim = useRef(new Animated.Value(0)).current;
  const cameraScale = useRef(new Animated.Value(1)).current;
  const galleryScale = useRef(new Animated.Value(1)).current;
  const [showModal, setShowModal] = React.useState(false);

  // ─── Open animation ───────────────────────────────────────────────────
  React.useEffect(() => {
    if (visible) {
      setShowModal(true);
      scrimAnim.setValue(0);
      sheetAnim.setValue(0);
      Animated.parallel([
        Animated.timing(scrimAnim, {
          toValue: 1,
          duration: 250,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.spring(sheetAnim, {
          toValue: 1,
          damping: 20,
          stiffness: 280,
          mass: 0.9,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  // ─── Close animation ──────────────────────────────────────────────────
  const animateClose = useCallback(() => {
    Animated.parallel([
      Animated.timing(scrimAnim, {
        toValue: 0,
        duration: 180,
        easing: Easing.bezier(0.4, 0, 0.6, 1),
        useNativeDriver: true,
      }),
      Animated.timing(sheetAnim, {
        toValue: 0,
        duration: 180,
        easing: Easing.bezier(0.4, 0, 0.6, 1),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowModal(false);
      onClose();
    });
  }, [onClose]);

  // ─── Press animations ─────────────────────────────────────────────────
  const animatePressIn = useCallback((scaleRef: Animated.Value) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.spring(scaleRef, {
      toValue: PRESS_SCALE,
      damping: 15,
      stiffness: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  const animatePressOut = useCallback((scaleRef: Animated.Value) => {
    Animated.spring(scaleRef, {
      toValue: 1,
      damping: 15,
      stiffness: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  // ─── Image picker handlers ────────────────────────────────────────────
  const handleCamera = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.5,
    });
    if (!result.canceled && result.assets[0]) {
      onImageCaptured(result.assets[0].uri, result.assets[0].mimeType ?? 'image/jpeg');
      animateClose();
    }
  }, [onImageCaptured, animateClose]);

  const handleGallery = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.5,
    });
    if (!result.canceled && result.assets[0]) {
      onImageCaptured(result.assets[0].uri, result.assets[0].mimeType ?? 'image/jpeg');
      animateClose();
    }
  }, [onImageCaptured, animateClose]);

  // ─── Early return ─────────────────────────────────────────────────────
  if (!showModal) return null;

  const sheetTranslate = sheetAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [300, 0],
  });

  // ─── Render ────────────────────────────────────────────────────────────
  return (
    <Modal visible={showModal} transparent animationType="none" statusBarTranslucent>
      {/* Scrim */}
      <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: scrimAnim }]}>
        <BlurView
          intensity={30}
          tint="dark"
          style={StyleSheet.absoluteFillObject}
          experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined}
        />
        <Pressable style={styles.scrim} onPress={animateClose} accessibilityLabel="Sluiten" />
      </Animated.View>

      {/* Bottom sheet */}
      <Animated.View
        style={[
          styles.sheet,
          {
            paddingBottom: insets.bottom + 12,
            transform: [{ translateY: sheetTranslate }],
          },
        ]}
      >
        <BlurView
          intensity={40}
          tint="dark"
          style={StyleSheet.absoluteFillObject}
          experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined}
        />
        {/* Drag handle */}
        <View style={styles.handle} />

        {/* Title */}
        <Text style={styles.title}>{title}</Text>

        {/* Option cards row */}
        <View style={styles.cardsRow}>
          {/* Camera card */}
          <Animated.View style={[styles.cardWrapper, { transform: [{ scale: cameraScale }] }]}>
            <Pressable
              style={styles.card}
              onPress={handleCamera}
              onPressIn={() => animatePressIn(cameraScale)}
              onPressOut={() => animatePressOut(cameraScale)}
              accessibilityLabel="Maak een foto met de camera"
            >
              <View style={[styles.iconCircle, { backgroundColor: MAGENTA_BG }]}>
                <Ionicons name="camera" size={28} color={MAGENTA} />
              </View>
              <Text style={styles.cardLabel}>Camera</Text>
            </Pressable>
          </Animated.View>

          {/* Gallery card */}
          <Animated.View style={[styles.cardWrapper, { transform: [{ scale: galleryScale }] }]}>
            <Pressable
              style={styles.card}
              onPress={handleGallery}
              onPressIn={() => animatePressIn(galleryScale)}
              onPressOut={() => animatePressOut(galleryScale)}
              accessibilityLabel="Kies een foto uit de galerij"
            >
              <View style={[styles.iconCircle, { backgroundColor: CYAN_BG }]}>
                <Ionicons name="images" size={28} color={CYAN} />
              </View>
              <Text style={styles.cardLabel}>Galerij</Text>
            </Pressable>
          </Animated.View>
        </View>

        {/* Cancel button */}
        <Pressable
          style={styles.cancelBtn}
          onPress={animateClose}
          accessibilityLabel="Annuleren"
        >
          <Text style={styles.cancelText}>Annuleren</Text>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },

  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(10, 10, 12, 0.65)',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    overflow: 'hidden',
    paddingHorizontal: space[5],
    paddingTop: space[3],
  },

  handle: {
    width: 142,
    height: HANDLE_HEIGHT,
    borderRadius: 3,
    backgroundColor: 'rgba(217, 217, 217, 0.46)',
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 24,
  },

  title: {
    fontFamily: 'Unbounded',
    fontSize: typography.heading3.fontSize,
    lineHeight: typography.heading3.lineHeight,
    fontWeight: typography.heading3.fontWeight,
    color: TEXT_PRIMARY,
    textAlign: 'center',
    marginBottom: space[5],
  },

  cardsRow: {
    flexDirection: 'row',
    gap: space[3],
    marginBottom: space[4],
  },

  cardWrapper: {
    flex: 1,
  },

  card: {
    height: CARD_HEIGHT,
    backgroundColor: SURFACE,
    borderRadius: CARD_RADIUS,
    borderWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[3],
  },

  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },

  cardLabel: {
    fontFamily: 'Unbounded',
    fontSize: typography.bodySm.fontSize,
    lineHeight: typography.bodySm.lineHeight,
    fontWeight: typography.bodySm.fontWeight,
    color: TEXT_PRIMARY,
  },

  cancelBtn: {
    height: 48,
    borderRadius: 25,
    backgroundColor: '#2C2C2E',
    alignItems: 'center',
    justifyContent: 'center',
  },

  cancelText: {
    fontFamily: 'Unbounded',
    fontSize: typography.bodySm.fontSize,
    color: TEXT_SECONDARY,
  },
});
