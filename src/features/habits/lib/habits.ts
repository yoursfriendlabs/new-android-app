import { localIsoDate, todayIso } from '@/src/shared/lib/format';
import type { ComponentProps } from 'react';
import type MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export interface HabitStreak {
  current: number;
  loggedToday: boolean;
  atRisk: boolean;
  best: number;
}

export interface HabitBadge {
  id: string;
  title: string;
  hint: string;
  icon: IconName;
}

export interface HabitWin {
  title: string;
  message: string;
  icon: IconName;
  tone: 'streak' | 'badge' | 'saved' | 'coin';
  coins?: number;
}

export interface HabitSnapshot {
  dates: string[];
  entryCount: number;
  incomeCount: number;
  expenseCount: number;
  savedThisMonth: number;
  bestStreak?: number;
  unlockedBadgeIds?: string[];
}

const BADGES: HabitBadge[] = [
  { id: 'first_log', title: 'First log', hint: 'Record your first income or expense', icon: 'flag-checkered' },
  { id: 'streak_3', title: '3-day streak', hint: 'Log three days in a row', icon: 'fire' },
  { id: 'streak_7', title: 'Week warrior', hint: 'Keep a 7-day streak', icon: 'trophy-outline' },
  { id: 'ten_logs', title: 'In the habit', hint: 'Log 10 times', icon: 'checkbox-marked-circle-outline' },
  { id: 'month_saved', title: 'In the green', hint: 'Save more than you spend this month', icon: 'leaf' },
];

function shiftIso(iso: string, days: number) {
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(year, (month || 1) - 1, day || 1);
  date.setDate(date.getDate() + days);
  return localIsoDate(date);
}

export function uniqueLogDays(dates: Array<string | undefined | null>) {
  return Array.from(
    new Set(
      dates
        .map((value) => String(value || '').slice(0, 10))
        .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value)),
    ),
  ).sort();
}

export function computeStreak(dates: string[], today = todayIso(), best = 0): HabitStreak {
  const set = new Set(uniqueLogDays(dates));
  const loggedToday = set.has(today);
  let cursor = loggedToday ? today : shiftIso(today, -1);
  let current = 0;

  while (set.has(cursor)) {
    current += 1;
    cursor = shiftIso(cursor, -1);
  }

  if (!loggedToday && current === 0) {
    return { current: 0, loggedToday: false, atRisk: false, best };
  }

  return {
    current,
    loggedToday,
    atRisk: !loggedToday && current > 0,
    best: Math.max(best, current),
  };
}

export function weekLogCount(dates: string[], today = todayIso()) {
  const now = new Date(`${today}T00:00:00`);
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay());
  const from = localIsoDate(start);
  return uniqueLogDays(dates).filter((day) => day >= from && day <= today).length;
}

export function unlockedBadges(snapshot: HabitSnapshot, streak: HabitStreak): HabitBadge[] {
  const earned: HabitBadge[] = [];
  for (const badge of BADGES) {
    const hit =
      (badge.id === 'first_log' && snapshot.entryCount >= 1) ||
      (badge.id === 'streak_3' && streak.current >= 3) ||
      (badge.id === 'streak_7' && streak.current >= 7) ||
      (badge.id === 'ten_logs' && snapshot.entryCount >= 10) ||
      (badge.id === 'month_saved' && snapshot.savedThisMonth > 0 && snapshot.incomeCount > 0);
    if (hit) earned.push(badge);
  }
  return earned;
}

export function nextBadge(snapshot: HabitSnapshot, streak: HabitStreak): HabitBadge | null {
  const unlocked = new Set(unlockedBadges(snapshot, streak).map((item) => item.id));
  return BADGES.find((badge) => !unlocked.has(badge.id)) ?? null;
}

export function buildCoinWin(options: {
  title: string;
  message: string;
  coins: number;
  icon?: IconName;
}): HabitWin {
  return {
    title: options.title,
    message: options.message,
    icon: options.icon ?? 'circle-multiple',
    tone: 'coin',
    coins: options.coins,
  };
}

export function buildWinMoment(options: {
  kind: 'income' | 'expense';
  amountLabel: string;
  previous: HabitStreak;
  next: HabitStreak;
  newBadges: HabitBadge[];
  coins?: number;
}): HabitWin {
  const badge = options.newBadges[0];
  if (badge) {
    return {
      title: badge.title,
      message: `${options.amountLabel} logged. ${badge.hint}.`,
      icon: badge.icon,
      tone: 'badge',
      coins: options.coins,
    };
  }

  if (options.next.current > options.previous.current && options.next.current >= 2) {
    return {
      title: `${options.next.current}-day streak`,
      message: 'Come back tomorrow and keep the fire going.',
      icon: 'fire',
      tone: 'streak',
      coins: options.coins,
    };
  }

  if (options.next.current === 1 && !options.previous.loggedToday) {
    return {
      title: options.kind === 'income' ? 'Money in' : 'Logged',
      message: `${options.amountLabel}. Log again tomorrow to start a streak.`,
      icon: options.kind === 'income' ? 'arrow-down-bold-circle-outline' : 'check',
      tone: 'saved',
      coins: options.coins,
    };
  }

  return {
    title: options.kind === 'income' ? 'Income saved' : 'Expense saved',
    message: `${options.amountLabel}. Streak is ${options.next.current} ${options.next.current === 1 ? 'day' : 'days'}.`,
    icon: 'check',
    tone: 'saved',
    coins: options.coins,
  };
}

export const WEEK_CHALLENGE_TARGET = 5;
export const DEFAULT_SAVE_GOAL = 5000;
export const HABIT_BADGES = BADGES;
