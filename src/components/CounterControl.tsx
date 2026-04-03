import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AuroraPresetView } from './AuroraBackground';

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

export default function CounterControl({ value, onIncrement, onDecrement, onSubmit, auroraColors }: CounterControlProps) {
  const minus = usePressAnim();
  const plus = usePressAnim();

  // ── Number transition: overlapping layer stack ──
  // Each value gets its own layer that fades in/out independently — no interrupts needed
  type NumberLayer = { key: number; value: number; opacity: Animated.Value; scale: Animated.Value };
  const keyCounter = useRef(0);
  const [layers, setLayers] = useState<NumberLayer[]>(() => [{
    key: 0, value, opacity: new Animated.Value(1), scale: new Animated.Value(1),
  }]);
  const layersRef = useRef(layers);
  layersRef.current = layers;

  const targetScale = (v: number) => 1 + Math.min((v - 1) / 9, 1) * 0.35;
  const targetRotate = (v: number) => Math.min((v - 1) / 9, 1) * 15;

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

  // Fade out → swap colors → fade in (single aurora, no double layers)
  const [displayColors, setDisplayColors] = useState(auroraColors);
  const auroraOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (displayColors?.join(',') !== auroraColors?.join(',')) {
      Animated.timing(auroraOpacity, {
        toValue: 0,
        duration: 150,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start(() => {
        setDisplayColors(auroraColors);
        Animated.timing(auroraOpacity, {
          toValue: 1,
          duration: 150,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }).start();
      });
    }
  }, [auroraColors]);

  return (
    <View style={s.row}>
      {/* ── Minus button ── */}
      <Pressable style={[s.glowWrap, s.minusGlow]} onPress={onDecrement} onPressIn={minus.fadeIn} onPressOut={minus.fadeOut} hitSlop={10}>
        <Animated.View style={[s.btnInner, s.btnClean, { opacity: Animated.add(0.6, Animated.multiply(minus.opacity, 0.4) as any) as any }]}>
          <View style={s.minusLine} />
        </Animated.View>
      </Pressable>

      {/* ── Counter display (tap to submit) ── */}
      <Pressable style={[s.displayGlow]} onPress={onSubmit}>
        <View style={s.displayInner}>
          <Animated.View style={[s.auroraWrap, { opacity: auroraOpacity }]} pointerEvents="none">
            <AuroraPresetView preset="counter" animated gentle colors={displayColors} />
          </Animated.View>
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
      <Pressable style={[s.glowWrap, s.plusGlow]} onPress={onIncrement} onPressIn={plus.fadeIn} onPressOut={plus.fadeOut} hitSlop={10}>
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
  },

  // Inner container for display (no overflow:hidden — aurora MaskedView handles soft clipping)
  displayInner: {
    flex: 1,
    borderRadius: RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Aurora background positioned inside display (mask is 73+9*2=91 wide, offset by -9)
  auroraWrap: {
    position: 'absolute',
    top: -9,
    left: -9,
    width: 91,
    height: 91,
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
