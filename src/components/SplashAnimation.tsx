import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  StyleSheet,
  View,
} from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import AuroraBackground from './AuroraBackground';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface SplashAnimationProps {
  authLoading: boolean;
  dataLoading: boolean;
  onComplete: () => void;
}

// Login preset split into two groups (from AuroraBackground DATA.login)
const LOGIN_GROUP_RIGHT = {
  container: { w: 590, h: 500 },
  shapes: [
    { source: require('../../assets/aurora/login/login_p0.png'), color: '#FF0085', center: { x: 232.38, y: 3.83 }, width: 564, height: 711 },
    { source: require('../../assets/aurora/login/login_p1.png'), color: '#FF00F5', center: { x: 274.84, y: 3.83 }, width: 564, height: 711 },
    { source: require('../../assets/aurora/login/login_p2.png'), color: '#00BEAE', center: { x: 330.43, y: 5.59 }, width: 564, height: 711 },
    { source: require('../../assets/aurora/login/login_p3.png'), color: '#00FE96', center: { x: 382.05, y: 9.11 }, width: 564, height: 711 },
  ],
};

const LOGIN_GROUP_LEFT = {
  container: { w: 590, h: 500 },
  shapes: [
    { source: require('../../assets/aurora/login/login_p4.png'), color: '#FF0085', center: { x: 53.91, y: 187.94 }, width: 520, height: 506 },
    { source: require('../../assets/aurora/login/login_p5.png'), color: '#FF00F5', center: { x: 29.15, y: 167.55 }, width: 520, height: 506 },
    { source: require('../../assets/aurora/login/login_p6.png'), color: '#00BEAE', center: { x: -2.64, y: 140.08 }, width: 520, height: 506 },
    { source: require('../../assets/aurora/login/login_p7.png'), color: '#00FE96', center: { x: -31.48, y: 113.75 }, width: 520, height: 506 },
  ],
};

export default function SplashAnimation({ authLoading, dataLoading, onComplete }: SplashAnimationProps) {
  const [animationDone, setAnimationDone] = useState(false);

  // Logo animation values
  const colorLogoOpacity = useRef(new Animated.Value(0)).current;
  const colorLogoScale = useRef(new Animated.Value(0.3)).current;
  const monoLogoOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const overlayOpacity = useRef(new Animated.Value(1)).current;

  // Group rotations — both 20°/s but opposite directions for organic feel
  const groupRightRotation = useRef(new Animated.Value(0)).current;
  const groupLeftRotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Right group: clockwise, 20°/s → 360° in 18s
    const spinRight = Animated.loop(
      Animated.timing(groupRightRotation, {
        toValue: 1,
        duration: 18000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    // Left group: counter-clockwise, 20°/s → -360° in 18s
    const spinLeft = Animated.loop(
      Animated.timing(groupLeftRotation, {
        toValue: -1,
        duration: 18000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    spinRight.start();
    spinLeft.start();
    return () => { spinRight.stop(); spinLeft.stop(); };
  }, []);

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

    // t=0: Color logo appears with fade-in + spring scale
    Animated.parallel([colorFadeIn, colorScaleSpring]).start();

    // Text fade-in at t=400ms
    const textTimeout = setTimeout(() => {
      textFadeIn.start();
    }, 400);

    // t=1200ms: Start looping monochrome overlay (color logo blijft ALTIJD zichtbaar)
    let crossfadeLoop: Animated.CompositeAnimation | null = null;
    const crossfadeTimeout = setTimeout(() => {
      crossfadeLoop = Animated.loop(
        Animated.sequence([
          // Monochrome fade in (over het kleurlogo heen)
          Animated.timing(monoLogoOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
          // Hold monochrome
          Animated.delay(300),
          // Monochrome fade out (kleurlogo wordt weer zichtbaar)
          Animated.timing(monoLogoOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
          // Hold color
          Animated.delay(2000),
        ])
      );
      crossfadeLoop.start();
    }, 1200);

    // t=10000ms: Animation done (10s minimum voor testing)
    const doneTimeout = setTimeout(() => {
      setAnimationDone(true);
    }, 10000);

    return () => {
      clearTimeout(textTimeout);
      clearTimeout(crossfadeTimeout);
      clearTimeout(doneTimeout);
      crossfadeLoop?.stop();
    };
  }, []);

  // Fade-out and complete when animation done and auth not loading
  useEffect(() => {
    if (animationDone && !authLoading && !dataLoading) {
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
  }, [animationDone, authLoading, dataLoading]);

  const rotateRight = groupRightRotation.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-360deg', '0deg', '360deg'],
  });
  const rotateLeft = groupLeftRotation.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-360deg', '0deg', '360deg'],
  });

  return (
    <Animated.View
      style={[styles.container, { opacity: overlayOpacity }]}
      pointerEvents="none"
    >
      {/* Aurora group RIGHT — clockwise rotation */}
      <Animated.View style={[styles.auroraGroup, { transform: [{ rotate: rotateRight }] }]}>
        <AuroraBackground
          width={LOGIN_GROUP_RIGHT.container.w}
          height={LOGIN_GROUP_RIGHT.container.h}
          shapes={LOGIN_GROUP_RIGHT.shapes}
          animated
          gentle
        />
      </Animated.View>

      {/* Aurora group LEFT — counter-clockwise rotation */}
      <Animated.View style={[styles.auroraGroup, { transform: [{ rotate: rotateLeft }] }]}>
        <AuroraBackground
          width={LOGIN_GROUP_LEFT.container.w}
          height={LOGIN_GROUP_LEFT.container.h}
          shapes={LOGIN_GROUP_LEFT.shapes}
          animated
          gentle
        />
      </Animated.View>

      {/* Centered content */}
      <View style={styles.content}>
        {/* Logo container */}
        <View style={styles.logoContainer}>
          {/* Color logo (altijd zichtbaar) */}
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
          {/* Monochrome logo (overlay, fades in/out bovenop kleur) */}
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
  auroraGroup: {
    position: 'absolute',
    top: (SCREEN_HEIGHT - 500) / 2,
    left: (SCREEN_WIDTH - 590) / 2,
    width: 590,
    height: 500,
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
