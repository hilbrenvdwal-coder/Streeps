/**
 * Streeps Design System — Theme Tokens
 *
 * Central source of truth for all design tokens.
 * Used across the app for consistent styling.
 *
 * Can be adapted to Gluestack UI createConfig / NativeWind
 * when those libraries are added.
 */

import { Platform } from 'react-native';

// ─── Brand ──────────────────────────────────────────────────────────────────

export const brand = {
  magenta: '#FF004D',
  streepsRed: '#FF0085',   // Figma --streepsred: buttons, nav pill
  cyan: '#00BEAE',
  green: '#00FE96',        // Figma --streepsgreen: confirmation
  blue: '#4A6CF7',
  purple: '#8B5CF6',
  streepsWhite: '#F1F1F1', // Figma --streepswhite: input bg, text on dark
  inactive: '#848484',     // Figma --inactivewords: placeholder, inactive
  gradient: ['#E91E8C', '#8B5CF6', '#4A6CF7', '#00BEAE'] as const,
  bg: { from: '#0E0D1C', to: '#3D3D3D' } as const, // Screen background gradient
} as const;

// ─── Aurora Background Stops ─────────────────────────────────────────────────

export const aurora = {
  pink: 'rgba(233, 30, 140, 0.35)',
  green: 'rgba(0, 217, 163, 0.30)',
  purple: 'rgba(139, 92, 246, 0.25)',
} as const;

// ─── Category Colors ────────────────────────────────────────────────────────

export const categoryColors = [
  brand.cyan,
  brand.magenta,
  brand.blue,
  brand.purple,
] as const;

// ─── Semantic Colors (theme-independent) ────────────────────────────────────

export const semantic = {
  success: '#34D399',
  successBg: '#34D39915',
  error: '#FF5272',
  errorBg: '#FF527215',
  warning: '#FBBF24',
  warningBg: '#FBBF2415',
  info: '#4A6CF7',
  infoBg: '#4A6CF715',
} as const;

// ─── Theme Colors ───────────────────────────────────────────────────────────

const darkColors = {
  background: {
    primary: '#0F0F1E',
    secondary: '#1A1A2E',
  },
  surface: {
    default: '#252540',
    raised: '#2D2D44',
    overlay: '#3A3A55',
  },
  text: {
    primary: '#FFFFFF',
    secondary: '#A0A0B8',
    tertiary: '#666680',
    inverse: '#1A1A2E',
  },
  border: {
    default: '#2D2D44',
    strong: '#3A3A55',
  },
  icon: {
    default: '#666680',
    active: brand.cyan,
  },
  tint: brand.cyan,
  accent: brand.magenta,
  // Interactive
  ripple: 'rgba(0, 217, 163, 0.12)',
  focusRing: brand.cyan,
  scrim: 'rgba(0, 0, 0, 0.5)',
} as const;

const lightColors = {
  background: {
    primary: '#F0F0F8',
    secondary: '#F5F5FA',
  },
  surface: {
    default: '#FFFFFF',
    raised: '#FFFFFF',
    overlay: '#FFFFFF',
  },
  text: {
    primary: '#1A1A2E',
    secondary: '#4A4A68',
    tertiary: '#8888A0',
    inverse: '#FFFFFF',
  },
  border: {
    default: '#E0E0E8',
    strong: '#C8C8D8',
  },
  icon: {
    default: '#A0A0B0',
    active: brand.magenta,
  },
  tint: brand.magenta,
  accent: brand.cyan,
  // Interactive
  ripple: 'rgba(233, 30, 140, 0.12)',
  focusRing: brand.magenta,
  scrim: 'rgba(0, 0, 0, 0.4)',
} as const;

export type ThemeColors = typeof darkColors;
export const colors = { dark: darkColors, light: lightColors } as const;

// ─── Spacing (4px grid) ─────────────────────────────────────────────────────

export const space = {
  0: 0,
  0.5: 2,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

// ─── Border Radius ──────────────────────────────────────────────────────────

export const radius = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  full: 9999,
} as const;

// ─── Typography ─────────────────────────────────────────────────────────────

export const fontWeights = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

export const typography = {
  display: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: fontWeights.bold,
  },
  heading1: {
    fontSize: 26,
    lineHeight: 34,
    fontWeight: fontWeights.bold,
  },
  heading2: {
    fontSize: 22,
    lineHeight: 30,
    fontWeight: fontWeights.semibold,
  },
  heading3: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: fontWeights.semibold,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: fontWeights.regular,
  },
  bodyMedium: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: fontWeights.medium,
  },
  bodySm: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: fontWeights.regular,
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: fontWeights.regular,
  },
  captionMedium: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: fontWeights.medium,
  },
  overline: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: fontWeights.semibold,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
  },
  tally: {
    fontSize: 48,
    lineHeight: 56,
    fontWeight: fontWeights.bold,
  },
  tallySm: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: fontWeights.bold,
  },
} as const;

// ─── Shadows ────────────────────────────────────────────────────────────────

export const shadows = {
  none: {},
  sm: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 2,
    },
    android: { elevation: 2 },
    default: {},
  }),
  md: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
    },
    android: { elevation: 4 },
    default: {},
  }),
  lg: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
    },
    android: { elevation: 8 },
    default: {},
  }),
  xl: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.16,
      shadowRadius: 24,
    },
    android: { elevation: 16 },
    default: {},
  }),
} as const;

// ─── Glows (dark theme accent effects) ──────────────────────────────────────

export const glows = {
  cyan: Platform.select({
    ios: {
      shadowColor: brand.cyan,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.2,
      shadowRadius: 20,
    },
    android: {}, // Android doesn't support colored shadows natively
    default: {},
  }),
  magenta: Platform.select({
    ios: {
      shadowColor: brand.magenta,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.2,
      shadowRadius: 20,
    },
    android: {},
    default: {},
  }),
  subtle: Platform.select({
    ios: {
      shadowColor: brand.cyan,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
    },
    android: {},
    default: {},
  }),
  green: Platform.select({
    ios: {
      shadowColor: brand.green,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.4,
      shadowRadius: 24,
    },
    android: {},
    default: {},
  }),
} as const;

// ─── Animation Tokens ───────────────────────────────────────────────────────

export const animation = {
  instant: { duration: 100 },
  fast: { duration: 150 },
  normal: { duration: 250 },
  slow: { duration: 350 },
  spring: {
    damping: 12,
    mass: 1,
    stiffness: 80,
  },
  press: {
    scale: 0.97,
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.38,
  },
} as const;

// ─── Component Sizes ────────────────────────────────────────────────────────

export const components = {
  button: {
    sm: { height: 36, paddingHorizontal: space[3], ...typography.bodySm, fontWeight: fontWeights.medium },
    md: { height: 44, paddingHorizontal: space[4], ...typography.bodyMedium },
    lg: { height: 52, paddingHorizontal: space[5], ...typography.heading3 },
  },
  input: {
    height: 48,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    borderRadius: radius.sm,
    fontSize: typography.body.fontSize,
    pill: {
      height: 52,
      borderRadius: 9999,
      backgroundColor: '#E8E8F0',
      paddingHorizontal: space[5],
    },
  },
  avatar: {
    xs: { size: 28, fontSize: 12 },
    sm: { size: 36, fontSize: 14 },
    md: { size: 44, fontSize: 18 },
    lg: { size: 64, fontSize: 24 },
    xl: { size: 80, fontSize: 32 },
  },
  tabBar: {
    height: 56,
    iconSize: 24,
    labelSize: typography.caption.fontSize,
  },
  navBar: {
    height: 77,
    pillWidth: 80,
    pillHeight: 50,
    pillRadius: 44,
    iconSize: 32,
  },
  counter: {
    size: 73,
    borderRadius: 25,
  },
  card: {
    padding: space[4],
    borderRadius: radius.md,
  },
  badge: {
    height: 24,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    fontSize: typography.captionMedium.fontSize,
    fontWeight: fontWeights.medium,
  },
  modal: {
    borderRadius: radius.xl,
    padding: space[5],
    handleWidth: 36,
    handleHeight: 4,
  },
  listItem: {
    minHeight: 48,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
  },
  icon: {
    xs: 16,
    sm: 20,
    md: 24,
    lg: 32,
  },
} as const;

// ─── Z-Index Scale ──────────────────────────────────────────────────────────

export const zIndex = {
  base: 0,
  sticky: 10,
  dropdown: 20,
  navigation: 30,
  modal: 40,
  toast: 50,
  overlay: 100,
} as const;

// ─── Screen Layout Tokens ───────────────────────────────────────────────────

export const layout = {
  screenPaddingH: space[5],    // 20px
  screenPaddingTop: space[4],   // 16px
  sectionGap: space[6],        // 24px
  cardGap: space[3],           // 12px
  iconTextGap: space[2],       // 8px
} as const;

// ─── Helper: get theme colors ───────────────────────────────────────────────

export function getTheme(mode: 'light' | 'dark') {
  return {
    colors: colors[mode],
    brand,
    aurora,
    semantic,
    categoryColors,
    space,
    radius,
    typography,
    fontWeights,
    shadows,
    glows: mode === 'dark' ? glows : { cyan: {}, magenta: {}, subtle: {}, green: {} },
    animation,
    components,
    zIndex,
    layout,
  };
}

export type Theme = ReturnType<typeof getTheme>;
