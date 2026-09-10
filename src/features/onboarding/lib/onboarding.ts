import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

const ONBOARDING_STORAGE_KEY = 'pasalmanager.onboarding_seen';

type OnboardingStatus = 'unknown' | 'pending' | 'done';

interface OnboardingState {
  status: OnboardingStatus;
  hydrate: () => Promise<void>;
  complete: () => Promise<void>;
}

/**
 * Whether the first-run tour has been seen. Kept out of the auth store so signing
 * out does not send a returning user back through the tour.
 */
export const useOnboardingStore = create<OnboardingState>((set) => ({
  status: 'unknown',
  hydrate: async () => {
    try {
      const seen = await SecureStore.getItemAsync(ONBOARDING_STORAGE_KEY);
      set({ status: seen ? 'done' : 'pending' });
    } catch {
      // If storage is unreadable, do not trap the user in the tour.
      set({ status: 'done' });
    }
  },
  complete: async () => {
    set({ status: 'done' });
    try {
      await SecureStore.setItemAsync(ONBOARDING_STORAGE_KEY, '1');
    } catch {
      // The in-memory flag still gets them through this session.
    }
  },
}));
