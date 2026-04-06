import React, { memo, useEffect, useRef } from 'react';
import { Animated, Easing, Image, View, StyleSheet, ImageSourcePropType, ViewStyle } from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';

// ── Types ──

interface ShapeLayer {
  source: ImageSourcePropType;
  color: string;
  center: { x: number; y: number };
  width: number;
  height: number;
}

interface AuroraBackgroundProps {
  mask?: ImageSourcePropType;
  width: number;
  height: number;
  shapes: ShapeLayer[];
  style?: ViewStyle;
  /** Blur padding baked into the mask PNG (blur_std * 3).
   *  MaskedView expands by this amount so the blur can bleed beyond the content area. */
  maskPadding?: number;
  animated?: boolean;
  gentle?: boolean;
}

// ── Animation config per layer (outer → inner) ──
// Non-divisible durations create an organic, non-repeating pattern.

const ANIM_CFG_BOLD = [
  { tx: 20, ty: 14, sc: 0.05, rot: 8, sx: 0.04, dTx: 4800, dTy: 6000, dSc: 7200, dRot: 9600, dSx: 8400 },
  { tx: 17, ty: 12, sc: 0.04, rot: 6, sx: 0.03, dTx: 4200, dTy: 5400, dSc: 6600, dRot: 8800, dSx: 7600 },
  { tx: 14, ty: 10, sc: 0.045, rot: 10, sx: 0.035, dTx: 3600, dTy: 4800, dSc: 6000, dRot: 7200, dSx: 6800 },
  { tx: 10, ty:  7, sc: 0.03, rot: 5, sx: 0.025, dTx: 3000, dTy: 4200, dSc: 5400, dRot: 6400, dSx: 5800 },
];

const ANIM_CFG_GENTLE = [
  { tx: 10, ty:  7, sc: 0.025, rot: 5, sx: 0.02, dTx: 5760, dTy: 7200, dSc: 8640, dRot: 11520, dSx: 10080 },
  { tx:  8, ty:  6, sc: 0.02, rot: 4, sx: 0.015, dTx: 5040, dTy: 6480, dSc: 7920, dRot: 10560, dSx: 9120 },
  { tx:  7, ty:  5, sc: 0.02, rot: 6, sx: 0.02, dTx: 4320, dTy: 5760, dSc: 7200, dRot: 8640, dSx: 8160 },
  { tx:  5, ty:  3, sc: 0.015, rot: 3, sx: 0.015, dTx: 3600, dTy: 5040, dSc: 6480, dRot: 7680, dSx: 6960 },
];

const SIN_EASE = Easing.inOut(Easing.sin);

function loopAnim(anim: Animated.Value, amp: number, duration: number) {
  const q = duration / 4;
  Animated.loop(
    Animated.sequence([
      Animated.timing(anim, { toValue:  amp, duration: q, easing: SIN_EASE, useNativeDriver: true }),
      Animated.timing(anim, { toValue:    0, duration: q, easing: SIN_EASE, useNativeDriver: true }),
      Animated.timing(anim, { toValue: -amp, duration: q, easing: SIN_EASE, useNativeDriver: true }),
      Animated.timing(anim, { toValue:    0, duration: q, easing: SIN_EASE, useNativeDriver: true }),
    ]),
  ).start();
}

function AnimatedAuroraLayer({ layer, index, gentle, animated = true }: { layer: ShapeLayer; index: number; gentle?: boolean; animated?: boolean }) {
  const cfgs = gentle ? ANIM_CFG_GENTLE : ANIM_CFG_BOLD;
  const cfg = cfgs[index] ?? cfgs[0];

  const tx = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(0)).current;
  const sc = useRef(new Animated.Value(1)).current;
  const rot = useRef(new Animated.Value(0)).current;
  const sx = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (animated) {
      loopAnim(tx, cfg.tx, cfg.dTx);
      loopAnim(ty, cfg.ty, cfg.dTy);
      loopAnim(rot, cfg.rot, cfg.dRot);
      const qSc = cfg.dSc / 4;
      Animated.loop(
        Animated.sequence([
          Animated.timing(sc, { toValue: 1 + cfg.sc, duration: qSc, easing: SIN_EASE, useNativeDriver: true }),
          Animated.timing(sc, { toValue: 1,           duration: qSc, easing: SIN_EASE, useNativeDriver: true }),
          Animated.timing(sc, { toValue: 1 - cfg.sc, duration: qSc, easing: SIN_EASE, useNativeDriver: true }),
          Animated.timing(sc, { toValue: 1,           duration: qSc, easing: SIN_EASE, useNativeDriver: true }),
        ]),
      ).start();
      const qSx = cfg.dSx / 4;
      Animated.loop(
        Animated.sequence([
          Animated.timing(sx, { toValue: 1 + cfg.sx, duration: qSx, easing: SIN_EASE, useNativeDriver: true }),
          Animated.timing(sx, { toValue: 1,           duration: qSx, easing: SIN_EASE, useNativeDriver: true }),
          Animated.timing(sx, { toValue: 1 - cfg.sx, duration: qSx, easing: SIN_EASE, useNativeDriver: true }),
          Animated.timing(sx, { toValue: 1,           duration: qSx, easing: SIN_EASE, useNativeDriver: true }),
        ]),
      ).start();
    } else {
      // Stop loops and smoothly return to rest position
      tx.stopAnimation();
      ty.stopAnimation();
      sc.stopAnimation();
      rot.stopAnimation();
      sx.stopAnimation();
      Animated.parallel([
        Animated.timing(tx,  { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(ty,  { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(sc,  { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(rot, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(sx,  { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    }

    return () => {
      tx.stopAnimation();
      ty.stopAnimation();
      sc.stopAnimation();
      rot.stopAnimation();
      sx.stopAnimation();
    };
  }, [animated]);

  // Interpolate rotation degrees to string "Xdeg"
  const rotateStr = rot.interpolate({
    inputRange: [-360, 360],
    outputRange: ['-360deg', '360deg'],
  });

  return (
    <Animated.Image
      source={layer.source}
      style={{
        position: 'absolute',
        left: layer.center.x,
        top: layer.center.y,
        width: layer.width,
        height: layer.height,
        tintColor: layer.color,
        transform: [
          { translateX: Animated.add(tx, -layer.width / 2) as any },
          { translateY: Animated.add(ty, -layer.height / 2) as any },
          { scale: sc as any },
          { rotate: rotateStr as any },
          { scaleX: sx as any },
        ],
      }}
      resizeMode="stretch"
    />
  );
}

// ── Core Component ──
// Mask blur is baked into the mask PNG at export time (per-component blur values).
// The mask PNG is larger than the content area by 2*maskPadding on each side.
// MaskedView renders at the expanded size with negative margin to compensate.

const AuroraBackground = memo(({ mask, width, height, shapes, style, maskPadding = 0, animated = false, gentle = false }: AuroraBackgroundProps) => {
  const layers = (
    <View style={{ width, height }}>
      {shapes.map((layer, i) => (
        <AnimatedAuroraLayer key={i} layer={layer} index={i} gentle={gentle} animated={animated} />
      ))}
    </View>
  );

  if (!mask) return layers;

  const pad = maskPadding;
  const expW = width + pad * 2;
  const expH = height + pad * 2;

  return (
    <MaskedView
      style={[{ width: expW, height: expH, marginLeft: -pad, marginTop: -pad }, style]}
      maskElement={
        <Image source={mask} style={{ width: expW, height: expH }} resizeMode="stretch" />
      }
    >
      <View style={{ width: expW, height: expH, paddingLeft: pad, paddingTop: pad }}>
        {layers}
      </View>
    </MaskedView>
  );
});

AuroraBackground.displayName = 'AuroraBackground';
export default AuroraBackground;

// ── Asset requires ──

const SRC = {
  header: [
    require('../../assets/aurora/header/header_p0.png'),
    require('../../assets/aurora/header/header_p1.png'),
    require('../../assets/aurora/header/header_p2.png'),
    require('../../assets/aurora/header/header_p3.png'),
  ],
  normaal: [
    require('../../assets/aurora/normaal/normaal_e0.png'),
    require('../../assets/aurora/normaal/normaal_e1.png'),
    require('../../assets/aurora/normaal/normaal_e2.png'),
    require('../../assets/aurora/normaal/normaal_e3.png'),
  ],
  speciaal: [
    require('../../assets/aurora/speciaal/speciaal_e0.png'),
    require('../../assets/aurora/speciaal/speciaal_e1.png'),
    require('../../assets/aurora/speciaal/speciaal_e2.png'),
    require('../../assets/aurora/speciaal/speciaal_e3.png'),
  ],
  cat3: [
    require('../../assets/aurora/cat3/cat3_e0.png'),
    require('../../assets/aurora/cat3/cat3_e1.png'),
    require('../../assets/aurora/cat3/cat3_e2.png'),
    require('../../assets/aurora/cat3/cat3_e3.png'),
  ],
  cat4: [
    require('../../assets/aurora/cat4/cat4_e0.png'),
    require('../../assets/aurora/cat4/cat4_e1.png'),
    require('../../assets/aurora/cat4/cat4_e2.png'),
    require('../../assets/aurora/cat4/cat4_e3.png'),
  ],
  drankenlijst: [
    require('../../assets/aurora/drankenlijst/drankenlijst_p0.png'),
    require('../../assets/aurora/drankenlijst/drankenlijst_p1.png'),
    require('../../assets/aurora/drankenlijst/drankenlijst_p2.png'),
    require('../../assets/aurora/drankenlijst/drankenlijst_p3.png'),
  ],
  leden: [
    require('../../assets/aurora/leden/leden_p0.png'),
    require('../../assets/aurora/leden/leden_p1.png'),
    require('../../assets/aurora/leden/leden_p2.png'),
    require('../../assets/aurora/leden/leden_p3.png'),
  ],
  counter: [
    require('../../assets/aurora/counter/counter_e0.png'),
    require('../../assets/aurora/counter/counter_e1.png'),
    require('../../assets/aurora/counter/counter_e2.png'),
    require('../../assets/aurora/counter/counter_e3.png'),
  ],
  login: [
    require('../../assets/aurora/login/login_p0.png'),
    require('../../assets/aurora/login/login_p1.png'),
    require('../../assets/aurora/login/login_p2.png'),
    require('../../assets/aurora/login/login_p3.png'),
    require('../../assets/aurora/login/login_p4.png'),
    require('../../assets/aurora/login/login_p5.png'),
    require('../../assets/aurora/login/login_p6.png'),
    require('../../assets/aurora/login/login_p7.png'),
  ],
};

const MASKS = {
  normaal: require('../../assets/aurora/normaal/normaal_mask.png'),
  speciaal: require('../../assets/aurora/speciaal/speciaal_mask.png'),
  cat3: require('../../assets/aurora/cat3/cat3_mask.png'),
  cat4: require('../../assets/aurora/cat4/cat4_mask.png'),
  drankenlijst: require('../../assets/aurora/drankenlijst/drankenlijst_mask.png'),
  leden: require('../../assets/aurora/leden/leden_mask.png'),
  counter: require('../../assets/aurora/counter/counter_mask.png'),
};

// ── Extracted data from Home_fixed_v3.svg ──
// Per shape: [centerX, centerY, pngLogicalWidth, pngLogicalHeight]

const DATA = {
  header: {
    container: { w: 490, h: 370 }, maskPad: 0,
    shapes: [
      [179.52, 15.96, 646, 432],
      [176.96, 16.68, 560, 373],
      [191.33,  9.58, 440, 300],
      [187.91, 10.53, 322, 241],
    ],
  },
  normaal: {
    container: { w: 381, h: 80 }, maskPad: 0,
    shapes: [
      [105.32, 27.72, 348, 155],
      [103.84, 27.87, 303, 141],
      [112.29, 26.17, 239, 124],
      [110.30, 26.37, 175, 111],
    ],
  },
  speciaal: {
    container: { w: 380, h: 80 }, maskPad: 0,
    shapes: [
      [ 96.73, 33.36, 363, 166],
      [ 95.16, 33.52, 315, 149],
      [104.01, 31.59, 247, 129],
      [101.92, 31.81, 180, 113],
    ],
  },
  cat3: {
    container: { w: 380, h: 80 }, maskPad: 0,
    shapes: [
      [110.43, 49.00, 361, 163],
      [108.20, 43.38, 313, 146],
      [117.75, 47.95, 246, 126],
      [115.68, 47.96, 179, 111],
    ],
  },
  cat4: {
    container: { w: 380, h: 80 }, maskPad: 0,
    shapes: [
      [108.96, 32.50, 306, 145],
      [107.72, 32.62, 269, 134],
      [114.77, 31.20, 216, 120],
      [113.12, 31.37, 162, 109],
    ],
  },
  drankenlijst: {
    container: { w: 420, h: 120 }, maskPad: 60,  // blur=20, pad=20*3
    shapes: [
      [187.78,  -6.21, 570, 236],
      [185.05,  -6.27, 485, 201],
      [273.55,  38.71, 364, 159],
      [197.38,  -7.98, 244, 128],
    ],
  },
  leden: {
    container: { w: 420, h: 380 }, maskPad: 60,
    shapes: [
      [234.28, 39.03, 729, 202],
      [230.77, 39.38, 613, 178],
      [250.69, 36.22, 450, 148],
      [246.01, 36.67, 291, 124],
    ],
  },
  counter: {
    container: { w: 73, h: 73 }, maskPad: 9,  // blur=3, pad=3*3
    shapes: [
      [36.5,  41.5,  65, 61],
      [17.0,  38.23, 55, 51],
      [58.85, 57.04, 45, 49],
      [46,    16.5,  60, 47],
    ],
  },
  login: {
    container: { w: 590, h: 500 }, maskPad: 0,
    shapes: [
      [232.38, 3.83, 564, 711],
      [274.84, 3.83, 564, 711],
      [330.43, 5.59, 564, 711],
      [382.05, 9.11, 564, 711],
      [53.91, 187.94, 520, 506],
      [29.15, 167.55, 520, 506],
      [-2.64, 140.08, 520, 506],
      [-31.48, 113.75, 520, 506],
    ],
  },
} as const;

// ── Default colors ──

export const AURORA_COLORS = {
  header:       ['#FF004D', '#FF00F5', '#00BEAE', '#00FE96'],
  normaal:      ['#3A747F', '#848484', '#848484', '#8A8A8A'],
  speciaal:     ['#FF0085', '#FF00F5', '#00BEAE', '#FF0085'],
  cat3:         ['#816C00', '#FCD145', '#FF00F5', '#3D3D3D'],
  cat4:         ['#F1F1F1', '#FF00F5', '#00BEAE', '#00FE96'],
  drankenlijst: ['#00FE96', '#FF00F5', '#FF0085', '#00FE96'],
  leden:        ['#00FE96', '#FF00F5', '#00BEAE', '#00FE96'],
  counter:      ['#FF0085', '#FF00F5', '#00BEAE', '#00FE96'],
  login:        ['#FF0085', '#FF00F5', '#00BEAE', '#00FE96', '#FF0085', '#FF00F5', '#00BEAE', '#00FE96'],
} as const;

export type AuroraPreset = 'header' | 'normaal' | 'speciaal' | 'cat3' | 'cat4' | 'drankenlijst' | 'leden' | 'counter' | 'login';

// ── Build shapes from data ──

function buildShapes(
  preset: AuroraPreset,
  colors: readonly string[] | string[],
): ShapeLayer[] {
  const sources = SRC[preset];
  const d = DATA[preset];
  return sources.map((src, i) => ({
    source: src,
    color: colors[i],
    center: { x: d.shapes[i][0], y: d.shapes[i][1] },
    width: d.shapes[i][2],
    height: d.shapes[i][3],
  }));
}

// ── Preset convenience component ──

export const AuroraPresetView = memo(({
  preset,
  colors,
  style,
  animated,
  gentle,
  noMask,
}: {
  preset: AuroraPreset;
  colors?: string[];
  style?: ViewStyle;
  animated?: boolean;
  gentle?: boolean;
  /** Skip the mask PNG — parent handles clipping via borderRadius + overflow:hidden */
  noMask?: boolean;
}) => {
  const c = colors ?? AURORA_COLORS[preset];
  const d = DATA[preset];
  const shapes = buildShapes(preset, c);
  const mask = (noMask || preset === 'header') ? undefined : MASKS[preset as keyof typeof MASKS];

  return (
    <AuroraBackground
      mask={mask}
      width={d.container.w}
      height={d.container.h}
      shapes={shapes}
      style={style}
      maskPadding={d.maskPad}
      animated={animated}
      gentle={gentle}
    />
  );
});

AuroraPresetView.displayName = 'AuroraPresetView';
