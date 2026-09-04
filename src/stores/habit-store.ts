import { create } from 'zustand';

import { readLocalJson, writeLocalJson } from '@/src/shared/lib/local-json-store';

import { COIN_MERCH, newCoinEvent, serverReason, type CoinEvent, type CoinMerch, type CoinReason, type CoinRedemption } from '@/src/features/habits/lib/coins';
import {
  fetchCoinSnapshot,
  importLocalCoinClaims,
  isCoinsUnavailable,
  localImportClaims,
  mapCoinSnapshot,
  pushCoinAward,
  pushCoinRedeem,
} from '@/src/features/habits/lib/coin-sync';
import {
  DAILY_MONEY_REMINDER_COPY,
  DAILY_MONEY_REMINDER_ID,
  DEFAULT_DAILY_MONEY_REMINDER,
  normalizeDailyMoneyReminder,
  type DailyMoneyReminderSettings,
} from '@/src/features/habits/lib/daily-money-reminder';
import { DEFAULT_SAVE_GOAL, uniqueLogDays } from '@/src/features/habits/lib/habits';
import { nativeRemindersAvailable, type IntervalHabit } from '@/src/features/habits/lib/interval-habits';
import { generateId } from '@/src/shared/lib/id';
import { todayIso } from '@/src/shared/lib/format';

const STORAGE_KEY = 'pasalmanager.habits';
const REWARDS_KEY = 'pasalmanager.rewards';
const COINBOOK_KEY = 'pasalmanager.coinbook';
const OWNER_KEY = 'pasalmanager.coin-owner';

const HABITS_DRAFT_KEY = 'persist.habits';
const REWARDS_DRAFT_KEY = 'persist.rewards';
const COINBOOK_DRAFT_KEY = 'persist.coinbook';
const OWNER_DRAFT_KEY = 'persist.coin-owner';

interface PersistedHabits {
  saveGoal: number;
  bestStreak: number;
  logDates: string[];
  unlockedBadgeIds: string[];
  dailyMoneyReminder: DailyMoneyReminderSettings;
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

interface CoinOwner {
  userId: string;
  businessId: string;
}

interface HabitState extends PersistedHabits, PersistedRewards, PersistedCoinbook {
  status: 'booting' | 'ready';
  merch: CoinMerch[];
  remoteReady: boolean;
  hydrate: () => Promise<void>;
  syncRemote: (options: { userId?: string | null; businessId?: string | null; personal: boolean }) => Promise<void>;
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
  setDailyMoneyReminder: (patch: Partial<DailyMoneyReminderSettings>) => Promise<void>;
  applyDailyMoneyReminder: (personal: boolean) => Promise<void>;
  markDailyReminderFired: (day?: string) => Promise<void>;
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
  await writeLocalJson(HABITS_DRAFT_KEY, {
    saveGoal: state.saveGoal,
    bestStreak: state.bestStreak,
    logDates: uniqueLogDays(state.logDates).slice(-90),
    unlockedBadgeIds: state.unlockedBadgeIds,
    dailyMoneyReminder: normalizeDailyMoneyReminder(state.dailyMoneyReminder),
  });
}

async function persistRewards(state: PersistedRewards) {
  await writeLocalJson(REWARDS_DRAFT_KEY, rewardsSnapshot(state));
}

async function persistCoinbook(state: PersistedCoinbook) {
  await writeLocalJson(COINBOOK_DRAFT_KEY, coinbookSnapshot(state));
}

async function loadCoinOwner(): Promise<CoinOwner | null> {
  const parsed = await readLocalJson<CoinOwner>(OWNER_DRAFT_KEY, OWNER_KEY);
  if (!parsed?.userId || !parsed?.businessId) return null;
  return { userId: String(parsed.userId), businessId: String(parsed.businessId) };
}

async function persistCoinOwner(owner: CoinOwner) {
  await writeLocalJson(OWNER_DRAFT_KEY, owner);
}

async function persistRemoteWallet(state: {
  coins: number;
  claimedRewardIds: string[];
  history: CoinEvent[];
  redemptions: CoinRedemption[];
  intervalHabits: IntervalHabit[];
  scheduledPings: ScheduledPing[];
}) {
  await persistRewards(state);
  await persistCoinbook(state);
}

export const useHabitStore = create<HabitState>((set, get) => ({
  status: 'booting',
  saveGoal: DEFAULT_SAVE_GOAL,
  bestStreak: 0,
  logDates: [],
  unlockedBadgeIds: [],
  dailyMoneyReminder: DEFAULT_DAILY_MONEY_REMINDER,
  coins: 0,
  claimedRewardIds: [],
  intervalHabits: [],
  history: [],
  redemptions: [],
  scheduledPings: [],
  merch: COIN_MERCH,
  remoteReady: false,
  hydrate: async () => {
    try {
      const [habits, rewards, book] = await Promise.all([
        readLocalJson<Partial<PersistedHabits>>(HABITS_DRAFT_KEY, STORAGE_KEY),
        readLocalJson<Partial<PersistedRewards>>(REWARDS_DRAFT_KEY, REWARDS_KEY),
        readLocalJson<Partial<PersistedCoinbook>>(COINBOOK_DRAFT_KEY, COINBOOK_KEY),
      ]);
      const habitState = habits ?? {};
      const rewardState = rewards ?? {};
      const bookState = book ?? {};
      set({
        status: 'ready',
        saveGoal: Number(habitState.saveGoal) > 0 ? Number(habitState.saveGoal) : DEFAULT_SAVE_GOAL,
        bestStreak: Number(habitState.bestStreak) || 0,
        logDates: uniqueLogDays(habitState.logDates ?? []),
        unlockedBadgeIds: Array.isArray(habitState.unlockedBadgeIds) ? habitState.unlockedBadgeIds.map(String) : [],
        dailyMoneyReminder: normalizeDailyMoneyReminder(habitState.dailyMoneyReminder),
        coins: Number(rewardState.coins) > 0 ? Math.round(Number(rewardState.coins)) : 0,
        claimedRewardIds: Array.isArray(rewardState.claimedRewardIds) ? rewardState.claimedRewardIds.map(String).slice(-48) : [],
        intervalHabits: Array.isArray(rewardState.intervalHabits) ? rewardState.intervalHabits : [],
        history: Array.isArray(bookState.history) ? bookState.history : [],
        redemptions: Array.isArray(bookState.redemptions) ? bookState.redemptions : [],
        scheduledPings: Array.isArray(bookState.scheduledPings) ? bookState.scheduledPings : [],
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
  syncRemote: async ({ userId, businessId, personal }) => {
    await get().applyDailyMoneyReminder(personal);

    if (!personal || !userId || !businessId) {
      set({ remoteReady: false });
      return;
    }

    try {
      let snapshot = await fetchCoinSnapshot();
      const owner = await loadCoinOwner();
      const sameOwner = owner?.userId === userId && owner?.businessId === businessId;
      const serverHasLedger = Boolean(snapshot.importedAt) || (snapshot.history?.length ?? 0) > 0;

      if (owner && !sameOwner && !serverHasLedger) {
        await persistCoinOwner({ userId, businessId });
        await persistRemoteWallet({
          coins: 0,
          claimedRewardIds: [],
          history: [],
          redemptions: [],
          intervalHabits: get().intervalHabits,
          scheduledPings: get().scheduledPings,
        });
        set({
          coins: 0,
          claimedRewardIds: [],
          history: [],
          redemptions: [],
          merch: COIN_MERCH,
          remoteReady: true,
        });
        return;
      }

      if (!serverHasLedger) {
        const claims = localImportClaims({
          history: get().history,
          claimedRewardIds: get().claimedRewardIds,
        });
        if (claims.length) {
          snapshot = await importLocalCoinClaims(claims);
        }
      }

      const mapped = mapCoinSnapshot(snapshot);
      await persistCoinOwner({ userId, businessId });
      await persistRemoteWallet({
        ...get(),
        coins: mapped.coins,
        claimedRewardIds: mapped.claimedRewardIds,
        history: mapped.history,
        redemptions: mapped.redemptions,
      });
      set({
        coins: mapped.coins,
        claimedRewardIds: mapped.claimedRewardIds,
        history: mapped.history,
        redemptions: mapped.redemptions,
        merch: mapped.merch,
        remoteReady: true,
      });
    } catch (error) {
      if (isCoinsUnavailable(error)) {
        set({ remoteReady: false });
        return;
      }
      set({ remoteReady: false });
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
    const claimId = options?.claimId?.trim() || (serverReason(options?.reason) ? generateId('claim') : undefined);
    if (claimId && get().claimedRewardIds.includes(claimId)) return 0;
    const coins = get().coins + value;
    const claimedRewardIds = claimId
      ? [...get().claimedRewardIds, claimId].slice(-48)
      : get().claimedRewardIds;
    const history = [
      newCoinEvent({
        amount: value,
        reason: options?.reason ?? 'other',
        label: options?.label ?? 'Coins earned',
        claimId,
      }),
      ...get().history,
    ].slice(0, 80);
    await persistRewards({ ...get(), coins, claimedRewardIds });
    await persistCoinbook({ ...get(), history });
    set({ coins, claimedRewardIds, history });
    void pushCoinAward({
      claimId,
      reason: options?.reason,
      label: options?.label,
    }).catch(() => undefined);
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
    void pushCoinRedeem(itemId).catch(() => undefined);
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
  setDailyMoneyReminder: async (patch) => {
    const current = get().dailyMoneyReminder;
    const dailyMoneyReminder = normalizeDailyMoneyReminder({ ...current, ...patch });
    if (dailyMoneyReminder.enabled && dailyMoneyReminder.lastFiredDate == null) {
      const now = new Date();
      const minutesNow = now.getHours() * 60 + now.getMinutes();
      const minutesDue = dailyMoneyReminder.hour * 60 + dailyMoneyReminder.minute;
      if (minutesNow >= minutesDue) {
        dailyMoneyReminder.lastFiredDate = todayIso();
      }
    }
    await persistHabits({ ...get(), dailyMoneyReminder });
    set({ dailyMoneyReminder });
  },
  applyDailyMoneyReminder: async (personal) => {
    if (!nativeRemindersAvailable()) return;

    const { cancelReminderNotification, scheduleDailyReminder } = await import(
      '@/src/features/habits/lib/interval-reminders'
    );
    const reminder = get().dailyMoneyReminder;

    if (!personal || !reminder.enabled) {
      await cancelReminderNotification(DAILY_MONEY_REMINDER_ID);
      return;
    }

    await scheduleDailyReminder({
      id: DAILY_MONEY_REMINDER_ID,
      title: DAILY_MONEY_REMINDER_COPY.title,
      body: DAILY_MONEY_REMINDER_COPY.body,
      hour: reminder.hour,
      minute: reminder.minute,
    });
  },
  markDailyReminderFired: async (day) => {
    const dailyMoneyReminder = normalizeDailyMoneyReminder({
      ...get().dailyMoneyReminder,
      lastFiredDate: day || todayIso(),
    });
    await persistHabits({ ...get(), dailyMoneyReminder });
    set({ dailyMoneyReminder });
    if (nativeRemindersAvailable() && dailyMoneyReminder.enabled) {
      const { scheduleDailyReminder } = await import('@/src/features/habits/lib/interval-reminders');
      await scheduleDailyReminder({
        id: DAILY_MONEY_REMINDER_ID,
        title: DAILY_MONEY_REMINDER_COPY.title,
        body: DAILY_MONEY_REMINDER_COPY.body,
        hour: dailyMoneyReminder.hour,
        minute: dailyMoneyReminder.minute,
      });
    }
  },
}));
