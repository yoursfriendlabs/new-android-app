import { formatCurrency, localIsoDate } from '@/src/shared/lib/format';
import type { DashboardSummary } from '@/src/types/models';

import { normalizeSchedule, scheduleFireTimes, SCHEDULE_DAYS_AHEAD, type PekkaScheduleSettings } from './schedule';

/**
 * The evening ritual: shopkeepers already close their book on paper at the end
 * of the day, so Pekka asks to do it here instead. One notification, one screen:
 * what came in, what went out, who still owes, and the streak for keeping it up.
 */

type Translate = (key: string, params?: Record<string, string | number>) => string;

export type DayCloseSettings = PekkaScheduleSettings;

export const DEFAULT_DAY_CLOSE: DayCloseSettings = { enabled: false, hour: 20, minute: 0 };

export const DAY_CLOSE_TIMES = [
  { hour: 18, minute: 0 },
  { hour: 19, minute: 0 },
  { hour: 20, minute: 0 },
  { hour: 21, minute: 0 },
];

export const DAY_CLOSE_DAYS_AHEAD = SCHEDULE_DAYS_AHEAD;
export const DAY_CLOSE_ID_PREFIX = 'pekka-close-';

export function normalizeDayClose(value?: Partial<DayCloseSettings> | null): DayCloseSettings {
  return normalizeSchedule(value, DEFAULT_DAY_CLOSE);
}

export function dayCloseFireTimes(settings: DayCloseSettings, from = new Date(), count = DAY_CLOSE_DAYS_AHEAD): Date[] {
  return scheduleFireTimes(settings, from, count);
}

export function todayRange(now = new Date()): { from: string; to: string } {
  const iso = localIsoDate(now);
  return { from: iso, to: iso };
}

export interface DayCloseStreak {
  current: number;
  loggedToday: boolean;
}

export interface DayCloseBrief {
  /** One line per fact, most important first. */
  lines: string[];
  /** Where the most useful follow-up lives. */
  action: { labelKey: string; route: string } | null;
  /** Nothing was recorded today: the close is a prompt, not a report. */
  quiet: boolean;
}

/** Today's money, what it leaves open for tomorrow, and the streak. */
export function buildDayClose(
  summary: DashboardSummary,
  {
    isPersonal,
    t,
    currency = 'NPR',
    streak,
  }: { isPersonal: boolean; t: Translate; currency?: string; streak?: DayCloseStreak | null },
): DayCloseBrief {
  const money = (value: number) => formatCurrency(value, currency);
  const income = Number(summary.revenueTotal ?? summary.incomeTotal ?? 0);
  const expense = Number(summary.expenseTotal ?? 0);
  const sales = Number(summary.salesTotal ?? 0);
  const toReceive = Number(summary.toReceive ?? summary.pendingReceivable ?? 0);
  const lowStock = Number(summary.lowStockCount ?? 0);
  const quiet = sales <= 0 && income <= 0 && expense <= 0;
  const lines: string[] = [];

  if (quiet) {
    lines.push(t(isPersonal ? 'pekka.close.quietPersonal' : 'pekka.close.quietDay'));
  } else if (isPersonal) {
    lines.push(t('pekka.close.personalDay', { income: money(income), expense: money(expense) }));
  } else {
    lines.push(t('pekka.close.shopDay', { sales: money(sales), income: money(income), expense: money(expense) }));
    const left = income - expense;
    if (left !== 0) {
      lines.push(t(left > 0 ? 'pekka.close.left' : 'pekka.close.short', { value: money(Math.abs(left)) }));
    }
  }

  if (toReceive > 0) lines.push(t('pekka.close.toReceive', { value: money(toReceive) }));
  if (!isPersonal && lowStock > 0) lines.push(t('pekka.close.lowStock', { count: lowStock }));

  if (streak) {
    if (streak.loggedToday && streak.current > 1) lines.push(t('pekka.close.streak', { count: streak.current }));
    else if (streak.loggedToday) lines.push(t('pekka.close.streakFirst'));
    else if (streak.current > 0) lines.push(t('pekka.close.streakAtRisk', { count: streak.current }));
  }

  let action: DayCloseBrief['action'] = null;
  if (quiet) {
    action = isPersonal
      ? { labelKey: 'pekka.close.openMoney', route: '/(app)/(tabs)/expenses' }
      : { labelKey: 'pekka.close.openSale', route: '/(app)/(tabs)/pos' };
  } else if (toReceive > 0) {
    action = { labelKey: 'pekka.close.openDues', route: '/(app)/(tabs)/parties' };
  } else if (!isPersonal && lowStock > 0) {
    action = { labelKey: 'pekka.close.openStock', route: '/(app)/(tabs)/inventory' };
  }

  return { lines, action, quiet };
}

/**
 * Notification text for the evening. It is booked hours ahead, so it carries
 * only facts that stay true — balances and stock — never today's running total.
 */
export function dayCloseNotificationBody(
  summary: DashboardSummary | null,
  { isPersonal, t, currency = 'NPR' }: { isPersonal: boolean; t: Translate; currency?: string },
): string {
  if (!summary) return t('pekka.close.pushGeneric');
  const facts: string[] = [];
  const toReceive = Number(summary.toReceive ?? summary.pendingReceivable ?? 0);
  const lowStock = Number(summary.lowStockCount ?? 0);
  if (toReceive > 0) facts.push(t('pekka.close.pushToReceive', { value: formatCurrency(toReceive, currency) }));
  if (!isPersonal && lowStock > 0) facts.push(t('pekka.close.pushLowStock', { count: lowStock }));
  return facts.length ? `${facts.join(' · ')}. ${t('pekka.close.pushTap')}` : t('pekka.close.pushGeneric');
}
