import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, PanResponder, StyleSheet, Text, View, Pressable } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import ReAnimated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

/**
 * Counter Control — native translation of "Counter" group from Home_fixed_v4.svg
 *
 * Layout: [ Minus 125×73 ]  14px  [ Display 73×73 ]  14px  [ Plus 125×73 ]
 * All borderRadius 25.
 *
 * Minus:   diamond grad (green→yellow, approximated) + linear #FF0085→#FF00F5 @60%
 * Display: linear #00FE96→#2F00FF @50% + white @30%
 * Plus:    diamond grad (green→teal, approximated) + linear #00FF97→#007399 @60%
 */

interface CounterControlProps {
  value: number;
  onIncrement: () => void;
  onDecrement: () => void;
  onSubmit?: () => void;
  auroraColors?: string[];
  /** Active category color — the ring + shadow smoothly tween to this. */
  activeColor?: string;
  /**
   * Called when the user horizontally swipes past the threshold over the counter.
   * 'next' = swipe left (reveal next category), 'prev' = swipe right (previous).
   * The component does NOT cycle state itself — parent handles it.
   */
  onSwipeCycle?: (direction: 'next' | 'prev') => void;
  /** Disables the swipe gesture entirely when true. */
  disabled?: boolean;
}

const DEFAULT_RING_COLOR = '#FF0085';

// Swipe tuning constants
const SWIPE_THRESHOLD = 60;   // px — distance at which a cycle is committed on release
const SWIPE_MAX_TRANSLATE = 40; // px — visual cap for translateX during drag
const SWIPE_DIR_MIN = 10;    // px — must move horizontally before we claim the gesture

function usePressAnim() {
  const opacity = useRef(new Animated.Value(0)).current;
  const fadeIn = () =>
    Animated.timing(opacity, {
      toValue: 1,
      duration: 120,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  const fadeOut = () =>
    Animated.timing(opacity, {
      toValue: 0,
      duration: 200,
      easing: Easing.in(Easing.ease),
      useNativeDriver: true,
    }).start();
  return { opacity, fadeIn, fadeOut };
}

function useRepeatPress(onAction: () => void) {
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repeatTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const fired = useRef(false);
  const actionRef = useRef(onAction);

  useEffect(() => { actionRef.current = onAction; }, [onAction]);

  const stop = useCallback(() => {
    if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null; }
    if (repeatTimer.current) { clearInterval(repeatTimer.current); repeatTimer.current = null; }
  }, []);

  const start = useCallback(() => {
    fired.current = false;
    stop(); // Clear any existing timers first
    const startTime = Date.now();
    holdTimer.current = setTimeout(() => {
      fired.current = true;
      actionRef.current();
      repeatTimer.current = setInterval(() => {
        // Safety valve: stop after 10 seconds
        if (Date.now() - startTime > 10000) { stop(); return; }
        actionRef.current();
      }, 166);
    }, 300);
  }, [stop]);

  return { start, stop, fired };
}

export default function CounterControl({ value, onIncrement, onDecrement, onSubmit, auroraColors, activeColor, onSwipeCycle, disabled }: CounterControlProps) {
  // Smooth color transition for ring + shadow when activeColor changes
  const resolvedColor = activeColor ?? auroraColors?.[0] ?? DEFAULT_RING_COLOR;
  const prevColorRef = useRef(resolvedColor);
  const currentColorRef = useRef(resolvedColor);
  const colorProgress = useRef(new Animated.Value(1)).current;

  // Update refs SYNCHRONOUSLY during render so the interpolation below picks
  // up the new colors on the same render the prop changes, not a render later.
  if (currentColorRef.current !== resolvedColor) {
    prevColorRef.current = currentColorRef.current;
    currentColorRef.current = resolvedColor;
  }

  useEffect(() => {
    colorProgress.setValue(0);
    Animated.timing(colorProgress, {
      toValue: 1,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [resolvedColor, colorProgress]);

  const animatedRingColor = colorProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [prevColorRef.current, currentColorRef.current],
  });
  const minus = usePressAnim();
  const plus = usePressAnim();
  const minusRepeat = useRepeatPress(onDecrement);
  const plusRepeat = useRepeatPress(onIncrement);

  // ── Horizontal swipe → category cycle (via PanResponder) ──
  // We use PanResponder (vs gesture-handler) because RNGH is not installed
  // in this project. The reanimated v4 shared value drives a smooth translateX
  // that follows the finger (capped at SWIPE_MAX_TRANSLATE) and springs back
  // on release.
  const swipeX = useSharedValue(0);

  // Latest callback/disabled refs so PanResponder closure stays stable.
  const onSwipeCycleRef = useRef(onSwipeCycle);
  const disabledRef = useRef(disabled);
  useEffect(() => { onSwipeCycleRef.current = onSwipeCycle; }, [onSwipeCycle]);
  useEffect(() => { disabledRef.current = disabled; }, [disabled]);

  const panResponder = useMemo(() => PanResponder.create({
    // Do NOT claim the gesture on touch start — let child Pressables (minus,
    // display-tap-to-submit, plus) handle taps normally.
    onStartShouldSetPanResponder: () => false,
    onStartShouldSetPanResponderCapture: () => false,
    // Only claim once the user clearly moves horizontally. This prevents the
    // ScrollView parent from stealing vertical drags AND keeps taps working.
    onMoveShouldSetPanResponder: (_, g) => {
      if (disabledRef.current) return false;
      if (!onSwipeCycleRef.current) return false;
      return Math.abs(g.dx) > SWIPE_DIR_MIN && Math.abs(g.dx) > Math.abs(g.dy);
    },
    onMoveShouldSetPanResponderCapture: (_, g) => {
      if (disabledRef.current) return false;
      if (!onSwipeCycleRef.current) return false;
      return Math.abs(g.dx) > SWIPE_DIR_MIN && Math.abs(g.dx) > Math.abs(g.dy);
    },
    onPanResponderGrant: () => {
      swipeX.value = 0;
    },
    onPanResponderMove: (_, g) => {
      // Follow finger but cap visually. We use a soft clamp so it doesn't feel
      // hard-capped — linear up to the cap, no overshoot.
      const clamped = Math.max(-SWIPE_MAX_TRANSLATE, Math.min(SWIPE_MAX_TRANSLATE, g.dx));
      swipeX.value = clamped;
    },
    onPanResponderRelease: (_, g) => {
      if (Math.abs(g.dx) >= SWIPE_THRESHOLD && onSwipeCycleRef.current) {
        // Fire callback. Swipe left (negative dx) = next; right = prev.
        const dir: 'next' | 'prev' = g.dx < 0 ? 'next' : 'prev';
        onSwipeCycleRef.current(dir);
        // Briefly overshoot in the swipe direction, then spring back — this
        // makes the cycle moment feel tactile ("iPod wheel" click).
        const overshoot = g.dx < 0 ? -SWIPE_MAX_TRANSLATE : SWIPE_MAX_TRANSLATE;
        swipeX.value = withSequence(
          withTiming(overshoot, { duration: 80 }),
          withSpring(0, { damping: 14, stiffness: 180, mass: 0.8 }),
        );
      } else {
        swipeX.value = withSpring(0, { damping: 16, stiffness: 200, mass: 0.8 });
      }
    },
    onPanResponderTerminate: () => {
      swipeX.value = withSpring(0, { damping: 16, stiffness: 200, mass: 0.8 });
    },
    onPanResponderTerminationRequest: () => false,
  }), [swipeX]);

  const swipeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: swipeX.value }],
  }));

  useEffect(() => {
    return () => { minusRepeat.stop(); plusRepeat.stop(); };
  }, []);

  // ── Number transition: overlapping layer stack ──
  // Each value gets its own layer that fades in/out independently — no interrupts needed
  type NumberLayer = { key: number; value: number; opacity: Animated.Value; scale: Animated.Value };
  const keyCounter = useRef(0);
  const [layers, setLayers] = useState<NumberLayer[]>(() => [{
    key: 0, value, opacity: new Animated.Value(1), scale: new Animated.Value(1),
  }]);
  const layersRef = useRef(layers);
  layersRef.current = layers;

  const targetScale = (v: number) => v <= 0 ? 1 : 1 + Math.min((v - 1) / 9, 1) * 0.35;
  const targetRotate = (v: number) => v <= 0 ? 0 : Math.min((v - 1) / 9, 1) * 15;

  const removeLayer = useCallback((key: number) => {
    setLayers(prev => prev.filter(l => l.key !== key));
  }, []);

  useEffect(() => {
    // Find the latest entering layer's value
    const current = layersRef.current;
    const topLayer = current[current.length - 1];
    if (topLayer && topLayer.value === value) return;

    // Fade out all existing layers
    current.forEach(layer => {
      Animated.timing(layer.opacity, {
        toValue: 0, duration: 225, easing: Easing.out(Easing.ease), useNativeDriver: true,
      }).start(({ finished }) => { if (finished) removeLayer(layer.key); });
    });

    // Add new layer that fades in
    const sc = targetScale(value);
    const newKey = ++keyCounter.current;
    const newLayer: NumberLayer = {
      key: newKey, value,
      opacity: new Animated.Value(0),
      scale: new Animated.Value(sc * 1.5),
    };
    setLayers(prev => [...prev, newLayer]);

    Animated.parallel([
      Animated.timing(newLayer.opacity, { toValue: 1, duration: 33, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      Animated.timing(newLayer.scale, { toValue: sc, duration: 200, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    ]).start();
  }, [value]);

  // ── Pulsing ring (visible when value > 0) ──
  const pulseScale = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0)).current;
  const flashOpacity = useRef(new Animated.Value(0)).current;
  const pulseAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (pulseAnimRef.current) {
      pulseAnimRef.current.stop();
      pulseAnimRef.current = null;
    }

    if (value > 0) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(pulseScale, { toValue: 1.08, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
            Animated.timing(pulseOpacity, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
          ]),
          Animated.parallel([
            Animated.timing(pulseScale, { toValue: 1.0, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
            Animated.timing(pulseOpacity, { toValue: 0.4, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
          ]),
        ]),
        { resetBeforeIteration: false }
      );
      pulseAnimRef.current = loop;
      loop.start();
    } else {
      Animated.parallel([
        Animated.timing(pulseScale, { toValue: 1, duration: 200, useNativeDriver: false }),
        Animated.timing(pulseOpacity, { toValue: 0, duration: 200, useNativeDriver: false }),
      ]).start();
    }

    return () => { if (pulseAnimRef.current) pulseAnimRef.current.stop(); };
  }, [value > 0]);

  const handleSubmitPress = useCallback(() => {
    flashOpacity.setValue(1);
    Animated.timing(flashOpacity, { toValue: 0, duration: 300, easing: Easing.out(Easing.ease), useNativeDriver: false }).start();
    onSubmit?.();
  }, [onSubmit]);

  return (
    <ReAnimated.View style={[s.row, swipeStyle]} {...panResponder.panHandlers}>
      {/* ── Minus button ── */}
      <Pressable style={[s.glowWrap, s.minusGlow]} onPress={() => { if (!minusRepeat.fired.current) onDecrement(); }} onPressIn={() => { minus.fadeIn(); minusRepeat.start(); }} onPressOut={() => { minus.fadeOut(); minusRepeat.stop(); }} onResponderTerminate={() => { minusRepeat.stop(); }} hitSlop={10}>
        <Animated.View style={[s.btnInner, s.btnClean, { opacity: Animated.add(0.6, Animated.multiply(minus.opacity, 0.4) as any) as any }]}>
          <Svg width={32} height={32} viewBox="0 0 32 32">
            <Path d="M8 16 L24 16" stroke="#F1F1F1" strokeWidth={4} strokeLinecap="round" />
          </Svg>
        </Animated.View>
      </Pressable>

      {/* ── Counter display (tap to submit) ── */}
      <Pressable style={[s.displayGlow]} onPress={handleSubmitPress}>
        <View style={s.displayInner}>
          {/* Outer thick ring — category color, opacity pulses */}
          {/* Outer thick ring — category color, center-stroked, with glow */}
          <Animated.View
            pointerEvents="none"
            style={[
              s.ringOuter,
              {
                borderColor: animatedRingColor,
                shadowColor: animatedRingColor,
                opacity: pulseOpacity,
                transform: [{ scale: pulseScale }],
              },
            ]}
          />
          {/* Inner thin ring — white, center-stroked, with glow */}
          <Animated.View
            pointerEvents="none"
            style={[
              s.ringInner,
              {
                shadowColor: animatedRingColor,
                opacity: pulseOpacity,
                transform: [{ scale: pulseScale }],
              },
            ]}
          />
          {layers.map((layer, i) => (
            <Animated.Text
              key={layer.key}
              style={[s.value, i > 0 && s.valueOverlay, {
                opacity: layer.opacity,
                transform: [
                  { scale: layer.scale as any },
                  { rotate: `${targetRotate(layer.value)}deg` },
                ],
              }]}
            >
              {layer.value}
            </Animated.Text>
          ))}
        </View>
      </Pressable>

      {/* ── Plus button ── */}
      <Pressable style={[s.glowWrap, s.plusGlow]} onPress={() => { if (!plusRepeat.fired.current) onIncrement(); }} onPressIn={() => { plus.fadeIn(); plusRepeat.start(); }} onPressOut={() => { plus.fadeOut(); plusRepeat.stop(); }} onResponderTerminate={() => { plusRepeat.stop(); }} hitSlop={10}>
        <Animated.View style={[s.btnInner, s.btnClean, { opacity: Animated.add(0.6, Animated.multiply(plus.opacity, 0.4) as any) as any }]}>
          <Svg width={32} height={32} viewBox="0 0 32 32">
            <Path d="M16 6 L16 26 M6 16 L26 16" stroke="#F1F1F1" strokeWidth={4} strokeLinecap="round" />
          </Svg>
        </Animated.View>
      </Pressable>
    </ReAnimated.View>
  );
}

const RADIUS = 20;

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },

  fill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: RADIUS,
  },

  pressOverlay: {
    backgroundColor: 'rgba(255,255,255,0.35)',
  },

  // Outer glow wrapper — no overflow:hidden so shadow bleeds out
  glowWrap: {
    flex: 1,
    height: 60,
    borderRadius: RADIUS,
  },

  // Inner clipped container for gradient content
  btnInner: {
    flex: 1,
    borderRadius: RADIUS,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },

  btnClean: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },

  minusGlow: {},
  plusGlow: {},

  displayGlow: {
    width: 60,
    height: 60,
    borderRadius: RADIUS,
    overflow: 'visible',
  },

  // Inner container for display (no overflow:hidden — shadow glow must bleed out)
  displayInner: {
    flex: 1,
    borderRadius: RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },

  // Outer ring — thick, category color, center-stroked from 30px radius
  // Center stroke: expand by borderWidth/2 on each side → width = 60 + 4 = 64
  ringOuter: {
    position: 'absolute',
    width: 64,
    height: 64,
    left: -2,    // offset = -borderWidth/2
    top: -2,
    borderRadius: 32,
    borderWidth: 4,
    // borderColor & shadowColor set dynamically
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 5,
    elevation: 8,
  },
  // Inner ring — thin, white, center-stroked from same 30px radius
  // Center stroke: expand by borderWidth/2 → width = 60 + 1.5 ≈ 62
  ringInner: {
    position: 'absolute',
    width: 62,
    height: 62,
    left: -1,    // offset = -borderWidth/2 ≈ -1
    top: -1,
    borderRadius: 31,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    // shadowColor set dynamically
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 6,
  },

  value: {
    fontFamily: 'Unbounded-SemiBold',
    fontSize: 28,
    fontWeight: '600',
    color: '#FFFFFF',
    zIndex: 1,
  },
  valueOverlay: {
    position: 'absolute',
  },

  // ── Minus icon: 18.67×2 line, rounded caps ──
  minusLine: {
    width: 19,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#F1F1F1',
    zIndex: 1,
  },

  // ── Plus icon: 16×4 cross (matches SVG path) ──
  iconWrap: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  plusH: {
    position: 'absolute',
    width: 28,
    height: 4,
    backgroundColor: '#F1F1F1',
  },
  plusV: {
    position: 'absolute',
    width: 4,
    height: 28,
    backgroundColor: '#F1F1F1',
  },
});
