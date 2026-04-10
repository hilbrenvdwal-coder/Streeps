import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View, Pressable } from 'react-native';

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
}

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

export default function CounterControl({ value, onIncrement, onDecrement, onSubmit, auroraColors }: CounterControlProps) {
  const minus = usePressAnim();
  const plus = usePressAnim();
  const minusRepeat = useRepeatPress(onDecrement);
  const plusRepeat = useRepeatPress(onIncrement);

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
    <View style={s.row}>
      {/* ── Minus button ── */}
      <Pressable style={[s.glowWrap, s.minusGlow]} onPress={() => { if (!minusRepeat.fired.current) onDecrement(); }} onPressIn={() => { minus.fadeIn(); minusRepeat.start(); }} onPressOut={() => { minus.fadeOut(); minusRepeat.stop(); }} onResponderTerminate={() => { minusRepeat.stop(); }} hitSlop={10}>
        <Animated.View style={[s.btnInner, s.btnClean, { opacity: Animated.add(0.6, Animated.multiply(minus.opacity, 0.4) as any) as any }]}>
          <View style={s.minusLine} />
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
                borderColor: auroraColors?.[0] ?? '#FF0085',
                shadowColor: auroraColors?.[0] ?? '#FF0085',
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
                shadowColor: auroraColors?.[0] ?? '#FF0085',
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
          <View style={s.iconWrap}>
            <View style={s.plusH} />
            <View style={s.plusV} />
          </View>
        </Animated.View>
      </Pressable>
    </View>
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
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
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
