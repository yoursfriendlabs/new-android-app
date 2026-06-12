export const palette = {
  primary: '#af865d',
  primaryPressed: '#8c643f',
  accent: '#af865d',
  accentPressed: '#8c643f',
  accentSoft: '#fdf9f4',
  accentMuted: '#eeddc8',
  header: '#ffffff',
  headerSoft: '#faf8f5',
  background: '#faf8f5',
  backgroundAlt: '#eeddc8',
  backgroundWarm: '#fdf9f4',
  surface: '#ffffff',
  surfaceMuted: '#faf8f5',
  input: '#f4ece2',
  text: '#2e251b',
  textMuted: '#7c6d5e',
  textSoft: '#a69788',
  border: '#e6ded4',
  borderStrong: '#cbd5e1',
  success: '#108c5a',
  successSoft: '#e6f4ea',
  successBright: '#108c5a',
  warning: '#af865d',
  warningSoft: '#fdf9f4',
  warningBright: '#eeddc8',
  danger: '#d32f2f',
  dangerSoft: '#fde8e8',
  dangerBright: '#d32f2f',
  info: '#476c9b',
  infoSoft: '#e9f0fa',
  blueSoft: '#fdf9f4',
  blue: '#af865d',
  purpleSoft: '#f1e6ff',
  purple: '#a669ff',
  greenSoft: '#e6f4ea',
  chipNeutral: '#eeddc8',
  black: '#000000',
  white: '#ffffff',
} as const;

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
} as const;

export const shadows = {
  card: {
    shadowColor: '#2f2111',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  floating: {
    shadowColor: '#2f2111',
    shadowOpacity: 0.12,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
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
} as const;
