import React, { useEffect, useRef } from 'react';
import { Animated, Easing, InteractionManager } from 'react-native';
import Svg, { Path, G } from 'react-native-svg';

const AnimatedG = Animated.createAnimatedComponent(G);

/**
 * Animated bot avatar icon with subtle eye-look + blink loop.
 * Used in chat bubbles, chat input, and group profile overlay.
 */
export default function BotIcon({ size = 22, color = '#FFFFFF' }: { size?: number; color?: string }) {
  const eyeX = useRef(new Animated.Value(0)).current;
  const eyeY = useRef(new Animated.Value(0)).current;
  const blinkOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let lookAnim: Animated.CompositeAnimation | null = null;
    let blinkAnim: Animated.CompositeAnimation | null = null;
    const handle = InteractionManager.runAfterInteractions(() => {
    const look = Animated.loop(Animated.sequence([
      Animated.delay(1200),
      Animated.timing(eyeX, { toValue: 2.5, duration: 250, easing: Easing.out(Easing.ease), useNativeDriver: false }),
      Animated.delay(1000),
      Animated.timing(eyeX, { toValue: 0, duration: 250, easing: Easing.out(Easing.ease), useNativeDriver: false }),
      Animated.delay(800),
      Animated.parallel([
        Animated.timing(eyeX, { toValue: -2.5, duration: 250, easing: Easing.out(Easing.ease), useNativeDriver: false }),
        Animated.timing(eyeY, { toValue: -1, duration: 250, easing: Easing.out(Easing.ease), useNativeDriver: false }),
      ]),
      Animated.delay(1200),
      Animated.parallel([
        Animated.timing(eyeX, { toValue: 0, duration: 250, easing: Easing.out(Easing.ease), useNativeDriver: false }),
        Animated.timing(eyeY, { toValue: 0, duration: 250, easing: Easing.out(Easing.ease), useNativeDriver: false }),
      ]),
      Animated.delay(2000),
      Animated.parallel([
        Animated.timing(eyeX, { toValue: -2.5, duration: 250, easing: Easing.out(Easing.ease), useNativeDriver: false }),
        Animated.timing(eyeY, { toValue: 1, duration: 250, easing: Easing.out(Easing.ease), useNativeDriver: false }),
      ]),
      Animated.delay(1000),
      Animated.parallel([
        Animated.timing(eyeX, { toValue: 0, duration: 250, easing: Easing.out(Easing.ease), useNativeDriver: false }),
        Animated.timing(eyeY, { toValue: 0, duration: 250, easing: Easing.out(Easing.ease), useNativeDriver: false }),
      ]),
      Animated.delay(2500),
    ]));

    const blink = Animated.loop(Animated.sequence([
      Animated.delay(3000),
      Animated.timing(blinkOpacity, { toValue: 0, duration: 70, useNativeDriver: false }),
      Animated.timing(blinkOpacity, { toValue: 1, duration: 70, useNativeDriver: false }),
      Animated.delay(5000),
      Animated.timing(blinkOpacity, { toValue: 0, duration: 70, useNativeDriver: false }),
      Animated.timing(blinkOpacity, { toValue: 1, duration: 70, useNativeDriver: false }),
      Animated.delay(2500),
    ]));

    look.start();
    blink.start();
    lookAnim = look;
    blinkAnim = blink;
    });
    return () => { handle.cancel(); lookAnim?.stop(); blinkAnim?.stop(); };
  }, []);

  return (
    <Svg width={size} height={size} viewBox="3.87 -1.5 31 33">
      <Path
        d="M 19.37,0 c -8.544,0 -15.5,6.955 -15.5,15.5 V 26.3 c 0,2.594 2.103,4.697 4.697,4.697 3.956,0 7.001,0 10.802,0 8.544,0 15.5,-6.955 15.5,-15.5 0,-8.544 -6.955,-15.5 -15.5,-15.5 z m 0,2.814 c 7.022,0 12.689,5.663 12.689,12.689 0,7.021 -5.663,12.689 -12.689,12.689 H 9.507 A 2.824,2.824 45 0 1 6.676,25.362 v -9.862 c 0,-7.021 5.663,-12.689 12.689,-12.689 z"
        fill={color}
      />
      <AnimatedG translateX={eyeX} translateY={eyeY} opacity={blinkOpacity}>
        <Path d="M 16.353,11.175 v 6" stroke={color} strokeWidth={3.132} strokeLinecap="round" fill="none" />
        <Path d="M 24.353,11.175 v 6" stroke={color} strokeWidth={3.132} strokeLinecap="round" fill="none" />
      </AnimatedG>
    </Svg>
  );
}
