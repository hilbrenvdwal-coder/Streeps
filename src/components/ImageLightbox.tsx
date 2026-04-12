import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, Modal, Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export interface ImageLayout {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Props {
  visible: boolean;
  uri: string | null;
  origin: ImageLayout | null;
  onClose: () => void;
}

export default function ImageLightbox({ visible, uri, origin, onClose }: Props) {
  const anim = useRef(new Animated.Value(0)).current;
  // Keep last-known values so the close animation can finish after the
  // parent clears its lightbox state.
  const [latched, setLatched] = useState<{ uri: string; origin: ImageLayout } | null>(null);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (visible && uri && origin) {
      setLatched({ uri, origin });
      setClosing(false);
      anim.setValue(0);
      Animated.timing(anim, {
        toValue: 1,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, uri, origin?.x, origin?.y, origin?.width, origin?.height]);

  const handleClose = () => {
    if (closing) return;
    setClosing(true);
    Animated.timing(anim, {
      toValue: 0,
      duration: 220,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setLatched(null);
        setClosing(false);
        onClose();
      }
    });
  };

  if (!latched) return null;

  const { uri: shownUri, origin: shownOrigin } = latched;

  // Target size: maintain aspect ratio of the origin box, cap at screen constraints.
  const aspectRatio = shownOrigin.width / Math.max(shownOrigin.height, 1);
  const maxW = SCREEN_W - 32;
  const maxH = SCREEN_H * 0.85;
  let targetW = maxW;
  let targetH = maxW / aspectRatio;
  if (targetH > maxH) {
    targetH = maxH;
    targetW = maxH * aspectRatio;
  }
  const targetX = (SCREEN_W - targetW) / 2;
  const targetY = (SCREEN_H - targetH) / 2;

  // Begin at the origin position using a translate+scale offset relative to the
  // final (target) layout. useNativeDriver only supports transforms + opacity.
  const originCx = shownOrigin.x + shownOrigin.width / 2;
  const originCy = shownOrigin.y + shownOrigin.height / 2;
  const targetCx = SCREEN_W / 2;
  const targetCy = SCREEN_H / 2;
  const scaleFrom = Math.max(shownOrigin.width / targetW, shownOrigin.height / targetH);

  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [scaleFrom, 1] });
  const translateX = anim.interpolate({ inputRange: [0, 1], outputRange: [originCx - targetCx, 0] });
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [originCy - targetCy, 0] });

  return (
    <Modal
      visible={!!latched}
      transparent
      statusBarTranslucent
      animationType="none"
      onRequestClose={handleClose}
    >
      <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
        <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: anim }]}>
          <BlurView
            intensity={30}
            tint="dark"
            experimentalBlurMethod="dimezisBlurView"
            style={StyleSheet.absoluteFillObject}
          />
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.7)' }]} />
          <Pressable style={StyleSheet.absoluteFillObject} onPress={handleClose} />
        </Animated.View>
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: targetX,
            top: targetY,
            width: targetW,
            height: targetH,
            borderRadius: 16,
            overflow: 'hidden',
            transform: [{ translateX }, { translateY }, { scale }],
          }}
        >
          <Image
            source={{ uri: shownUri }}
            style={{ width: '100%', height: '100%' }}
            contentFit="contain"
            cachePolicy="memory-disk"
          />
        </Animated.View>
      </View>
    </Modal>
  );
}
