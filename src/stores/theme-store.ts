import * as SecureStore from 'expo-secure-store';
import { Appearance } from 'react-native';
import { create } from 'zustand';

import { buildAppPalette, defaultPalette, type AppPalette, type ThemeMode } from '@/src/theme/app-palette';
import {
  COLOR_THEME_STORAGE_KEY,
  CUSTOM_COLOR_THEME_ID,
  CUSTOM_PRIMARY_STORAGE_KEY,
  DEFAULT_COLOR_THEME_ID,
  LEGACY_DEFAULT_COLOR_THEME_ID,
  THEME_BRAND_MIGRATION_KEY,
  THEME_MODE_STORAGE_KEY,
  findPresetThemeByHex,
  getColorTheme,
  normalizeColorThemeId,
  parseHexColor,
} from '@/src/theme/color-themes';

/** What the user picked. `system` follows the phone's appearance setting. */
export type ThemeModePreference = 'system' | 'light' | 'dark';

interface ThemeState {
  status: 'booting' | 'ready';
  themeId: string;
  customHex: string;
  /** The user's choice. */
  modePreference: ThemeModePreference;
  /** What is actually on screen once `system` is resolved. */
  mode: ThemeMode;
  palette: AppPalette;
  hydrate: () => Promise<void>;
  setThemeId: (id: string) => Promise<void>;
  setCustomColor: (hex: string) => Promise<boolean>;
  setModePreference: (preference: ThemeModePreference) => Promise<void>;
}

function normalizeModePreference(value?: string | null): ThemeModePreference {
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'system';
}

function resolveMode(preference: ThemeModePreference): ThemeMode {
  if (preference === 'system') {
    return Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
  }
  return preference;
}

async function persistTheme(id: string, customHex: string) {
  await SecureStore.setItemAsync(COLOR_THEME_STORAGE_KEY, id);
  if (customHex) {
    await SecureStore.setItemAsync(CUSTOM_PRIMARY_STORAGE_KEY, customHex);
  }
}

let appearanceSubscription: { remove: () => void } | null = null;

export const useThemeStore = create<ThemeState>((set, get) => ({
  status: 'booting',
  themeId: DEFAULT_COLOR_THEME_ID,
  customHex: '',
  modePreference: 'system',
  mode: 'light',
  palette: defaultPalette,
  hydrate: async () => {
    try {
      const [storedId, storedHex, brandMigrated, storedMode] = await Promise.all([
        SecureStore.getItemAsync(COLOR_THEME_STORAGE_KEY),
        SecureStore.getItemAsync(CUSTOM_PRIMARY_STORAGE_KEY),
        SecureStore.getItemAsync(THEME_BRAND_MIGRATION_KEY),
        SecureStore.getItemAsync(THEME_MODE_STORAGE_KEY),
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
      const modePreference = normalizeModePreference(storedMode);
      const mode = resolveMode(modePreference);
      const colorTheme = getColorTheme(themeId, customHex);

      appearanceSubscription?.remove();
      appearanceSubscription = Appearance.addChangeListener(({ colorScheme }) => {
        if (get().modePreference !== 'system') return;
        const nextMode: ThemeMode = colorScheme === 'dark' ? 'dark' : 'light';
        if (nextMode === get().mode) return;
        const current = getColorTheme(get().themeId, get().customHex);
        set({ mode: nextMode, palette: buildAppPalette(current, nextMode) });
      });

      set({
        status: 'ready',
        themeId: colorTheme.id,
        customHex,
        mode,
        modePreference,
        palette: buildAppPalette(colorTheme, mode),
      });
    } catch {
      set({ status: 'ready', palette: defaultPalette });
    }
  },
  setThemeId: async (id) => {
    const { customHex, mode } = get();
    const themeId = normalizeColorThemeId(id);
    const colorTheme = getColorTheme(themeId, customHex);
    await persistTheme(colorTheme.id, customHex);
    set({
      themeId: colorTheme.id,
      palette: buildAppPalette(colorTheme, mode),
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
      palette: buildAppPalette(colorTheme, get().mode),
    });
    return true;
  },
  setModePreference: async (preference) => {
    const normalized = normalizeModePreference(preference);
    const mode = resolveMode(normalized);
    await SecureStore.setItemAsync(THEME_MODE_STORAGE_KEY, normalized);
    const colorTheme = getColorTheme(get().themeId, get().customHex);
    set({
      mode,
      modePreference: normalized,
      palette: buildAppPalette(colorTheme, mode),
    });
  },
}));

export function usePalette(): AppPalette {
  return useThemeStore((state) => state.palette) ?? defaultPalette;
}

/** `light` or `dark` — what is actually on screen right now. */
export function useThemeMode(): ThemeMode {
  return useThemeStore((state) => state.mode);
}
