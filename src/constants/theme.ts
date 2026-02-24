import { Platform } from 'react-native';

// ─── Palette ──────────────────────────────────────────────────────────────────
export const DARK_COLORS = {
  // Core
  primary: '#FF7A00',   // Vivid orange
  primaryDim: '#CC6200',
  primaryGlow: 'rgba(255, 122, 0, 0.28)',
  primarySubtle: 'rgba(255, 122, 0, 0.12)',

  // Backgrounds – three tiers
  background: '#0C0C0C',   // near-black
  surface: '#161616',   // card bg
  surfaceHigh: '#202020',   // elevated card / panel
  surfaceGlass: 'rgba(22, 22, 22, 0.82)',  // frosted glass panels

  // Text
  text: '#F2F2F2',
  textSecondary: '#8A8A8A',
  textMuted: '#4A4A4A',

  // Borders
  border: '#2A2A2A',
  borderSubtle: 'rgba(255,255,255,0.07)',
  borderGlass: 'rgba(255,255,255,0.13)',

  // Semantic
  error: '#FF4E6A',
  success: '#00D9A0',
  warning: '#FFB300',

  // Fixed
  white: '#FFFFFF',
  black: '#000000',

  // Player-specific overlays
  controlScrim: 'rgba(0,0,0,0.52)',
  controlScrimTop: 'rgba(0,0,0,0.64)',
  gradientOverlay: 'rgba(0,0,0,0)',
};

export const LIGHT_COLORS: typeof DARK_COLORS = {
  // Core
  primary: '#FF7A00',   // Vivid orange (same brand color)
  primaryDim: '#CC6200',
  primaryGlow: 'rgba(255, 122, 0, 0.15)',
  primarySubtle: 'rgba(255, 122, 0, 0.08)',

  // Backgrounds – three tiers
  background: '#F5F5F7',   // clean light gray/white
  surface: '#FFFFFF',   // bright card bg
  surfaceHigh: '#FFFFFF',   // elevated card / panel (relies on shadow in light mode)
  surfaceGlass: 'rgba(255, 255, 255, 0.85)',  // light frosted glass

  // Text
  text: '#1C1C1E',
  textSecondary: '#6C6C70',
  textMuted: '#A1A1A6',

  // Borders
  border: '#E5E5EA',
  borderSubtle: 'rgba(0,0,0,0.05)',
  borderGlass: 'rgba(0,0,0,0.08)',

  // Semantic
  error: '#FF3B30',
  success: '#34C759',
  warning: '#FFCC00',

  // Fixed
  white: '#FFFFFF',
  black: '#000000',

  // Player-specific overlays (these should remain somewhat dark for video contrast)
  controlScrim: 'rgba(0,0,0,0.40)',
  controlScrimTop: 'rgba(0,0,0,0.50)',
  gradientOverlay: 'rgba(0,0,0,0)',
};

// Temporarily expose COLORS as DARK_COLORS so we don't instantly break the entire app before refactoring
export const COLORS = DARK_COLORS;

// ─── Spacing ──────────────────────────────────────────────────────────────────
export const SPACING = {
  xxs: 2,
  xs: 4,
  s: 8,
  m: 16,
  l: 24,
  xl: 32,
  xxl: 48,
};

// ─── Typography ───────────────────────────────────────────────────────────────
export const FONT_SIZE = {
  xxs: 10,
  xs: 12,
  s: 14,
  m: 16,
  l: 18,
  xl: 22,
  xxl: 28,
  xxxl: 36,
};

export const FONT_WEIGHT = {
  regular: '400' as const,
  medium: '500' as const,
  semiBold: '600' as const,
  bold: '700' as const,
  heavy: '800' as const,
};

export const LETTER_SPACING = {
  tight: -0.3,
  normal: 0,
  wide: 0.5,
  wider: 1.0,
};

// ─── Border Radii ─────────────────────────────────────────────────────────────
export const RADIUS = {
  xs: 4,
  s: 8,
  m: 12,
  l: 16,
  xl: 24,
  full: 999,
};

// ─── Shadows ──────────────────────────────────────────────────────────────────
export const SHADOW = {
  small: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.35,
      shadowRadius: 4,
    },
    android: { elevation: 3 },
    default: {},
  }),
  medium: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.45,
      shadowRadius: 8,
    },
    android: { elevation: 6 },
    default: {},
  }),
  large: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.55,
      shadowRadius: 16,
    },
    android: { elevation: 12 },
    default: {},
  }),
  orange: Platform.select({
    ios: {
      shadowColor: '#FF7A00',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.55,
      shadowRadius: 12,
    },
    android: { elevation: 8 },
    default: {},
  }),
};
