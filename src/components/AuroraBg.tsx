import React from 'react';
import { StyleSheet, View, Image, ViewStyle } from 'react-native';

/**
 * AuroraBg — Pixel-perfect aurora backgrounds exported from Figma.
 *
 * Images are pre-rendered @2x with transforms, blur, and clipping applied.
 * Most presets stretch to fill; leden is positioned at top only.
 * Parent must have overflow:'hidden' + borderRadius.
 */

export type AuroraPreset =
  | 'cat1' | 'cat2' | 'cat3' | 'cat4'
  | 'groupCard'
  | 'drankenlijst' | 'leden' | 'instellingen';

type PresetConfig = {
  source: any;
  /** If true, position at top with natural aspect instead of stretching */
  topOnly?: boolean;
  /** Native @2x dimensions for aspect ratio */
  width?: number;
  height?: number;
};

const PRESETS: Record<AuroraPreset, PresetConfig> = {
  cat1:          { source: require('../../assets/aurora/cat1_normaal.png') },
  cat2:          { source: require('../../assets/aurora/cat2_speciaal.png') },
  cat3:          { source: require('../../assets/aurora/cat3.png') },
  cat4:          { source: require('../../assets/aurora/cat4.png') },
  groupCard:     { source: require('../../assets/aurora/group_card.png') },
  drankenlijst:  { source: require('../../assets/aurora/drankenlijst.png') },
  instellingen:  { source: require('../../assets/aurora/instellingen.png') },
  leden:         { source: require('../../assets/aurora/leden.png'), topOnly: true, width: 700, height: 199 },
};

interface AuroraBgProps {
  preset?: AuroraPreset;
  borderRadius?: number;
  style?: ViewStyle;
}

export default function AuroraBg({ preset, borderRadius = 25, style }: AuroraBgProps) {
  if (!preset || !PRESETS[preset]) return null;
  const p = PRESETS[preset];

  return (
    <View
      style={[StyleSheet.absoluteFillObject, { overflow: 'hidden', borderRadius }, style]}
      pointerEvents="none"
    >
      {p.topOnly ? (
        <Image
          source={p.source}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            aspectRatio: (p.width || 700) / (p.height || 199),
          }}
          resizeMode="stretch"
        />
      ) : (
        <Image
          source={p.source}
          style={StyleSheet.absoluteFillObject}
          resizeMode="stretch"
        />
      )}
    </View>
  );
}
