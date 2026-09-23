import { formatCurrency, localIsoDate } from '@/src/shared/lib/format';
import { normalizeSchedule, scheduleFireTimes, SCHEDULE_DAYS_AHEAD, type PekkaScheduleSettings } from './schedule';
import type { DashboardSummary } from '@/src/types/models';

type Translate = (key: string, params?: Record<string, string | number>) => string;

export type MorningSettings = PekkaScheduleSettings;

export const DEFAULT_MORNING: MorningSettings = { enabled: false, hour: 8, minute: 0 };

export const MORNING_TIMES = [
  { hour: 7, minute: 0 },
  { hour: 8, minute: 0 },
  { hour: 9, minute: 0 },
  { hour: 10, minute: 0 },
];

/**
 * Mornings are booked a week ahead. The first carries the latest numbers; the
 * rest just invite a look, so a quiet week still gets a nudge but no one who
 * stopped using the app is pinged forever.
 */
export const MORNING_DAYS_AHEAD = SCHEDULE_DAYS_AHEAD;
export const MORNING_ID_PREFIX = 'pekka-morning-';

export function normalizeMorning(value?: Partial<MorningSettings> | null): MorningSettings {
  return normalizeSchedule(value, DEFAULT_MORNING);
}

/** The next `count` mornings at the chosen time, starting tomorrow if today's has passed. */
export function morningFireTimes(settings: MorningSettings, from = new Date(), count = MORNING_DAYS_AHEAD): Date[] {
  return scheduleFireTimes(settings, from, count);
}

export function yesterdayRange(now = new Date()): { from: string; to: string } {
  const day = new Date(now);
  day.setDate(day.getDate() - 1);
  const iso = localIsoDate(day);
  return { from: iso, to: iso };
}

export interface MorningBrief {
  /** One line per fact, most important first. */
  lines: string[];
  /** Where the most useful follow-up lives. */
  action: { labelKey: string; route: string } | null;
}

/** Yesterday's money plus what needs attention today, from one dashboard summary. */
export function buildMorningBrief(
  summary: DashboardSummary,
  {
    isPersonal,
    t,
    currency = 'NPR',
    streak,
  }: {
    isPersonal: boolean;
    t: Translate;
    currency?: string;
    /** Days in a row the book was closed, so the morning can cheer it on. */
    streak?: { current: number; loggedToday: boolean } | null;
  },
): MorningBrief {
  const money = (value: number) => formatCurrency(value, currency);
  const income = Number(summary.revenueTotal ?? summary.incomeTotal ?? 0);
  const expense = Number(summary.expenseTotal ?? 0);
  const sales = Number(summary.salesTotal ?? 0);
  const toReceive = Number(summary.toReceive ?? summary.pendingReceivable ?? 0);
  const toPay = Number(summary.toPay ?? summary.pendingPayable ?? 0);
  const lowStock = Number(summary.lowStockCount ?? 0);
  const lines: string[] = [];

  if (isPersonal) {
    lines.push(
      income > 0 || expense > 0
        ? t('pekka.morning.personalDay', { income: money(income), expense: money(expense) })
        : t('pekka.morning.quietDay'),
    );
  } else {
    lines.push(
      sales > 0 || income > 0
        ? t('pekka.morning.shopDay', { sales: money(sales), income: money(income), expense: money(expense) })
        : t('pekka.morning.quietDay'),
    );
  }
  if (toReceive > 0) lines.push(t('pekka.morning.toReceive', { value: money(toReceive) }));
  if (toPay > 0) lines.push(t('pekka.morning.toPay', { value: money(toPay) }));

  const lowNames = (summary.lowStockItems ?? []).slice(0, 3).map((item) => item.name).filter(Boolean);
  if (!isPersonal && lowStock > 0) {
    lines.push(
      lowNames.length
        ? t('pekka.morning.lowStockNamed', { count: lowStock, names: lowNames.join(', ') })
        : t('pekka.morning.lowStock', { count: lowStock }),
    );
  }

  if (streak && streak.current > 0) {
    lines.push(t(streak.loggedToday ? 'pekka.morning.streak' : 'pekka.morning.streakAtRisk', { count: streak.current }));
  }

  let action: MorningBrief['action'] = null;
  if (!isPersonal && lowStock > 0) action = { labelKey: 'pekka.morning.openStock', route: '/(app)/(tabs)/inventory' };
  else if (toReceive > 0) action = { labelKey: 'pekka.morning.openDues', route: '/(app)/(tabs)/parties' };
  else if (isPersonal) action = { labelKey: 'pekka.morning.openMoney', route: '/(app)/(tabs)/expenses' };

  return { lines, action };
}

/**
 * Notification text for the first morning. Only balances and stock go in it:
 * they stay true overnight, unlike "yesterday's sales" counted mid-afternoon.
 */
export function morningNotificationBody(
  summary: DashboardSummary | null,
  { isPersonal, t, currency = 'NPR' }: { isPersonal: boolean; t: Translate; currency?: string },
): string {
  if (!summary) return t('pekka.morning.pushGeneric');
  const facts: string[] = [];
  const toReceive = Number(summary.toReceive ?? summary.pendingReceivable ?? 0);
  const lowStock = Number(summary.lowStockCount ?? 0);
  if (toReceive > 0) facts.push(t('pekka.morning.pushToReceive', { value: formatCurrency(toReceive, currency) }));
  if (!isPersonal && lowStock > 0) facts.push(t('pekka.morning.pushLowStock', { count: lowStock }));
  return facts.length
    ? `${facts.join(' · ')}. ${t('pekka.morning.pushTap')}`
    : t('pekka.morning.pushGeneric');
}
