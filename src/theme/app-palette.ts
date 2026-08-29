import { getColorTheme, onPrimaryColor, type ColorThemeDefinition } from '@/src/theme/color-themes';

export function buildAppPalette(theme: ColorThemeDefinition) {
  const primary = theme.colors.primary;
  const mist = theme.colors.mist;
  const onPrimary = onPrimaryColor(primary.DEFAULT, theme.colors.ink);

  return {
    primary: primary.DEFAULT,
    primaryPressed: primary[600],
    onPrimary,
    accent: primary.DEFAULT,
    accentPressed: primary[600],
    accentSoft: primary[50],
    accentMuted: primary[200],
    header: theme.colors.surface,
    headerSoft: mist,
    background: mist,
    backgroundAlt: primary[200],
    backgroundWarm: primary[50],
    surface: theme.colors.surface,
    surfaceMuted: mist,
    input: primary[100],
    text: theme.colors.ink,
    textMuted: theme.colors.inkLight,
    textSoft: '#8b8f98',
    border: primary[200],
    borderStrong: '#cbd5e1',
    success: '#108c5a',
    successSoft: '#e6f4ea',
    successBright: '#108c5a',
    warning: primary.DEFAULT,
    warningSoft: primary[50],
    warningBright: primary[200],
    danger: '#d32f2f',
    dangerSoft: '#fde8e8',
    dangerBright: '#d32f2f',
    info: '#476c9b',
    infoSoft: '#e9f0fa',
    blueSoft: primary[50],
    blue: primary.DEFAULT,
    purpleSoft: '#f1e6ff',
    purple: '#a669ff',
    greenSoft: '#e6f4ea',
    chipNeutral: primary[200],
    black: '#000000',
    white: '#ffffff',
  };
}

export type AppPalette = ReturnType<typeof buildAppPalette>;

export const defaultPalette = buildAppPalette(getColorTheme());
export const palette = defaultPalette;
