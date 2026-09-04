import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

export type Language = 'en' | 'ne';

export const LANGUAGE_STORAGE_KEY = 'user_language_preference';
export const DEFAULT_LANGUAGE: Language = 'en';

interface LanguageState {
  status: 'booting' | 'ready';
  language: Language;
  hydrate: () => Promise<void>;
  setLanguage: (language: Language) => Promise<void>;
}

export const useLanguageStore = create<LanguageState>((set) => ({
  status: 'booting',
  language: DEFAULT_LANGUAGE,
  hydrate: async () => {
    try {
      const storedLang = await SecureStore.getItemAsync(LANGUAGE_STORAGE_KEY);
      if (storedLang === 'en' || storedLang === 'ne') {
        set({ status: 'ready', language: storedLang });
      } else {
        set({ status: 'ready', language: DEFAULT_LANGUAGE });
      }
    } catch {
      set({ status: 'ready', language: DEFAULT_LANGUAGE });
    }
  },
  setLanguage: async (language: Language) => {
    try {
      await SecureStore.setItemAsync(LANGUAGE_STORAGE_KEY, language);
    } catch {
      // Ignore secure storage errors in unbacked environments
    }
    set({ language });
  },
}));

export function useLanguage(): Language {
  return useLanguageStore((state) => state.language);
}
