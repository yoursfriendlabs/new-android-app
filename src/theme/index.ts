import type { TextStyle } from 'react-native';

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
} as const;

export const radius = {
  sm: 12,
  md: 18,
  lg: 24,
  pill: 999,
  input: 14,
} as const;

export const shadows = {
  card: {
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  raised: {
    shadowColor: '#0a2e20',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  floating: {
    shadowColor: '#111827',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  sheet: {
    shadowColor: '#111827',
    shadowOpacity: 0.16,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
  },
} as const;

/** Raw sizes. Prefer `typeScale` + the shared `<Text>` for new code. */
export const typography = {
  hero: 30,
  heading: 22,
  subheading: 18,
  body: 15,
  label: 13,
  caption: 12,
} as const;

export type TypeVariant =
  | 'display'
  | 'title'
  | 'heading'
  | 'subheading'
  | 'body'
  | 'bodyStrong'
  | 'label'
  | 'caption'
  | 'overline'
  | 'numeric'
  | 'numericLarge';

/** Size, weight, line height and tracking in one place — the source for `<Text variant>`. */
export const typeScale: Record<TypeVariant, TextStyle> = {
  display: { fontSize: 30, fontWeight: '800', lineHeight: 36, letterSpacing: -0.6 },
  title: { fontSize: 22, fontWeight: '800', lineHeight: 28, letterSpacing: -0.4 },
  heading: { fontSize: 18, fontWeight: '700', lineHeight: 24, letterSpacing: -0.2 },
  subheading: { fontSize: 16, fontWeight: '700', lineHeight: 22 },
  body: { fontSize: 15, fontWeight: '500', lineHeight: 21 },
  bodyStrong: { fontSize: 15, fontWeight: '700', lineHeight: 21 },
  label: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
  caption: { fontSize: 12, fontWeight: '500', lineHeight: 16 },
  overline: {
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 14,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  numeric: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums'],
  },
  numericLarge: {
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 34,
    letterSpacing: -0.8,
    fontVariant: ['tabular-nums'],
  },
};

/** Shared timings so every animation in the app moves at the same speed. */
export const motion = {
  duration: {
    fast: 120,
    base: 200,
    slow: 320,
  },
  spring: {
    gentle: { damping: 18, stiffness: 180, mass: 1 },
    snappy: { damping: 15, stiffness: 260, mass: 0.8 },
  },
  pressScale: 0.97,
} as const;

export const a11y = {
  minTouchTarget: 44,
  hitSlop: { top: 8, bottom: 8, left: 8, right: 8 },
} as const;

export const layout = {
  screenPadding: spacing.lg,
  stickyBarOffset: 96,
  tabletBreakpoint: 860,
  phoneGridColumns: 2,
  tabletGridColumns: 3,
  authMaxWidth: 440,
} as const;

export { buildAppPalette, defaultPalette, palette, type AppPalette } from '@/src/theme/app-palette';
export {
  COLOR_THEMES,
  CUSTOM_COLOR_THEME_ID,
  DEFAULT_COLOR_THEME_ID,
  parseHexColor,
} from '@/src/theme/color-themes';
