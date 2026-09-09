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

/** Chart series order — distinct hues that stay apart in both light and dark. */
export const CATEGORY_SERIES = [
  '#059669',
  '#d97706',
  '#e11d48',
  '#2563eb',
  '#7c3aed',
  '#0284c7',
  '#ea580c',
  '#0d9488',
  '#4f46e5',
  '#64748b',
];

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

/** Colour for the nth slice/bar of a chart, adapted to the current mode. */
export function getSeriesTone(index: number, mode: ThemeMode) {
  return categoryTone(CATEGORY_SERIES[index % CATEGORY_SERIES.length], mode);
}
