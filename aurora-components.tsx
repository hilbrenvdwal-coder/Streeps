// Aurora components for React Native using @shopify/react-native-skia
// Extracted from Home_fixed.svg - all aurora effects with dynamic colors
//
// Setup: npm install @shopify/react-native-skia
// Docs: https://shopify.github.io/react-native-skia/

import React from 'react';
import {
  Canvas,
  Group,
  Oval,
  Path,
  BlurMask,
  LinearGradient,
  vec,
  Skia,
} from '@shopify/react-native-skia';

// ============================================================
// BLUR CONSTANT
// Figma blur 27.05 × 0.6 = 16.23 (our SVG fix)
// Skia uses the same scale as SVG stdDeviation
// ============================================================
const AURORA_BLUR = 16;
const MASK_BLUR = 3;

// ============================================================
// 1. HEADER AURORA (achtergrond bovenaan)
//    SVG: g#Vector with filter0_f
//    4 grote ellips-achtige paden, geen mask
// ============================================================
export const HeaderAurora = ({
  color1 = '#FF0085',
  color2 = '#FF00F5',
  color3 = '#00BEAE',
  color4 = '#00FE96',
  width = 390,
  height = 250,
}) => {
  return (
    <Canvas style={{ width, height, position: 'absolute', top: -50 }}>
      <Group>
        {/* Grootste ellips */}
        <Oval x={-60} y={-60} width={460} height={200} color={color1}>
          <BlurMask blur={AURORA_BLUR * 1.8} style="normal" />
        </Oval>
        {/* Middelgrote ellips */}
        <Oval x={0} y={-50} width={380} height={170} color={color2}>
          <BlurMask blur={AURORA_BLUR * 1.8} style="normal" />
        </Oval>
        {/* Kleinere ellips */}
        <Oval x={60} y={-30} width={260} height={120} color={color3}>
          <BlurMask blur={AURORA_BLUR * 1.8} style="normal" />
        </Oval>
        {/* Kleinste ellips */}
        <Oval x={110} y={-15} width={160} height={70} color={color4}>
          <BlurMask blur={AURORA_BLUR * 1.8} style="normal" />
        </Oval>
      </Group>
    </Canvas>
  );
};

// ============================================================
// 2. CATEGORY ROW AURORA (herbruikbaar voor alle rijen)
//    SVG: mask1-4 met 4 ellipsen in rounded rect mask
//    Gebruikt voor: Normaal, Speciaal, cat3, cat4
// ============================================================
export const CategoryRowAurora = ({
  color1 = '#F1F1F1',
  color2 = '#FF00F5',
  color3 = '#00BEAE',
  color4 = '#00FE96',
  width = 350,
  height = 50,
  borderRadius = 25,
}) => {
  // Rounded rect clip path
  const clipPath = Skia.Path.Make();
  clipPath.addRRect(
    Skia.RRectXY(Skia.XYWHRect(0, 0, width, height), borderRadius, borderRadius)
  );

  return (
    <Canvas style={{ width, height }}>
      <Group clip={clipPath}>
        {/* Achtergrond ellips - grootste */}
        <Oval
          x={-40}
          y={-20}
          width={width * 0.7}
          height={height * 2}
          color={color1}
        >
          <BlurMask blur={AURORA_BLUR} style="normal" />
        </Oval>
        {/* Tweede ellips */}
        <Oval
          x={0}
          y={-15}
          width={width * 0.6}
          height={height * 1.6}
          color={color2}
        >
          <BlurMask blur={AURORA_BLUR} style="normal" />
        </Oval>
        {/* Derde ellips */}
        <Oval
          x={40}
          y={-10}
          width={width * 0.45}
          height={height * 1.2}
          color={color3}
        >
          <BlurMask blur={AURORA_BLUR} style="normal" />
        </Oval>
        {/* Kleinste ellips */}
        <Oval
          x={70}
          y={-5}
          width={width * 0.3}
          height={height * 0.8}
          color={color4}
        >
          <BlurMask blur={AURORA_BLUR} style="normal" />
        </Oval>
      </Group>
    </Canvas>
  );
};

// ============================================================
// 3. DRANKENLIJST BUTTON AURORA
//    SVG: mask0 blob-vorm met 4 ellipsen
//    Unieke organische mask shape
// ============================================================
export const DrankenlijstAurora = ({
  color1 = '#00FE96',
  color2 = '#FF00F5',
  color3 = '#FF0085',
  color4 = '#00FE96',
  width = 385,
  height = 92,
}) => {
  // Blob mask path uit de SVG (genormaliseerd naar 0,0)
  const blobPath = Skia.Path.MakeFromSVGString(
    'M0 9.954C0 9.954 196.5 -11.5 273.5 9.954C350.5 31.408 385 9.954 385 9.954C385 9.954 385 51 292 74.5C199 98 0 90.954 0 90.954V9.954Z'
  );

  return (
    <Canvas style={{ width, height }}>
      <Group clip={blobPath}>
        {/* Grootste ellips */}
        <Oval x={-60} y={-30} width={460} height={130} color={color1}>
          <BlurMask blur={AURORA_BLUR} style="normal" />
        </Oval>
        {/* Tweede ellips */}
        <Oval x={-25} y={-45} width={380} height={100} color={color2}>
          <BlurMask blur={AURORA_BLUR} style="normal" />
        </Oval>
        {/* Derde ellips */}
        <Oval x={120} y={20} width={265} height={60} color={color3}>
          <BlurMask blur={AURORA_BLUR} style="normal" />
        </Oval>
        {/* Kleinste ellips */}
        <Oval x={105} y={-15} width={145} height={35} color={color4}>
          <BlurMask blur={AURORA_BLUR} style="normal" />
        </Oval>
      </Group>
    </Canvas>
  );
};

// ============================================================
// 4. LEDENLIJST AURORA (achtergrond leden sectie)
//    SVG: mask5 rechthoek met 4 ellipsen
// ============================================================
export const LedenlijstAurora = ({
  color1 = '#00FE96',
  color2 = '#FF00F5',
  color3 = '#00BEAE',
  color4 = '#00FE96',
  width = 390,
  height = 345,
}) => {
  return (
    <Canvas style={{ width, height, position: 'absolute', top: 0 }}>
      <Group>
        {/* Grootste ellips - breed en plat */}
        <Oval x={-55} y={0} width={570} height={100} color={color1}>
          <BlurMask blur={AURORA_BLUR} style="normal" />
        </Oval>
        {/* Tweede ellips */}
        <Oval x={-10} y={5} width={470} height={75} color={color2}>
          <BlurMask blur={AURORA_BLUR} style="normal" />
        </Oval>
        {/* Derde ellips */}
        <Oval x={70} y={10} width={330} height={50} color={color3}>
          <BlurMask blur={AURORA_BLUR} style="normal" />
        </Oval>
        {/* Kleinste ellips */}
        <Oval x={140} y={18} width={185} height={30} color={color4}>
          <BlurMask blur={AURORA_BLUR} style="normal" />
        </Oval>
      </Group>
    </Canvas>
  );
};

// ============================================================
// PRE-CONFIGURED ROWS (kleuren uit je Figma design)
// ============================================================

// Normaal rij - grijze/teal tinten
export const NormaalAurora = (props) => (
  <CategoryRowAurora
    color1="#3A747F"
    color2="#848484"
    color3="#848484"
    color4="#8A8A8A"
    {...props}
  />
);

// Speciaal rij - roze/paars/teal
export const SpeciaalAurora = (props) => (
  <CategoryRowAurora
    color1="#FF0085"
    color2="#FF00F5"
    color3="#00BEAE"
    color4="#FF0085"
    {...props}
  />
);

// Cat3 rij - goud/geel/paars
export const Cat3Aurora = (props) => (
  <CategoryRowAurora
    color1="#816C00"
    color2="#FCD145"
    color3="#FF00F5"
    color4="#3D3D3D"
    {...props}
  />
);

// Cat4 rij - grijs/paars/teal/groen
export const Cat4Aurora = (props) => (
  <CategoryRowAurora
    color1="#F1F1F1"
    color2="#FF00F5"
    color3="#00BEAE"
    color4="#00FE96"
    {...props}
  />
);
