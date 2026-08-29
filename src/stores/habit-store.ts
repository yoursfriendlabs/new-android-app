import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

import { newCoinEvent, type CoinEvent, type CoinReason, type CoinRedemption } from '@/src/features/habits/lib/coins';
import { DEFAULT_SAVE_GOAL, uniqueLogDays } from '@/src/features/habits/lib/habits';
import { nativeRemindersAvailable, type IntervalHabit } from '@/src/features/habits/lib/interval-habits';

const STORAGE_KEY = 'pasalmanager.habits';
const REWARDS_KEY = 'pasalmanager.rewards';
const COINBOOK_KEY = 'pasalmanager.coinbook';

interface PersistedHabits {
  saveGoal: number;
  bestStreak: number;
  logDates: string[];
  unlockedBadgeIds: string[];
}

interface PersistedRewards {
  coins: number;
  claimedRewardIds: string[];
  intervalHabits: IntervalHabit[];
}

export interface ScheduledPing {
  id: string;
  title: string;
  body: string;
  at: string;
  fired: boolean;
  native: boolean;
}

interface PersistedCoinbook {
  history: CoinEvent[];
  redemptions: CoinRedemption[];
  scheduledPings: ScheduledPing[];
}

interface HabitState extends PersistedHabits, PersistedRewards, PersistedCoinbook {
  status: 'booting' | 'ready';
  hydrate: () => Promise<void>;
  setSaveGoal: (amount: number) => Promise<void>;
  recordLog: (date: string) => Promise<string[]>;
  markBadges: (ids: string[]) => Promise<void>;
  noteBestStreak: (value: number) => Promise<void>;
  awardCoins: (amount: number, options?: { claimId?: string; reason?: CoinReason; label?: string }) => Promise<number>;
  spendCoins: (amount: number, label: string, itemId: string) => Promise<{ ok: boolean; remaining: number }>;
  upsertIntervalHabit: (habit: IntervalHabit) => Promise<IntervalHabit>;
  setIntervalEnabled: (id: string, enabled: boolean) => Promise<void>;
  checkInInterval: (id: string) => Promise<{ habit: IntervalHabit | null; awarded: number }>;
  removeIntervalHabit: (id: string) => Promise<void>;
  schedulePing: (ping: Omit<ScheduledPing, 'fired'>) => Promise<void>;
  cancelPing: (id: string) => Promise<void>;
  markPingFired: (id: string) => Promise<void>;
}

function rewardsSnapshot(state: PersistedRewards): PersistedRewards {
  return {
    coins: Math.max(0, Math.round(state.coins || 0)),
    claimedRewardIds: (state.claimedRewardIds || []).slice(-48),
    intervalHabits: (state.intervalHabits || []).slice(0, 12),
  };
}

function coinbookSnapshot(state: PersistedCoinbook): PersistedCoinbook {
  return {
    history: (state.history || []).slice(0, 80),
    redemptions: (state.redemptions || []).slice(0, 40),
    scheduledPings: (state.scheduledPings || []).filter((item) => !item.fired).slice(0, 30),
  };
}

async function persistHabits(state: PersistedHabits) {
  await SecureStore.setItemAsync(
    STORAGE_KEY,
    JSON.stringify({
      saveGoal: state.saveGoal,
      bestStreak: state.bestStreak,
      logDates: uniqueLogDays(state.logDates).slice(-90),
      unlockedBadgeIds: state.unlockedBadgeIds,
    }),
  );
}

async function persistRewards(state: PersistedRewards) {
  await SecureStore.setItemAsync(REWARDS_KEY, JSON.stringify(rewardsSnapshot(state)));
}

async function persistCoinbook(state: PersistedCoinbook) {
  await SecureStore.setItemAsync(COINBOOK_KEY, JSON.stringify(coinbookSnapshot(state)));
}

export const useHabitStore = create<HabitState>((set, get) => ({
  status: 'booting',
  saveGoal: DEFAULT_SAVE_GOAL,
  bestStreak: 0,
  logDates: [],
  unlockedBadgeIds: [],
  coins: 0,
  claimedRewardIds: [],
  intervalHabits: [],
  history: [],
  redemptions: [],
  scheduledPings: [],
  hydrate: async () => {
    try {
      const [habitsRaw, rewardsRaw, bookRaw] = await Promise.all([
        SecureStore.getItemAsync(STORAGE_KEY),
        SecureStore.getItemAsync(REWARDS_KEY),
        SecureStore.getItemAsync(COINBOOK_KEY),
      ]);
      const habits = habitsRaw ? (JSON.parse(habitsRaw) as Partial<PersistedHabits>) : {};
      const rewards = rewardsRaw ? (JSON.parse(rewardsRaw) as Partial<PersistedRewards>) : {};
      const book = bookRaw ? (JSON.parse(bookRaw) as Partial<PersistedCoinbook>) : {};
      set({
        status: 'ready',
        saveGoal: Number(habits.saveGoal) > 0 ? Number(habits.saveGoal) : DEFAULT_SAVE_GOAL,
        bestStreak: Number(habits.bestStreak) || 0,
        logDates: uniqueLogDays(habits.logDates ?? []),
        unlockedBadgeIds: Array.isArray(habits.unlockedBadgeIds) ? habits.unlockedBadgeIds.map(String) : [],
        coins: Number(rewards.coins) > 0 ? Math.round(Number(rewards.coins)) : 0,
        claimedRewardIds: Array.isArray(rewards.claimedRewardIds) ? rewards.claimedRewardIds.map(String).slice(-48) : [],
        intervalHabits: Array.isArray(rewards.intervalHabits) ? rewards.intervalHabits : [],
        history: Array.isArray(book.history) ? book.history : [],
        redemptions: Array.isArray(book.redemptions) ? book.redemptions : [],
        scheduledPings: Array.isArray(book.scheduledPings) ? book.scheduledPings : [],
      });
    } catch {
      set({ status: 'ready' });
    }

    try {
      if (nativeRemindersAvailable()) {
        const { rescheduleEnabledHabits, scheduleExactReminder } = await import('@/src/features/habits/lib/interval-reminders');
        const synced = await rescheduleEnabledHabits(get().intervalHabits);
        await persistRewards({ ...get(), intervalHabits: synced });
        set({ intervalHabits: synced });
        for (const ping of get().scheduledPings) {
          if (ping.fired) continue;
          const at = new Date(ping.at);
          if (Number.isNaN(at.getTime()) || at.getTime() <= Date.now()) continue;
          await scheduleExactReminder({ id: ping.id, title: ping.title, body: ping.body, at });
        }
      }
    } catch {
      // Notifications need a native rebuild; habits still work in-app.
    }
  },
  setSaveGoal: async (amount) => {
    const saveGoal = Math.max(0, Math.round(amount));
    const next = { ...get(), saveGoal };
    await persistHabits(next);
    set({ saveGoal });
  },
  recordLog: async (date) => {
    const logDates = uniqueLogDays([...get().logDates, date]);
    await persistHabits({ ...get(), logDates });
    set({ logDates });
    return logDates;
  },
  markBadges: async (ids) => {
    const unlockedBadgeIds = Array.from(new Set([...get().unlockedBadgeIds, ...ids]));
    await persistHabits({ ...get(), unlockedBadgeIds });
    set({ unlockedBadgeIds });
  },
  noteBestStreak: async (value) => {
    if (value <= get().bestStreak) return;
    await persistHabits({ ...get(), bestStreak: value });
    set({ bestStreak: value });
  },
  awardCoins: async (amount, options) => {
    const value = Math.max(0, Math.round(amount));
    if (!value) return 0;
    if (options?.claimId && get().claimedRewardIds.includes(options.claimId)) return 0;
    const coins = get().coins + value;
    const claimedRewardIds = options?.claimId
      ? [...get().claimedRewardIds, options.claimId].slice(-48)
      : get().claimedRewardIds;
    const history = [
      newCoinEvent({
        amount: value,
        reason: options?.reason ?? 'other',
        label: options?.label ?? 'Coins earned',
      }),
      ...get().history,
    ].slice(0, 80);
    await persistRewards({ ...get(), coins, claimedRewardIds });
    await persistCoinbook({ ...get(), history });
    set({ coins, claimedRewardIds, history });
    return value;
  },
  spendCoins: async (amount, label, itemId) => {
    const cost = Math.max(0, Math.round(amount));
    if (!cost || get().coins < cost) return { ok: false, remaining: get().coins };
    const coins = get().coins - cost;
    const redemption: CoinRedemption = {
      id: `rd_${Date.now().toString(36)}`,
      itemId,
      title: label,
      cost,
      at: new Date().toISOString(),
      status: 'requested',
    };
    const history = [
      newCoinEvent({ amount: -cost, reason: 'redeem', label }),
      ...get().history,
    ].slice(0, 80);
    const redemptions = [redemption, ...get().redemptions].slice(0, 40);
    await persistRewards({ ...get(), coins });
    await persistCoinbook({ ...get(), history, redemptions });
    set({ coins, history, redemptions });
    return { ok: true, remaining: coins };
  },
  upsertIntervalHabit: async (habit) => {
    let scheduled = { ...habit, notificationId: habit.enabled ? habit.notificationId : null };
    if (nativeRemindersAvailable()) {
      const { cancelReminderNotification, scheduleIntervalNotification } = await import('@/src/features/habits/lib/interval-reminders');
      scheduled = habit.enabled
        ? await scheduleIntervalNotification(habit)
        : { ...habit, notificationId: null };
      if (!habit.enabled) {
        await cancelReminderNotification(habit.notificationId || habit.id);
      }
    }
    const existing = get().intervalHabits;
    const intervalHabits = existing.some((item) => item.id === scheduled.id)
      ? existing.map((item) => (item.id === scheduled.id ? scheduled : item))
      : [...existing, scheduled].slice(0, 12);
    await persistRewards({ ...get(), intervalHabits });
    set({ intervalHabits });
    return scheduled;
  },
  setIntervalEnabled: async (id, enabled) => {
    const current = get().intervalHabits.find((item) => item.id === id);
    if (!current) return;
    await get().upsertIntervalHabit({ ...current, enabled });
  },
  checkInInterval: async (id) => {
    const current = get().intervalHabits.find((item) => item.id === id);
    if (!current) return { habit: null, awarded: 0 };
    const next = { ...current, lastCheckInAt: new Date().toISOString() };
    const intervalHabits = get().intervalHabits.map((item) => (item.id === id ? next : item));
    await persistRewards({ ...get(), intervalHabits });
    set({ intervalHabits });
    return { habit: next, awarded: 0 };
  },
  removeIntervalHabit: async (id) => {
    const current = get().intervalHabits.find((item) => item.id === id);
    if (nativeRemindersAvailable()) {
      const { cancelReminderNotification } = await import('@/src/features/habits/lib/interval-reminders');
      await cancelReminderNotification(current?.notificationId || id);
    }
    const intervalHabits = get().intervalHabits.filter((item) => item.id !== id);
    await persistRewards({ ...get(), intervalHabits });
    set({ intervalHabits });
  },
  schedulePing: async (ping) => {
    const scheduledPings = [
      { ...ping, fired: false },
      ...get().scheduledPings.filter((item) => item.id !== ping.id),
    ].slice(0, 30);
    await persistCoinbook({ ...get(), scheduledPings });
    set({ scheduledPings });
    if (nativeRemindersAvailable()) {
      const { scheduleExactReminder } = await import('@/src/features/habits/lib/interval-reminders');
      await scheduleExactReminder({
        id: ping.id,
        title: ping.title,
        body: ping.body,
        at: new Date(ping.at),
      });
    }
  },
  cancelPing: async (id) => {
    const scheduledPings = get().scheduledPings.filter((item) => item.id !== id);
    await persistCoinbook({ ...get(), scheduledPings });
    set({ scheduledPings });
    if (nativeRemindersAvailable()) {
      const { cancelReminderNotification } = await import('@/src/features/habits/lib/interval-reminders');
      await cancelReminderNotification(id);
    }
  },
  markPingFired: async (id) => {
    const scheduledPings = get().scheduledPings.map((item) => (item.id === id ? { ...item, fired: true } : item));
    await persistCoinbook({ ...get(), scheduledPings });
    set({ scheduledPings });
  },
}));
