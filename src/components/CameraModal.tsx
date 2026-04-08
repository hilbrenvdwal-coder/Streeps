import React, { useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  Animated,
  Easing,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';


interface CameraModalProps {
  visible: boolean;
  onClose: () => void;
  onImageCaptured: (uri: string, mimeType?: string) => void;
}

export default function CameraModal({ visible, onClose, onImageCaptured }: CameraModalProps) {
  const insets = useSafeAreaInsets();

  // Animations
  const scrimAnim = useRef(new Animated.Value(0)).current;
  const sheetAnim = useRef(new Animated.Value(0)).current;
  const [showModal, setShowModal] = React.useState(false);

  // Open animation
  React.useEffect(() => {
    if (visible) {
      setShowModal(true);
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
      onImageCaptured(result.assets[0].uri, result.assets[0].mimeType ?? 'image/jpeg');
      animateClose();
    }
  }, [onImageCaptured, animateClose]);

  const handleGallery = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });
    if (!result.canceled && result.assets[0]) {
      onImageCaptured(result.assets[0].uri, result.assets[0].mimeType ?? 'image/jpeg');
      animateClose();
    }
  }, [onImageCaptured, animateClose]);

  if (!showModal) return null;

  const sheetTranslate = sheetAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [300, 0],
  });

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

});
