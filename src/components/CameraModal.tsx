import React, { useState, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  Image,
  Animated,
  Easing,
  Dimensions,
  Platform,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const CIRCLE_SIZE = SCREEN_W * 0.7;

interface CameraModalProps {
  visible: boolean;
  onClose: () => void;
  onImageCaptured: (uri: string, mimeType?: string) => void;
}

export default function CameraModal({ visible, onClose, onImageCaptured }: CameraModalProps) {
  const insets = useSafeAreaInsets();
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [previewMime, setPreviewMime] = useState<string>('image/jpeg');

  // Animations
  const scrimAnim = useRef(new Animated.Value(0)).current;
  const sheetAnim = useRef(new Animated.Value(0)).current;
  const [showModal, setShowModal] = useState(false);

  // Open animation
  React.useEffect(() => {
    if (visible) {
      setShowModal(true);
      setPreviewUri(null);
      scrimAnim.setValue(0);
      sheetAnim.setValue(0);
      Animated.parallel([
        Animated.timing(scrimAnim, { toValue: 1, duration: 250, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.spring(sheetAnim, { toValue: 1, damping: 22, stiffness: 300, mass: 1, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const animateClose = useCallback(() => {
    Animated.parallel([
      Animated.timing(scrimAnim, { toValue: 0, duration: 200, easing: Easing.in(Easing.ease), useNativeDriver: true }),
      Animated.timing(sheetAnim, { toValue: 0, duration: 200, easing: Easing.in(Easing.ease), useNativeDriver: true }),
    ]).start(() => {
      setShowModal(false);
      setPreviewUri(null);
      onClose();
    });
  }, [onClose]);

  const handleCamera = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });
    if (!result.canceled && result.assets[0]) {
      setPreviewUri(result.assets[0].uri);
      setPreviewMime(result.assets[0].mimeType ?? 'image/jpeg');
    }
  }, []);

  const handleGallery = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });
    if (!result.canceled && result.assets[0]) {
      setPreviewUri(result.assets[0].uri);
      setPreviewMime(result.assets[0].mimeType ?? 'image/jpeg');
    }
  }, []);

  const handleConfirm = useCallback(() => {
    if (previewUri) {
      onImageCaptured(previewUri, previewMime);
      animateClose();
    }
  }, [previewUri, previewMime, onImageCaptured, animateClose]);

  const handleRetake = useCallback(() => {
    setPreviewUri(null);
  }, []);

  if (!showModal) return null;

  const sheetTranslate = sheetAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [300, 0],
  });

  // ─── Preview Mode ───
  if (previewUri) {
    return (
      <Modal visible={showModal} transparent animationType="none" statusBarTranslucent>
        <View style={styles.previewContainer}>
          <Image source={{ uri: previewUri }} style={styles.previewImage} />

          {/* Circular mask overlay */}
          <View style={styles.maskContainer} pointerEvents="none">
            <View style={[styles.maskBar, { height: (SCREEN_H - CIRCLE_SIZE) / 2 }]} />
            <View style={styles.maskMiddle}>
              <View style={[styles.maskSide, { width: (SCREEN_W - CIRCLE_SIZE) / 2 }]} />
              <View style={styles.circleCutout}>
                <View style={styles.circleRing} />
              </View>
              <View style={[styles.maskSide, { width: (SCREEN_W - CIRCLE_SIZE) / 2 }]} />
            </View>
            <View style={[styles.maskBar, { flex: 1 }]} />
          </View>

          {/* Top bar: close */}
          <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
            <Pressable onPress={animateClose} style={styles.topBtn} hitSlop={12}>
              <Ionicons name="close" size={28} color="#FFFFFF" />
            </Pressable>
          </View>

          {/* Bottom controls */}
          <View style={[styles.previewBottomBar, { paddingBottom: insets.bottom + 20 }]}>
            <Pressable style={styles.retakeBtn} onPress={handleRetake}>
              <Ionicons name="refresh" size={22} color="#FFFFFF" />
              <Text style={styles.retakeBtnText}>Opnieuw</Text>
            </Pressable>

            <Pressable style={styles.confirmBtn} onPress={handleConfirm}>
              <Ionicons name="checkmark" size={26} color="#FFFFFF" />
              <Text style={styles.confirmBtnText}>Gebruik foto</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    );
  }

  // ─── Action Sheet Mode ───
  return (
    <Modal visible={showModal} transparent animationType="none" statusBarTranslucent>
      {/* Scrim */}
      <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: scrimAnim }]}>
        <Pressable style={styles.scrim} onPress={animateClose} />
      </Animated.View>

      {/* Bottom sheet */}
      <Animated.View
        style={[
          styles.sheet,
          { paddingBottom: insets.bottom + 12, transform: [{ translateY: sheetTranslate }] },
        ]}
      >
        <View style={styles.handle} />

        <Text style={styles.sheetTitle}>Profielfoto</Text>

        <Pressable style={styles.option} onPress={handleCamera}>
          <View style={styles.optionIcon}>
            <Ionicons name="camera" size={24} color="#FF004D" />
          </View>
          <View style={styles.optionTextWrap}>
            <Text style={styles.optionTitle}>Maak foto</Text>
            <Text style={styles.optionSub}>Open de camera</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#848484" />
        </Pressable>

        <View style={styles.divider} />

        <Pressable style={styles.option} onPress={handleGallery}>
          <View style={[styles.optionIcon, { backgroundColor: 'rgba(0, 190, 174, 0.12)' }]}>
            <Ionicons name="images" size={24} color="#00BEAE" />
          </View>
          <View style={styles.optionTextWrap}>
            <Text style={styles.optionTitle}>Kies uit galerij</Text>
            <Text style={styles.optionSub}>Selecteer een bestaande foto</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#848484" />
        </Pressable>

        <Pressable style={styles.cancelBtn} onPress={animateClose}>
          <Text style={styles.cancelText}>Annuleren</Text>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // ─── Scrim ───
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },

  // ─── Bottom Sheet ───
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1A1A2E',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitle: {
    fontFamily: 'Unbounded',
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 20,
  },

  // ─── Options ───
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 0, 77, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  optionTextWrap: {
    flex: 1,
  },
  optionTitle: {
    fontFamily: 'Unbounded',
    fontSize: 15,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  optionSub: {
    fontFamily: 'Unbounded',
    fontSize: 12,
    color: '#848484',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    marginLeft: 62,
  },

  // ─── Cancel ───
  cancelBtn: {
    marginTop: 16,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(78, 78, 78, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontFamily: 'Unbounded',
    fontSize: 15,
    color: '#848484',
  },

  // ─── Preview ───
  previewContainer: {
    flex: 1,
    backgroundColor: '#0F0F1E',
  },
  previewImage: {
    ...StyleSheet.absoluteFillObject,
    resizeMode: 'cover',
  },

  // ─── Circular mask ───
  maskContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  maskBar: {
    width: '100%',
    backgroundColor: 'rgba(15, 15, 30, 0.75)',
  },
  maskMiddle: {
    flexDirection: 'row',
    height: CIRCLE_SIZE,
  },
  maskSide: {
    height: CIRCLE_SIZE,
    backgroundColor: 'rgba(15, 15, 30, 0.75)',
  },
  circleCutout: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleRing: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    borderWidth: 2,
    borderColor: 'rgba(0, 190, 174, 0.5)',
  },

  // ─── Top bar ───
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    paddingHorizontal: 16,
    zIndex: 10,
  },
  topBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ─── Preview bottom bar ───
  previewBottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingTop: 20,
    paddingHorizontal: 20,
    zIndex: 10,
  },
  retakeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 48,
    paddingHorizontal: 24,
    borderRadius: 24,
    backgroundColor: 'rgba(78, 78, 78, 0.5)',
  },
  retakeBtnText: {
    fontFamily: 'Unbounded',
    fontSize: 14,
    color: '#FFFFFF',
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 48,
    paddingHorizontal: 24,
    borderRadius: 24,
    backgroundColor: '#00BEAE',
    ...Platform.select({
      ios: {
        shadowColor: '#00BEAE',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
      },
      android: { elevation: 4 },
    }),
  },
  confirmBtnText: {
    fontFamily: 'Unbounded',
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
