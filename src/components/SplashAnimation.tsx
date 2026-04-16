import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  StyleSheet,
  View,
} from 'react-native';
import * as SplashScreen from 'expo-splash-screen';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface SplashAnimationProps {
  authLoading: boolean;
  onComplete: () => void;
}

interface AuroraGlowConfig {
  color: string;
  size: number;
  top: number;
  left: number;
  opacityDuration: number;
  driftXDuration: number;
  driftYDuration: number;
  driftX: number;
  driftY: number;
}

const AURORA_GLOWS: AuroraGlowConfig[] = [
  // top-left magenta
  {
    color: 'rgba(255, 0, 255, 0.12)',
    size: 400,
    top: -120,
    left: -140,
    opacityDuration: 4700,
    driftXDuration: 5300,
    driftYDuration: 6100,
    driftX: 20,
    driftY: 15,
  },
  // top-right teal
  {
    color: 'rgba(0, 255, 178, 0.10)',
    size: 350,
    top: -80,
    left: SCREEN_WIDTH - 180,
    opacityDuration: 5300,
    driftXDuration: 6700,
    driftYDuration: 5100,
    driftX: -18,
    driftY: 20,
  },
  // bottom-left teal
  {
    color: 'rgba(0, 255, 178, 0.10)',
    size: 450,
    top: SCREEN_HEIGHT - 250,
    left: -160,
    opacityDuration: 6100,
    driftXDuration: 5700,
    driftYDuration: 7300,
    driftX: 15,
    driftY: -20,
  },
  // bottom-right magenta
  {
    color: 'rgba(255, 0, 255, 0.12)',
    size: 380,
    top: SCREEN_HEIGHT - 200,
    left: SCREEN_WIDTH - 150,
    opacityDuration: 5900,
    driftXDuration: 7100,
    driftYDuration: 4900,
    driftX: -20,
    driftY: -15,
  },
  // center-left magenta (subtle)
  {
    color: 'rgba(255, 0, 255, 0.08)',
    size: 300,
    top: SCREEN_HEIGHT * 0.35,
    left: -100,
    opacityDuration: 4300,
    driftXDuration: 6300,
    driftYDuration: 5700,
    driftX: 18,
    driftY: 12,
  },
  // center-right teal (subtle)
  {
    color: 'rgba(0, 255, 178, 0.08)',
    size: 320,
    top: SCREEN_HEIGHT * 0.4,
    left: SCREEN_WIDTH - 120,
    opacityDuration: 5100,
    driftXDuration: 4700,
    driftYDuration: 6900,
    driftX: -15,
    driftY: -18,
  },
];

function useAuroraGlow(config: AuroraGlowConfig) {
  const opacity = useRef(new Animated.Value(0.08)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const opacityAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.20,
          duration: config.opacityDuration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.08,
          duration: config.opacityDuration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    const driftXAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(translateX, {
          toValue: config.driftX,
          duration: config.driftXDuration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: -config.driftX,
          duration: config.driftXDuration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    const driftYAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(translateY, {
          toValue: config.driftY,
          duration: config.driftYDuration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: -config.driftY,
          duration: config.driftYDuration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    opacityAnim.start();
    driftXAnim.start();
    driftYAnim.start();

    return () => {
      opacityAnim.stop();
      driftXAnim.stop();
      driftYAnim.stop();
    };
  }, []);

  return { opacity, translateX, translateY };
}

function AuroraGlowElement({ config }: { config: AuroraGlowConfig }) {
  const anim = useAuroraGlow(config);
  return (
    <Animated.View
      style={[
        styles.auroraGlow,
        {
          backgroundColor: config.color,
          width: config.size,
          height: config.size,
          top: config.top,
          left: config.left,
          opacity: anim.opacity,
          transform: [
            { translateX: anim.translateX },
            { translateY: anim.translateY },
          ],
        },
      ]}
    />
  );
}

export default function SplashAnimation({ authLoading, onComplete }: SplashAnimationProps) {
  const [animationDone, setAnimationDone] = useState(false);

  // Logo animation values
  const colorLogoOpacity = useRef(new Animated.Value(0)).current;
  const colorLogoScale = useRef(new Animated.Value(0.3)).current;
  const monoLogoOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const overlayOpacity = useRef(new Animated.Value(1)).current;

  // Hide native splash screen on mount
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  // Logo animation sequence
  useEffect(() => {
    // t=0-600ms: Color logo fade-in + spring scale
    const colorFadeIn = Animated.timing(colorLogoOpacity, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    });

    const colorScaleSpring = Animated.spring(colorLogoScale, {
      toValue: 1.0,
      damping: 12,
      stiffness: 80,
      useNativeDriver: true,
    });

    // t=400ms: Text fade-in
    const textFadeIn = Animated.timing(textOpacity, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    });

    // t=1200ms: Crossfade to monochrome
    const colorFadeOut1 = Animated.timing(colorLogoOpacity, {
      toValue: 0,
      duration: 400,
      useNativeDriver: true,
    });
    const monoFadeIn = Animated.timing(monoLogoOpacity, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    });

    // t=2100ms: Crossfade back to color
    const monoFadeOut = Animated.timing(monoLogoOpacity, {
      toValue: 0,
      duration: 400,
      useNativeDriver: true,
    });
    const colorFadeIn2 = Animated.timing(colorLogoOpacity, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    });

    // t=0: Color logo appears with fade-in + spring scale
    Animated.parallel([colorFadeIn, colorScaleSpring]).start();

    // Text fade-in at t=400ms
    const textTimeout = setTimeout(() => {
      textFadeIn.start();
    }, 400);

    // t=1200ms: Crossfade to monochrome
    const crossfade1Timeout = setTimeout(() => {
      Animated.parallel([colorFadeOut1, monoFadeIn]).start();
    }, 1200);

    // t=2100ms: Crossfade back to color
    const crossfade2Timeout = setTimeout(() => {
      Animated.parallel([monoFadeOut, colorFadeIn2]).start();
    }, 2100);

    // t=4500ms: Animation done
    const doneTimeout = setTimeout(() => {
      setAnimationDone(true);
    }, 4500);

    return () => {
      clearTimeout(textTimeout);
      clearTimeout(crossfade1Timeout);
      clearTimeout(crossfade2Timeout);
      clearTimeout(doneTimeout);
    };
  }, []);

  // Fade-out and complete when animation done and auth not loading
  useEffect(() => {
    if (animationDone && !authLoading) {
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          onComplete();
        }
      });
    }
  }, [animationDone, authLoading]);

  return (
    <Animated.View
      style={[styles.container, { opacity: overlayOpacity }]}
      pointerEvents="none"
    >
      {/* Aurora background glows */}
      {AURORA_GLOWS.map((config, index) => (
        <AuroraGlowElement key={index} config={config} />
      ))}

      {/* Centered content */}
      <View style={styles.content}>
        {/* Logo container */}
        <View style={styles.logoContainer}>
          {/* Monochrome logo (behind) */}
          <Animated.Image
            source={require('../../assets/images/logo_monochrome_highres.png')}
            style={[
              styles.logoImage,
              {
                opacity: monoLogoOpacity,
                transform: [{ scale: colorLogoScale }],
              },
            ]}
            resizeMode="contain"
          />
          {/* Color logo (in front) */}
          <Animated.Image
            source={require('../../assets/images/logo_dark_highres.png')}
            style={[
              styles.logoImage,
              {
                opacity: colorLogoOpacity,
                transform: [{ scale: colorLogoScale }],
              },
            ]}
            resizeMode="contain"
          />
        </View>

        {/* "Streeps" text */}
        <Animated.Text style={[styles.title, { opacity: textOpacity }]}>
          Streeps
        </Animated.Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    backgroundColor: '#0D0D0D',
  },
  auroraGlow: {
    position: 'absolute',
    borderRadius: 999,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    width: 130,
    height: 130,
    borderRadius: 21,
    overflow: 'hidden',
  },
  logoImage: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 21,
  },
  title: {
    marginTop: 20,
    fontSize: 30,
    fontFamily: 'Unbounded-Bold',
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
