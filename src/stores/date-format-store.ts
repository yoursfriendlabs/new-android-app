import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

export type DateFormat = 'AD' | 'BS';

export const DATE_FORMAT_STORAGE_KEY = 'user_date_format_preference';
export const DEFAULT_DATE_FORMAT: DateFormat = 'AD';

interface DateFormatState {
  status: 'booting' | 'ready';
  dateFormat: DateFormat;
  hydrate: () => Promise<void>;
  setDateFormat: (format: DateFormat) => Promise<void>;
}

export const useDateFormatStore = create<DateFormatState>((set) => ({
  status: 'booting',
  dateFormat: DEFAULT_DATE_FORMAT,
  hydrate: async () => {
    try {
      const stored = await SecureStore.getItemAsync(DATE_FORMAT_STORAGE_KEY);
      if (stored === 'AD' || stored === 'BS') {
        set({ status: 'ready', dateFormat: stored });
      } else {
        set({ status: 'ready', dateFormat: DEFAULT_DATE_FORMAT });
      }
    } catch {
      set({ status: 'ready', dateFormat: DEFAULT_DATE_FORMAT });
    }
  },
  setDateFormat: async (format: DateFormat) => {
    try {
      await SecureStore.setItemAsync(DATE_FORMAT_STORAGE_KEY, format);
    } catch {
      // Ignore secure storage errors in unbacked environments
    }
    set({ dateFormat: format });
  },
}));

export function useDateFormat(): DateFormat {
  return useDateFormatStore((state) => state.dateFormat);
}
