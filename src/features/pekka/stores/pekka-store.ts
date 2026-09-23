import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

import { DEFAULT_DAY_CLOSE, normalizeDayClose, type DayCloseSettings } from '../lib/day-close';
import { DEFAULT_MORNING, normalizeMorning, type MorningSettings } from '../lib/morning';
import { countQuestion, EMPTY_USAGE, mergeServerUsage, normalizeUsage, type PekkaUsage } from '../lib/quota';

const MORNING_STORAGE_KEY = 'pekka_morning_summary';
const DAY_CLOSE_STORAGE_KEY = 'pekka_day_close';
const CLOSE_DAYS_KEY = 'pekka_close_days';
const COLLECT_LAST_KEY = 'pekka_collect_last';
const AI_USAGE_KEY = 'pekka_ai_usage';
const NUDGES_SEEN_KEY = 'pekka_nudges_seen';

interface PekkaState {
  open: boolean;
  /** Extra space under the button, so it sits above a screen's own floating button. */
  lift: number;
  /** Set when Pekka should open straight into yesterday's summary (e.g. from the morning notification). */
  briefRequested: boolean;
  /** Set when Pekka should open straight into closing today's book. */
  closeRequested: boolean;
  /** Set when Pekka should open straight into today's tips (e.g. from the collect reminder). */
  tipsRequested: boolean;
  /** When the last "money to collect" reminder was booked, so it stays occasional. */
  collectLast: string;
  /** AI questions used today. Answers worked out on the phone are not counted. */
  aiUsage: PekkaUsage;
  morning: MorningSettings;
  dayClose: DayCloseSettings;
  /** Days (ISO) the user closed the book — the streak behind the evening ritual. */
  closeDays: string[];
  schedulesReady: boolean;
  /** Signature of the last set of tips the user opened; a new set shows a dot. */
  nudgesSeen: string;
  setOpen: (open: boolean) => void;
  setLift: (lift: number) => void;
  toggle: () => void;
  openBrief: () => void;
  consumeBrief: () => void;
  openDayClose: () => void;
  consumeDayClose: () => void;
  openTips: () => void;
  consumeTips: () => void;
  markCollectSent: (at?: string) => Promise<void>;
  countAiQuestion: (server?: { used?: number; limit?: number } | null) => Promise<PekkaUsage>;
  hydrateSchedules: () => Promise<void>;
  markNudgesSeen: (signature: string) => void;
  setMorning: (patch: Partial<MorningSettings>) => Promise<void>;
  setDayClose: (patch: Partial<DayCloseSettings>) => Promise<void>;
  recordDayClose: (date: string) => Promise<string[]>;
}

/**
 * Small store so the floating button, notifications and onboarding can open
 * Pekka from anywhere. The conversation itself lives locally in the chat sheet.
 */
export const usePekkaStore = create<PekkaState>((set, get) => ({
  open: false,
  lift: 0,
  briefRequested: false,
  closeRequested: false,
  tipsRequested: false,
  collectLast: '',
  aiUsage: EMPTY_USAGE,
  morning: DEFAULT_MORNING,
  dayClose: DEFAULT_DAY_CLOSE,
  closeDays: [],
  schedulesReady: false,
  nudgesSeen: '',
  setOpen: (open) => set({ open }),
  setLift: (lift) => set({ lift }),
  toggle: () => set((state) => ({ open: !state.open })),
  openBrief: () => set({ open: true, briefRequested: true, closeRequested: false, tipsRequested: false }),
  consumeBrief: () => set({ briefRequested: false }),
  openDayClose: () => set({ open: true, closeRequested: true, briefRequested: false, tipsRequested: false }),
  consumeDayClose: () => set({ closeRequested: false }),
  openTips: () => set({ open: true, tipsRequested: true, briefRequested: false, closeRequested: false }),
  consumeTips: () => set({ tipsRequested: false }),
  countAiQuestion: async (server) => {
    const counted = mergeServerUsage(countQuestion(get().aiUsage), server);
    set({ aiUsage: counted });
    try {
      await SecureStore.setItemAsync(AI_USAGE_KEY, JSON.stringify(counted));
    } catch {
      // Unbacked environments fall back to the server's own count.
    }
    return counted;
  },
  markCollectSent: async (at) => {
    const stamp = at || new Date().toISOString();
    set({ collectLast: stamp });
    try {
      await SecureStore.setItemAsync(COLLECT_LAST_KEY, stamp);
    } catch {
      // Unbacked environments simply allow the next reminder sooner.
    }
  },
  hydrateSchedules: async () => {
    try {
      const [stored, close, days, collectLast, usage, seen] = await Promise.all([
        SecureStore.getItemAsync(MORNING_STORAGE_KEY),
        SecureStore.getItemAsync(DAY_CLOSE_STORAGE_KEY),
        SecureStore.getItemAsync(CLOSE_DAYS_KEY),
        SecureStore.getItemAsync(COLLECT_LAST_KEY),
        SecureStore.getItemAsync(AI_USAGE_KEY),
        SecureStore.getItemAsync(NUDGES_SEEN_KEY),
      ]);
      const parsedDays = days ? JSON.parse(days) : [];
      set({
        morning: normalizeMorning(stored ? JSON.parse(stored) : null),
        dayClose: normalizeDayClose(close ? JSON.parse(close) : null),
        closeDays: Array.isArray(parsedDays) ? parsedDays.filter((day) => typeof day === 'string') : [],
        collectLast: collectLast ?? '',
        aiUsage: normalizeUsage(usage ? JSON.parse(usage) : null),
        nudgesSeen: seen ?? '',
        schedulesReady: true,
      });
    } catch {
      set({ morning: DEFAULT_MORNING, dayClose: DEFAULT_DAY_CLOSE, aiUsage: EMPTY_USAGE, schedulesReady: true });
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
  recordDayClose: async (date) => {
    const day = String(date || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return get().closeDays;
    // Ninety days is plenty for a streak and keeps the stored value small.
    const closeDays = Array.from(new Set([...get().closeDays, day])).sort().slice(-90);
    set({ closeDays });
    try {
      await SecureStore.setItemAsync(CLOSE_DAYS_KEY, JSON.stringify(closeDays));
    } catch {
      // Unbacked environments keep the streak for this session only.
    }
    return closeDays;
  },
  setDayClose: async (patch) => {
    const dayClose = normalizeDayClose({ ...get().dayClose, ...patch });
    set({ dayClose });
    try {
      await SecureStore.setItemAsync(DAY_CLOSE_STORAGE_KEY, JSON.stringify(dayClose));
    } catch {
      // Unbacked environments keep the setting for this session only.
    }
  },
}));
