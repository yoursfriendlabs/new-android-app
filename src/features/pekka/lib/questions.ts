import type MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import { formatCurrency, type DatePeriod } from '@/src/shared/lib/format';
import type { DashboardSummary } from '@/src/types/models';

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;
type Translate = (key: string, params?: Record<string, string | number>) => string;

export interface PekkaAnswerContext {
  summary: DashboardSummary;
  isPersonal: boolean;
  period: DatePeriod;
  t: Translate;
}

export interface PekkaQuestion {
  id: string;
  /** i18n key for the chip / question bubble label. */
  labelKey: string;
  icon: IconName;
  /** Whether tapping it should first ask for a period. */
  needsPeriod: boolean;
  /** Shop-only questions are hidden in Personal workspaces. */
  scope: 'all' | 'shop';
  /** Builds the answer text from a dashboard summary for the chosen range. */
  answer: (ctx: PekkaAnswerContext) => string;
}

/** Income the way the home dashboard shows it, so Pekka's numbers match. */
function resolveIncome(summary: DashboardSummary): number {
  return Number(summary.revenueTotal ?? summary.incomeTotal ?? 0);
}

function resolveExpense(summary: DashboardSummary): number {
  return Number(summary.expenseTotal ?? 0);
}

function periodWord(period: DatePeriod, t: Translate): string {
  return t(`pekka.period.${period}`);
}

export const PEKKA_QUESTIONS: PekkaQuestion[] = [
  {
    id: 'income',
    labelKey: 'pekka.q.income',
    icon: 'cash-plus',
    needsPeriod: true,
    scope: 'all',
    answer: ({ summary, period, t }) =>
      t('pekka.a.income', {
        period: periodWord(period, t),
        value: formatCurrency(resolveIncome(summary)),
      }),
  },
  {
    id: 'expense',
    labelKey: 'pekka.q.expense',
    icon: 'cash-minus',
    needsPeriod: true,
    scope: 'all',
    answer: ({ summary, period, t }) =>
      t('pekka.a.expense', {
        period: periodWord(period, t),
        value: formatCurrency(resolveExpense(summary)),
      }),
  },
  {
    id: 'profit',
    labelKey: 'pekka.q.profit',
    icon: 'chart-line',
    needsPeriod: true,
    scope: 'all',
    answer: ({ summary, period, t }) => {
      const net = Number(summary.profitOrLoss ?? resolveIncome(summary) - resolveExpense(summary));
      const value = formatCurrency(Math.abs(net));
      const word = periodWord(period, t);
      if (net > 0) return t('pekka.a.profitProfit', { period: word, value });
      if (net < 0) return t('pekka.a.profitLoss', { period: word, value });
      return t('pekka.a.profitEven', { period: word });
    },
  },
  {
    id: 'sales',
    labelKey: 'pekka.q.sales',
    icon: 'point-of-sale',
    needsPeriod: true,
    scope: 'shop',
    answer: ({ summary, period, t }) =>
      t('pekka.a.sales', {
        period: periodWord(period, t),
        value: formatCurrency(Number(summary.salesTotal ?? 0)),
      }),
  },
  {
    id: 'toReceive',
    labelKey: 'pekka.q.toReceive',
    icon: 'account-arrow-left',
    needsPeriod: false,
    scope: 'shop',
    answer: ({ summary, t }) => {
      const amount = Number(summary.toReceive ?? summary.pendingReceivable ?? 0);
      return amount > 0
        ? t('pekka.a.toReceive', { value: formatCurrency(amount) })
        : t('pekka.a.toReceiveNone');
    },
  },
  {
    id: 'toPay',
    labelKey: 'pekka.q.toPay',
    icon: 'account-arrow-right',
    needsPeriod: false,
    scope: 'shop',
    answer: ({ summary, t }) => {
      const amount = Number(summary.toPay ?? summary.pendingPayable ?? 0);
      return amount > 0
        ? t('pekka.a.toPay', { value: formatCurrency(amount) })
        : t('pekka.a.toPayNone');
    },
  },
  {
    id: 'lowStock',
    labelKey: 'pekka.q.lowStock',
    icon: 'alert-decagram',
    needsPeriod: false,
    scope: 'shop',
    answer: ({ summary, t }) => {
      const count = Number(summary.lowStockCount ?? 0);
      return count > 0
        ? t('pekka.a.lowStock', { count })
        : t('pekka.a.lowStockNone');
    },
  },
];

export function questionsForWorkspace(isPersonal: boolean): PekkaQuestion[] {
  return PEKKA_QUESTIONS.filter((q) => (isPersonal ? q.scope === 'all' : true));
}
