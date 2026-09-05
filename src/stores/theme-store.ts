import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

import { buildAppPalette, defaultPalette, type AppPalette } from '@/src/theme/app-palette';
import {
  COLOR_THEME_STORAGE_KEY,
  CUSTOM_COLOR_THEME_ID,
  CUSTOM_PRIMARY_STORAGE_KEY,
  DEFAULT_COLOR_THEME_ID,
  LEGACY_DEFAULT_COLOR_THEME_ID,
  THEME_BRAND_MIGRATION_KEY,
  findPresetThemeByHex,
  getColorTheme,
  normalizeColorThemeId,
  parseHexColor,
} from '@/src/theme/color-themes';

interface ThemeState {
  status: 'booting' | 'ready';
  themeId: string;
  customHex: string;
  palette: AppPalette;
  hydrate: () => Promise<void>;
  setThemeId: (id: string) => Promise<void>;
  setCustomColor: (hex: string) => Promise<boolean>;
}

async function persistTheme(id: string, customHex: string) {
  await SecureStore.setItemAsync(COLOR_THEME_STORAGE_KEY, id);
  if (customHex) {
    await SecureStore.setItemAsync(CUSTOM_PRIMARY_STORAGE_KEY, customHex);
  }
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  status: 'booting',
  themeId: DEFAULT_COLOR_THEME_ID,
  customHex: '',
  palette: defaultPalette,
  hydrate: async () => {
    try {
      const [storedId, storedHex, brandMigrated] = await Promise.all([
        SecureStore.getItemAsync(COLOR_THEME_STORAGE_KEY),
        SecureStore.getItemAsync(CUSTOM_PRIMARY_STORAGE_KEY),
        SecureStore.getItemAsync(THEME_BRAND_MIGRATION_KEY),
      ]);
      let themeId = normalizeColorThemeId(storedId);
      const customHex = parseHexColor(storedHex || '');
      if (!brandMigrated) {
        await SecureStore.setItemAsync(THEME_BRAND_MIGRATION_KEY, '1');
        if (!storedId || themeId === 'signal' || themeId === 'teak' || themeId === LEGACY_DEFAULT_COLOR_THEME_ID) {
          themeId = DEFAULT_COLOR_THEME_ID;
          await persistTheme(themeId, customHex);
        }
      }
      const colorTheme = getColorTheme(themeId, customHex);
      set({
        status: 'ready',
        themeId: colorTheme.id,
        customHex,
        palette: buildAppPalette(colorTheme),
      });
    } catch {
      set({ status: 'ready', palette: defaultPalette });
    }
  },
  setThemeId: async (id) => {
    const customHex = get().customHex;
    const themeId = normalizeColorThemeId(id);
    const colorTheme = getColorTheme(themeId, customHex);
    await persistTheme(colorTheme.id, customHex);
    set({
      themeId: colorTheme.id,
      palette: buildAppPalette(colorTheme),
    });
  },
  setCustomColor: async (hex) => {
    const parsed = parseHexColor(hex);
    if (!parsed) return false;
    const preset = findPresetThemeByHex(parsed);
    const themeId = preset?.id || CUSTOM_COLOR_THEME_ID;
    const colorTheme = getColorTheme(themeId, parsed);
    await persistTheme(colorTheme.id, parsed);
    set({
      themeId: colorTheme.id,
      customHex: parsed,
      palette: buildAppPalette(colorTheme),
    });
    return true;
  },
}));

export function usePalette(): AppPalette {
  return useThemeStore((state) => state.palette) ?? defaultPalette;
}
