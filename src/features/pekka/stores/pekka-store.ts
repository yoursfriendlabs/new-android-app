import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

import { DEFAULT_MORNING, normalizeMorning, type MorningSettings } from '../lib/morning';

const MORNING_STORAGE_KEY = 'pekka_morning_summary';
const NUDGES_SEEN_KEY = 'pekka_nudges_seen';

interface PekkaState {
  open: boolean;
  /** Extra space under the button, so it sits above a screen's own floating button. */
  lift: number;
  /** Set when Pekka should open straight into yesterday's summary (e.g. from the morning notification). */
  briefRequested: boolean;
  morning: MorningSettings;
  morningReady: boolean;
  /** Signature of the last set of tips the user opened; a new set shows a dot. */
  nudgesSeen: string;
  setOpen: (open: boolean) => void;
  setLift: (lift: number) => void;
  toggle: () => void;
  openBrief: () => void;
  consumeBrief: () => void;
  hydrateMorning: () => Promise<void>;
  markNudgesSeen: (signature: string) => void;
  setMorning: (patch: Partial<MorningSettings>) => Promise<void>;
}

/**
 * Small store so the floating button, notifications and onboarding can open
 * Pekka from anywhere. The conversation itself lives locally in the chat sheet.
 */
export const usePekkaStore = create<PekkaState>((set, get) => ({
  open: false,
  lift: 0,
  briefRequested: false,
  morning: DEFAULT_MORNING,
  morningReady: false,
  nudgesSeen: '',
  setOpen: (open) => set({ open }),
  setLift: (lift) => set({ lift }),
  toggle: () => set((state) => ({ open: !state.open })),
  openBrief: () => set({ open: true, briefRequested: true }),
  consumeBrief: () => set({ briefRequested: false }),
  hydrateMorning: async () => {
    try {
      const [stored, seen] = await Promise.all([
        SecureStore.getItemAsync(MORNING_STORAGE_KEY),
        SecureStore.getItemAsync(NUDGES_SEEN_KEY),
      ]);
      set({ morning: normalizeMorning(stored ? JSON.parse(stored) : null), nudgesSeen: seen ?? '', morningReady: true });
    } catch {
      set({ morning: DEFAULT_MORNING, morningReady: true });
    }
  },
  markNudgesSeen: (signature) => {
    if (!signature || signature === get().nudgesSeen) return;
    set({ nudgesSeen: signature });
    void SecureStore.setItemAsync(NUDGES_SEEN_KEY, signature).catch(() => undefined);
  },
  setMorning: async (patch) => {
    const morning = normalizeMorning({ ...get().morning, ...patch });
    set({ morning });
    try {
      await SecureStore.setItemAsync(MORNING_STORAGE_KEY, JSON.stringify(morning));
    } catch {
      // Unbacked environments keep the setting for this session only.
    }
  },
}));
