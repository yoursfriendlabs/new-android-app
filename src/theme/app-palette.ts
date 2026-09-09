import {
  bestForeground,
  deriveDarkTheme,
  ensureReadablePrimary,
  getColorTheme,
  onPrimaryColor,
  type ColorThemeDefinition,
} from '@/src/theme/color-themes';

export type ThemeMode = 'light' | 'dark';

/** Status colours that are not derived from the brand hue, per mode. */
const STATUS_COLORS = {
  light: {
    success: '#108c5a',
    successSoft: '#e6f4ea',
    danger: '#d32f2f',
    dangerSoft: '#fde8e8',
    warning: '#b45309',
    warningSoft: '#fef3c7',
    info: '#476c9b',
    infoSoft: '#e9f0fa',
    purple: '#a669ff',
    purpleSoft: '#f1e6ff',
    textSoft: '#8b8f98',
    borderStrong: '#cbd5e1',
  },
  dark: {
    success: '#3ddc97',
    successSoft: '#12281f',
    danger: '#ff6b6b',
    dangerSoft: '#2e1618',
    warning: '#fbbf24',
    warningSoft: '#2b2010',
    info: '#7ab0ef',
    infoSoft: '#152232',
    purple: '#c39bff',
    purpleSoft: '#241a33',
    textSoft: '#8d968f',
    borderStrong: '#3a4440',
  },
} as const;

export function buildAppPalette(theme: ColorThemeDefinition, mode: ThemeMode = 'light') {
  const source = mode === 'dark' ? deriveDarkTheme(theme) : theme;
  const status = STATUS_COLORS[mode];
  const primary = source.colors.primary;
  const mist = source.colors.mist;
  // Light mode keeps its established rule; dark accents are light, so there the
  // foreground has to be picked by contrast or white-on-lime becomes unreadable.
  const onPrimary =
    mode === 'dark'
      ? bestForeground(primary.DEFAULT, mist)
      : onPrimaryColor(primary.DEFAULT, source.colors.ink);

  return {
    primary: primary.DEFAULT,
    /** Use for primary-coloured *text* — some accents (Signal Lime) are unreadable on a light surface. */
    primaryText: mode === 'dark' ? primary.DEFAULT : ensureReadablePrimary(primary.DEFAULT) || primary.DEFAULT,
    primaryPressed: primary[600],
    onPrimary,
    onSuccess: bestForeground(status.success, mode === 'dark' ? mist : '#0b1f16'),
    onDanger: bestForeground(status.danger, mode === 'dark' ? mist : '#2a0d0d'),
    onInfo: bestForeground(status.info, mode === 'dark' ? mist : '#0d1a2a'),
    onWarning: bestForeground(status.warning, mode === 'dark' ? mist : '#2a1a05'),
    accent: primary.DEFAULT,
    accentPressed: primary[600],
    accentSoft: primary[50],
    accentMuted: primary[200],
    header: source.colors.surface,
    headerSoft: mist,
    background: mist,
    backgroundAlt: primary[200],
    backgroundWarm: primary[50],
    surface: source.colors.surface,
    surfaceMuted: mist,
    input: primary[100],
    text: source.colors.ink,
    textMuted: source.colors.inkLight,
    textSoft: status.textSoft,
    border: primary[200],
    borderStrong: status.borderStrong,
    success: status.success,
    successSoft: status.successSoft,
    successBright: status.success,
    warning: status.warning,
    warningSoft: status.warningSoft,
    warningBright: status.warning,
    danger: status.danger,
    dangerSoft: status.dangerSoft,
    dangerBright: status.danger,
    info: status.info,
    infoSoft: status.infoSoft,
    blueSoft: primary[50],
    blue: primary.DEFAULT,
    purpleSoft: status.purpleSoft,
    purple: status.purple,
    greenSoft: status.successSoft,
    chipNeutral: primary[200],
    black: '#000000',
    white: '#ffffff',
    /** Which mode this palette was built for — for status bars and images. */
    mode,
  };
}

export type AppPalette = ReturnType<typeof buildAppPalette>;

export const defaultPalette = buildAppPalette(getColorTheme());
export const palette = defaultPalette;
