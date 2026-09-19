import type { Budget, BudgetSummary } from '@/src/types/models';

export type BudgetTone = 'over' | 'warning' | 'pacing' | 'ok';

/** Over the cap beats nearly used, which beats "on course to go over". */
export function budgetTone(budget: Pick<Budget, 'status' | 'projectedStatus'>): BudgetTone {
  if (budget.status === 'over') return 'over';
  if (budget.status === 'warning') return 'warning';
  if (budget.projectedStatus === 'over') return 'pacing';
  return 'ok';
}

export const BUDGET_TONE_LABEL: Record<BudgetTone, string> = {
  over: 'Over budget',
  warning: 'Nearly used',
  pacing: 'Pacing over',
  ok: 'On track',
};

const TONE_RANK: Record<BudgetTone, number> = { over: 0, warning: 1, pacing: 2, ok: 3 };

/** Budgets that need attention first; within a group, the most used first. */
export function sortBudgets<T extends Budget>(budgets: T[]) {
  return [...budgets].sort((a, b) => {
    const rank = TONE_RANK[budgetTone(a)] - TONE_RANK[budgetTone(b)];
    if (rank !== 0) return rank;
    return (b.percentUsed ?? 0) - (a.percentUsed ?? 0);
  });
}

export function budgetRemaining(budget: Pick<Budget, 'amount' | 'spent' | 'remaining'>) {
  return budget.remaining ?? budget.amount - (budget.spent ?? 0);
}

/** How much can still go out each day, today included, without breaking the cap. */
export function safeDailySpend(budget: Pick<Budget, 'amount' | 'spent' | 'remaining' | 'daysLeft'>) {
  const remaining = budgetRemaining(budget);
  if (remaining <= 0) return 0;
  return remaining / Math.max(1, budget.daysLeft ?? 1);
}

/**
 * Where spending "should" be by today if it were spread evenly over the period, as a
 * percentage of the cap. Drawn as a marker on the bar: past it means ahead of plan.
 */
export function expectedPercent(budget: Pick<Budget, 'daysElapsed' | 'daysTotal'>) {
  const total = Number(budget.daysTotal ?? 0);
  if (total <= 0) return null;
  const elapsed = Math.min(Math.max(Number(budget.daysElapsed ?? 0), 0), total);
  return (elapsed / total) * 100;
}

export function clampPercent(percent?: number | null) {
  return Math.min(Math.max(Number(percent ?? 0), 0), 100);
}

/** One line for the top of the screen that says how the plan is going. */
export function budgetHeadline(summary?: Pick<BudgetSummary, 'budgetCount' | 'overCount' | 'warningCount' | 'projectedOverCount'> | null) {
  if (!summary?.budgetCount) return 'Set a limit and PM keeps count as you spend.';
  if (summary.overCount) {
    return summary.overCount === 1 ? '1 budget has gone over. Time to slow down there.' : `${summary.overCount} budgets have gone over.`;
  }
  if (summary.warningCount) {
    return summary.warningCount === 1 ? '1 budget is nearly used up.' : `${summary.warningCount} budgets are nearly used up.`;
  }
  if (summary.projectedOverCount) return 'On track today, but spending is running ahead of plan.';
  return 'Everything is on track. Nice work.';
}

/** Starter budgets offered when the list is empty; tapping one fills the form. */
export const BUDGET_TEMPLATES = [
  { label: 'Monthly total', scope: 'total' as const, categoryName: '', icon: 'wallet-outline' as const },
  { label: 'Food', scope: 'category' as const, categoryName: 'Food', icon: 'food-fork-drink' as const },
  { label: 'Transport', scope: 'category' as const, categoryName: 'Transport', icon: 'car' as const },
  { label: 'Shopping', scope: 'category' as const, categoryName: 'Shopping', icon: 'shopping' as const },
  { label: 'Bills', scope: 'category' as const, categoryName: 'Bills', icon: 'receipt' as const },
];

/** Quick amounts for the form, sized to the period. */
export function budgetAmountChips(period: 'weekly' | 'monthly' | 'yearly' | string) {
  if (period === 'weekly') return [1000, 2500, 5000, 10000];
  if (period === 'yearly') return [50000, 100000, 250000, 500000];
  return [5000, 10000, 25000, 50000];
}

export function periodDays(period: 'weekly' | 'monthly' | 'yearly' | string) {
  if (period === 'weekly') return 7;
  if (period === 'yearly') return 365;
  return 30;
}
