import { formatCurrency, localIsoDate } from '@/src/shared/lib/format';
import type { DashboardSummary, ExpenseCategoryInsight } from '@/src/types/models';

type Translate = (key: string, params?: Record<string, string | number>) => string;

/**
 * Pekka's tips: small, factual observations from the user's own records.
 * Every rule has a floor so a tip is worth reading, and each one says what the
 * numbers are, never guesses why.
 */

export interface OverdueParty {
  id: string;
  name: string;
  amount: number;
  days: number;
}

export interface NudgeInputs {
  isPersonal: boolean;
  /** Day of the month (1–31) the comparison runs on. */
  dayOfMonth: number;
  overdue?: OverdueParty[];
  /** Spending by category, this month so far and the same days last month. */
  categoriesNow?: ExpenseCategoryInsight[];
  categoriesBefore?: ExpenseCategoryInsight[];
  /** Totals for the month so far. */
  month?: DashboardSummary;
  /** Sales for the last 7 full days and the 7 before them. */
  weekNow?: DashboardSummary;
  weekBefore?: DashboardSummary;
}

export interface PekkaNudge {
  /** Stable per fact, so "seen" survives a refresh with the same facts. */
  id: string;
  kind: 'overdue' | 'categoryUp' | 'monthLoss' | 'salesUp' | 'salesDown';
  text: string;
  action?: { label: string; route: string };
  /** Who the money is owed by, so Pekka can offer to write them a reminder. */
  party?: OverdueParty;
}

export const NUDGE_RULES = {
  overdueLimit: 2,
  /** A category must rise this much, and by at least `categoryMinIncrease`. */
  categoryRise: 0.3,
  categoryMinIncrease: 500,
  /** Too early in the month and every comparison is noise. */
  categoryFromDay: 7,
  monthLossFromDay: 10,
  salesChange: 0.2,
  salesMinWeek: 1000,
};

// Salary is planned, and uncategorised spending names nothing to act on.
const SKIP_CATEGORIES = new Set(['staff-salary', 'salary', 'uncategorized']);

export function nudgeRanges(now = new Date()) {
  const day = (offset: number) => {
    const date = new Date(now);
    date.setDate(date.getDate() + offset);
    return localIsoDate(date);
  };
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  // Same number of days last month, capped at that month's end (31 Mar → 28 Feb).
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  const sameDayLastMonth = new Date(lastMonthStart);
  sameDayLastMonth.setDate(Math.min(now.getDate(), lastMonthEnd.getDate()));
  return {
    month: { from: localIsoDate(monthStart), to: day(0) },
    monthBefore: { from: localIsoDate(lastMonthStart), to: localIsoDate(sameDayLastMonth) },
    weekNow: { from: day(-7), to: day(-1) },
    weekBefore: { from: day(-14), to: day(-8) },
  };
}

function percent(ratio: number) {
  return `${Math.round(Math.abs(ratio) * 100)}%`;
}

export function buildNudges(input: NudgeInputs, { t, currency = 'NPR' }: { t: Translate; currency?: string }): PekkaNudge[] {
  const money = (value: number) => formatCurrency(value, currency);
  const nudges: PekkaNudge[] = [];

  for (const party of (input.overdue ?? []).slice(0, NUDGE_RULES.overdueLimit)) {
    if (!(party.amount > 0) || !(party.days > 0)) continue;
    nudges.push({
      id: `overdue:${party.id}:${Math.round(party.amount)}`,
      kind: 'overdue',
      text: t('pekka.tips.overdue', { name: party.name, value: money(party.amount), days: party.days }),
      action: { label: t('pekka.tips.openParty', { name: party.name }), route: `/(app)/parties/${party.id}` },
      party,
    });
  }

  if (input.dayOfMonth >= NUDGE_RULES.categoryFromDay && input.categoriesNow?.length) {
    const before = new Map((input.categoriesBefore ?? []).map((item) => [item.categoryKey, Number(item.total || 0)]));
    const rises = input.categoriesNow
      .filter((item) => !SKIP_CATEGORIES.has(item.categoryKey))
      .map((item) => {
        const now = Number(item.total || 0);
        const previous = before.get(item.categoryKey) ?? 0;
        return { item, now, previous, increase: now - previous };
      })
      // A category that didn't exist last month isn't a rise, just new.
      .filter(({ previous, increase }) =>
        previous > 0 && increase >= NUDGE_RULES.categoryMinIncrease && increase / previous >= NUDGE_RULES.categoryRise)
      .sort((a, b) => b.increase - a.increase);
    const top = rises[0];
    if (top) {
      nudges.push({
        id: `categoryUp:${top.item.categoryKey}`,
        kind: 'categoryUp',
        text: t('pekka.tips.categoryUp', {
          category: top.item.categoryName,
          percent: percent(top.increase / top.previous),
          now: money(top.now),
          before: money(top.previous),
        }),
        action: { label: t('pekka.tips.openInsights'), route: '/(app)/money-insights' },
      });
    }
  }

  if (input.month && input.dayOfMonth >= NUDGE_RULES.monthLossFromDay) {
    const income = Number(input.month.revenueTotal ?? input.month.incomeTotal ?? 0);
    const expense = Number(input.month.expenseTotal ?? 0);
    const net = Number(input.month.profitOrLoss ?? income - expense);
    if (net < 0) {
      nudges.push({
        id: 'monthLoss',
        kind: 'monthLoss',
        text: t(input.isPersonal ? 'pekka.tips.monthOverspend' : 'pekka.tips.monthLoss', { value: money(-net) }),
        action: input.isPersonal
          ? { label: t('pekka.tips.openBudgets'), route: '/(app)/budgets' }
          : { label: t('pekka.tips.openInsights'), route: '/(app)/money-insights' },
      });
    }
  }

  if (!input.isPersonal && input.weekNow && input.weekBefore) {
    const now = Number(input.weekNow.salesTotal ?? 0);
    const before = Number(input.weekBefore.salesTotal ?? 0);
    if (before >= NUDGE_RULES.salesMinWeek) {
      const change = (now - before) / before;
      if (Math.abs(change) >= NUDGE_RULES.salesChange) {
        const up = change > 0;
        nudges.push({
          id: up ? 'salesUp' : 'salesDown',
          kind: up ? 'salesUp' : 'salesDown',
          text: t(up ? 'pekka.tips.salesUp' : 'pekka.tips.salesDown', {
            percent: percent(change),
            now: money(now),
            before: money(before),
          }),
          action: { label: t('pekka.tips.openSales'), route: '/(app)/sales' },
        });
      }
    }
  }

  return nudges;
}

/** Identifies today's set of tips, to know whether the user has seen them. */
export function nudgeSignature(nudges: PekkaNudge[], today = localIsoDate()): string {
  return nudges.length ? `${today}|${nudges.map((nudge) => nudge.id).join(',')}` : '';
}
