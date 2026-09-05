export const COLOR_THEME_STORAGE_KEY = 'pasalmanager.color_theme';
export const CUSTOM_PRIMARY_STORAGE_KEY = 'pasalmanager.custom_primary';
export const THEME_BRAND_MIGRATION_KEY = 'pasalmanager.theme_brand_forest_0a2e20';
export const DEFAULT_COLOR_THEME_ID = 'forest';
export const LEGACY_DEFAULT_COLOR_THEME_ID = 'signal';
export const CUSTOM_COLOR_THEME_ID = 'custom';

export const BRAND_COLORS = {
  forest: '#0A2E20',
  signalLime: '#8FE03F',
  paper: '#F4F9F0',
  white: '#FFFFFF',
} as const;

export interface ToneScale {
  DEFAULT: string;
  50: string;
  100: string;
  200: string;
  300: string;
  400: string;
  500: string;
  600: string;
  700: string;
  800: string;
  900: string;
}

export interface ColorThemeDefinition {
  id: string;
  swatch: string;
  sourceHex?: string;
  label: string;
  hint: string;
  colors: {
    primary: ToneScale;
    secondary: ToneScale;
    ink: string;
    inkLight: string;
    mist: string;
    surface: string;
  };
}

export const NEUTRAL_COLORS = {
  secondary: {
    DEFAULT: '#6b7280',
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
  },
  ink: '#111827',
  inkLight: '#4b5563',
  surface: '#ffffff',
} as const;

export const COLOR_THEMES: ColorThemeDefinition[] = [
  {
    id: 'forest',
    swatch: BRAND_COLORS.forest,
    label: 'Forest Green',
    hint: 'The PM brand color. Deep pine green for actions and contrast.',
    colors: {
      primary: {
        DEFAULT: BRAND_COLORS.forest,
        50: BRAND_COLORS.paper,
        100: '#e4efe7',
        200: '#c3dfcc',
        300: '#97c7a5',
        400: '#5ea976',
        500: BRAND_COLORS.forest,
        600: '#08261b',
        700: '#061e15',
        800: '#04150f',
        900: '#020b08',
      },
      secondary: {
        DEFAULT: '#3f7a63',
        50: '#f3f8f5',
        100: '#e6f1eb',
        200: '#c9e0d3',
        300: '#9fc4b0',
        400: '#6fa08a',
        500: '#3f7a63',
        600: '#356a55',
        700: '#2b5646',
        800: '#224438',
        900: '#1a342b',
      },
      ink: '#111827',
      inkLight: '#3f5e4e',
      mist: BRAND_COLORS.paper,
      surface: BRAND_COLORS.white,
    },
  },
  {
    id: 'signal',
    swatch: BRAND_COLORS.signalLime,
    label: 'Signal Lime',
    hint: 'Lime for vibrant highlights and actions.',
    colors: {
      primary: {
        DEFAULT: BRAND_COLORS.signalLime,
        50: BRAND_COLORS.paper,
        100: '#e7f6d6',
        200: '#cdeeaa',
        300: '#b3e57d',
        400: '#9fe85c',
        500: BRAND_COLORS.signalLime,
        600: '#72c42a',
        700: '#58991f',
        800: '#3d6b16',
        900: BRAND_COLORS.forest,
      },
      secondary: {
        DEFAULT: BRAND_COLORS.forest,
        50: BRAND_COLORS.paper,
        100: '#dce8e0',
        200: '#b7cdc0',
        300: '#87a896',
        400: '#587e6b',
        500: BRAND_COLORS.forest,
        600: '#082418',
        700: '#061c13',
        800: '#04140e',
        900: '#020c08',
      },
      ink: BRAND_COLORS.forest,
      inkLight: '#3f5e4e',
      mist: BRAND_COLORS.paper,
      surface: BRAND_COLORS.white,
    },
  },
  {
    id: 'teak',
    swatch: '#9b6835',
    label: 'Teak',
    hint: 'Warm wood for shops that prefer a classic counter look.',
    colors: {
      primary: {
        DEFAULT: '#9b6835',
        50: '#fcfaf8',
        100: '#f7f2ed',
        200: '#ede0d1',
        300: '#dec7af',
        400: '#c7a382',
        500: '#9b6835',
        600: '#8c5e30',
        700: '#754e28',
        800: '#5e3e20',
        900: '#4d331a',
      },
      secondary: {
        DEFAULT: '#a57749',
        50: '#fbf9f7',
        100: '#f6f1ec',
        200: '#e9dbcf',
        300: '#d7bcab',
        400: '#bc9680',
        500: '#a57749',
        600: '#956b42',
        700: '#7c5937',
        800: '#63472c',
        900: '#513a24',
      },
      ink: '#1a140f',
      inkLight: '#4d331a',
      mist: '#f7f2ed',
      surface: '#ffffff',
    },
  },
  {
    id: 'teal',
    swatch: '#0f766e',
    label: 'Himalayan Teal',
    hint: 'Fresh and modern. Easy on the eyes for long billing days.',
    colors: {
      primary: {
        DEFAULT: '#0f766e',
        50: '#f0fdfa',
        100: '#ccfbf1',
        200: '#99f6e4',
        300: '#5eead4',
        400: '#2dd4bf',
        500: '#0f766e',
        600: '#0d6b64',
        700: '#115e59',
        800: '#134e4a',
        900: '#042f2e',
      },
      secondary: {
        DEFAULT: '#527a75',
        50: '#f4f8f7',
        100: '#e7f0ee',
        200: '#cde0dc',
        300: '#a5c4bf',
        400: '#739e99',
        500: '#527a75',
        600: '#446662',
        700: '#36524f',
        800: '#2a403e',
        900: '#1f302e',
      },
      ink: '#0f172a',
      inkLight: '#334155',
      mist: '#f0fdfa',
      surface: '#ffffff',
    },
  },
  {
    id: 'indigo',
    swatch: '#4338ca',
    label: 'Indigo',
    hint: 'Calm and professional. A clear look for offices and studios.',
    colors: {
      primary: {
        DEFAULT: '#4338ca',
        50: '#eef2ff',
        100: '#e0e7ff',
        200: '#c7d2fe',
        300: '#a5b4fc',
        400: '#818cf8',
        500: '#4338ca',
        600: '#3730a3',
        700: '#312e81',
        800: '#1e1b4b',
        900: '#141232',
      },
      secondary: {
        DEFAULT: '#6366f1',
        50: '#f5f7ff',
        100: '#eef0ff',
        200: '#dcdffc',
        300: '#c3c7f5',
        400: '#9ea3e8',
        500: '#6366f1',
        600: '#4f52c9',
        700: '#3f429e',
        800: '#32357c',
        900: '#282a63',
      },
      ink: '#0f172a',
      inkLight: '#334155',
      mist: '#eef2ff',
      surface: '#ffffff',
    },
  },
  {
    id: 'ruby',
    swatch: '#be123c',
    label: 'Ruby',
    hint: 'Bold crimson. Strong contrast for busy counters.',
    colors: {
      primary: {
        DEFAULT: '#be123c',
        50: '#fff1f2',
        100: '#ffe4e6',
        200: '#fecdd3',
        300: '#fda4af',
        400: '#fb7185',
        500: '#be123c',
        600: '#9f1239',
        700: '#881337',
        800: '#4c0519',
        900: '#400716',
      },
      secondary: {
        DEFAULT: '#9f4b5c',
        50: '#fdf7f8',
        100: '#f8ecee',
        200: '#efd5da',
        300: '#ddb0b8',
        400: '#c17d8a',
        500: '#9f4b5c',
        600: '#8c4151',
        700: '#733543',
        800: '#5c2b36',
        900: '#4b232c',
      },
      ink: '#1e0f12',
      inkLight: '#5c2432',
      mist: '#fff1f2',
      surface: '#ffffff',
    },
  },
];

type Rgb = { r: number; g: number; b: number };
type Hsl = { h: number; s: number; l: number };

export function parseHexColor(value: string) {
  const raw = String(value || '').trim();
  const match = raw.match(/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (!match) return '';

  let hex = match[1];
  if (hex.length === 3) {
    hex = hex.split('').map((character) => `${character}${character}`).join('');
  }

  return `#${hex.toLowerCase()}`;
}

function hexToRgb(hex: string): Rgb | null {
  const normalized = parseHexColor(hex).replace('#', '');
  if (!normalized) return null;
  const value = Number.parseInt(normalized, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function rgbToHex({ r, g, b }: Rgb) {
  const toHex = (channel: number) =>
    Math.max(0, Math.min(255, Math.round(channel))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  const delta = max - min;

  if (delta === 0) {
    return { h: 0, s: 0, l: lightness * 100 };
  }

  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  let hue = 0;
  if (max === red) hue = ((green - blue) / delta + (green < blue ? 6 : 0)) / 6;
  else if (max === green) hue = ((blue - red) / delta + 2) / 6;
  else hue = ((red - green) / delta + 4) / 6;

  return { h: hue * 360, s: saturation * 100, l: lightness * 100 };
}

function hueToRgb(p: number, q: number, t: number) {
  let tone = t;
  if (tone < 0) tone += 1;
  if (tone > 1) tone -= 1;
  if (tone < 1 / 6) return p + (q - p) * 6 * tone;
  if (tone < 1 / 2) return q;
  if (tone < 2 / 3) return p + (q - p) * (2 / 3 - tone) * 6;
  return p;
}

function hslToRgb({ h, s, l }: Hsl): Rgb {
  const hue = (((h % 360) + 360) % 360) / 360;
  const saturation = Math.max(0, Math.min(100, s)) / 100;
  const lightness = Math.max(0, Math.min(100, l)) / 100;

  if (saturation === 0) {
    const value = lightness * 255;
    return { r: value, g: value, b: value };
  }

  const q = lightness < 0.5 ? lightness * (1 + saturation) : lightness + saturation - lightness * saturation;
  const p = 2 * lightness - q;
  return {
    r: hueToRgb(p, q, hue + 1 / 3) * 255,
    g: hueToRgb(p, q, hue) * 255,
    b: hueToRgb(p, q, hue - 1 / 3) * 255,
  };
}

function relativeLuminance({ r, g, b }: Rgb) {
  const toLinear = (channel: number) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function contrastAgainstWhite(hex: string) {
  const rgb = hexToRgb(hex);
  if (!rgb) return 1;
  return 1.05 / (relativeLuminance(rgb) + 0.05);
}

function shade(hsl: Hsl, lightness: number, saturation = hsl.s) {
  return rgbToHex(
    hslToRgb({
      h: hsl.h,
      s: Math.max(0, Math.min(100, saturation)),
      l: Math.max(0, Math.min(100, lightness)),
    }),
  );
}

export function onPrimaryColor(primaryHex: string, ink: string, light = '#ffffff') {
  return contrastAgainstWhite(primaryHex) >= 3.2 ? light : ink;
}

export function ensureReadablePrimary(hex: string) {
  const parsed = parseHexColor(hex);
  if (!parsed) return '';

  let current = parsed;
  let hsl = rgbToHsl(hexToRgb(current)!);
  while (contrastAgainstWhite(current) < 4.5 && hsl.l > 26) {
    hsl = { ...hsl, l: hsl.l - 2 };
    current = shade(hsl, hsl.l);
  }
  return current;
}

export function buildPaletteFromHex(value: string): ColorThemeDefinition | null {
  const sourceHex = parseHexColor(value);
  const sourceRgb = hexToRgb(sourceHex);
  if (!sourceHex || !sourceRgb) return null;

  const baseHsl = rgbToHsl(sourceRgb);
  const buttonHex = ensureReadablePrimary(sourceHex);
  const buttonRgb = hexToRgb(buttonHex);
  if (!buttonRgb) return null;
  const buttonHsl = rgbToHsl(buttonRgb);
  const sat = Math.min(100, Math.max(22, baseHsl.s));

  return {
    id: CUSTOM_COLOR_THEME_ID,
    swatch: buttonHex,
    sourceHex,
    label: 'Custom',
    hint: 'Built from the hex color you entered.',
    colors: {
      primary: {
        DEFAULT: buttonHex,
        50: shade(baseHsl, 97.4, Math.min(sat, 32)),
        100: shade(baseHsl, 93.5, Math.min(sat, 38)),
        200: shade(baseHsl, 86, Math.min(sat, 48)),
        300: shade(baseHsl, 74, Math.min(sat, 56)),
        400: shade(baseHsl, 62, sat),
        500: buttonHex,
        600: shade(buttonHsl, Math.max(20, buttonHsl.l - 8)),
        700: shade(buttonHsl, Math.max(16, buttonHsl.l - 16)),
        800: shade(buttonHsl, Math.max(13, buttonHsl.l - 24)),
        900: shade(buttonHsl, Math.max(10, buttonHsl.l - 32), Math.min(100, buttonHsl.s + 6)),
      },
      ...NEUTRAL_COLORS,
      mist: shade(baseHsl, 97.2, Math.min(28, sat)),
    },
  };
}

export function findPresetThemeByHex(value: string) {
  const hex = parseHexColor(value);
  if (!hex) return null;
  return COLOR_THEMES.find((theme) => theme.swatch.toLowerCase() === hex) || null;
}

export function normalizeColorThemeId(value?: string | null) {
  const id = String(value || '').trim();
  if (id === CUSTOM_COLOR_THEME_ID) return CUSTOM_COLOR_THEME_ID;
  return COLOR_THEMES.some((theme) => theme.id === id) ? id : DEFAULT_COLOR_THEME_ID;
}

export function getColorTheme(id = DEFAULT_COLOR_THEME_ID, customHex = '') {
  const normalized = normalizeColorThemeId(id);
  if (normalized === CUSTOM_COLOR_THEME_ID) {
    return buildPaletteFromHex(customHex) || COLOR_THEMES[0];
  }
  return COLOR_THEMES.find((theme) => theme.id === normalized) || COLOR_THEMES[0];
}
