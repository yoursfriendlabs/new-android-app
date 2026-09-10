import type MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import { categoryTone } from '@/src/theme/color-themes';
import type { ThemeMode } from '@/src/theme/app-palette';

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

/** One icon and one hue per money category, shared by the entry sheet and the charts. */
export const CATEGORY_ICONS: Record<string, IconName> = {
  Food: 'food-fork-drink',
  Shopping: 'shopping',
  Transport: 'car',
  Housing: 'home',
  Rent: 'home-city',
  Entertainment: 'movie-open',
  Education: 'school',
  Salary: 'briefcase',
  Investments: 'chart-line',
  Allowance: 'wallet-giftcard',
  Gift: 'gift',
  Bonus: 'trophy',
  Health: 'heart-pulse',
  Bills: 'receipt',
  Freelance: 'laptop',
  Family: 'account-child',
  Refund: 'cash-refund',
  Other: 'dots-horizontal-circle-outline',
};

const CATEGORY_HUES: Record<string, string> = {
  Food: '#d97706',
  Shopping: '#e11d48',
  Transport: '#059669',
  Housing: '#0284c7',
  Rent: '#0284c7',
  Entertainment: '#7c3aed',
  Education: '#2563eb',
  Salary: '#b45309',
  Investments: '#ca8a04',
  Allowance: '#059669',
  Gift: '#db2777',
  Bonus: '#ea580c',
  Health: '#dc2626',
  Bills: '#4f46e5',
  Freelance: '#0891b2',
  Family: '#0d9488',
  Refund: '#65a30d',
  Other: '#475569',
};

/**
 * Chart series order — eight fixed slots, assigned in order and never cycled.
 * Validated for colour-blind separation and contrast against both the light and
 * the dark card surface; anything past slot 8 folds into "Other".
 */
const CATEGORY_SERIES_LIGHT = [
  '#2a78d6', // blue
  '#eb6834', // orange
  '#1baf7a', // aqua
  '#eda100', // yellow
  '#e87ba4', // magenta
  '#008300', // green
  '#4a3aa7', // violet
  '#e34948', // red
];

const CATEGORY_SERIES_DARK = [
  '#3987e5',
  '#d95926',
  '#199e70',
  '#c98500',
  '#d55181',
  '#008300',
  '#9085e9',
  '#e66767',
];

/** The tail of a long category list is one grey slot, not a ninth hue. */
const OTHER_SLOT = { dark: '#a3adbd', light: '#5a687d' };

export const SERIES_SLOT_COUNT = CATEGORY_SERIES_LIGHT.length;

export const CATEGORY_SERIES = CATEGORY_SERIES_LIGHT;

const FALLBACK_ICON: IconName = 'tag-outline';

export interface CategoryVisual {
  icon: IconName;
  /** Readable text/icon colour for the current mode. */
  color: string;
  /** Soft fill behind the icon for the current mode. */
  background: string;
}

export function getCategoryVisual(name: string, mode: ThemeMode): CategoryVisual {
  const key = String(name || '').trim();
  const hue = CATEGORY_HUES[key] ?? CATEGORY_HUES.Other;
  return {
    icon: CATEGORY_ICONS[key] ?? FALLBACK_ICON,
    ...categoryTone(hue, mode),
  };
}

/**
 * Colour for the nth series of a chart. Slots are fixed, so a category keeps its
 * colour when the list is filtered; index 8 and beyond is the grey "Other" slot.
 */
export function getSeriesTone(index: number, mode: ThemeMode) {
  const slots = mode === 'dark' ? CATEGORY_SERIES_DARK : CATEGORY_SERIES_LIGHT;
  const color = index < slots.length ? slots[index] : OTHER_SLOT[mode];
  return { background: categoryTone(color, mode).background, color };
}
