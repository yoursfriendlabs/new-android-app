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
  floating: {
    shadowColor: '#111827',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
} as const;

export const typography = {
  hero: 30,
  heading: 22,
  subheading: 18,
  body: 15,
  label: 13,
  caption: 12,
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
