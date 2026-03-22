// Brand colors extracted from Streeps logo
export const Brand = {
  magenta: '#E91E8C',
  cyan: '#00D9A3',
  blue: '#4A6CF7',
  purple: '#8B5CF6',
  gradient: ['#E91E8C', '#8B5CF6', '#4A6CF7', '#00D9A3'] as const,
};

export const Colors = {
  dark: {
    text: '#FFFFFF',
    textSecondary: '#A0A0A0',
    background: '#1A1A2E',
    surface: '#2D2D44',
    surfaceLight: '#3A3A55',
    tint: Brand.cyan,
    accent: Brand.magenta,
    tabIconDefault: '#666680',
    tabIconSelected: Brand.cyan,
    border: '#3A3A55',
    success: '#4CAF50',
    error: '#FF5252',
    warning: '#FFB74D',
    card: '#252540',
  },
  light: {
    text: '#1A1A2E',
    textSecondary: '#666680',
    background: '#F5F5FA',
    surface: '#FFFFFF',
    surfaceLight: '#E8E8F0',
    tint: Brand.magenta,
    accent: Brand.cyan,
    tabIconDefault: '#A0A0B0',
    tabIconSelected: Brand.magenta,
    border: '#E0E0E8',
    success: '#4CAF50',
    error: '#FF5252',
    warning: '#FFB74D',
    card: '#FFFFFF',
  },
};

export default Colors;
