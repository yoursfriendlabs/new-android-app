import { useQuery } from '@tanstack/react-query';

import { budgetsApi } from '@/src/api';
import { useDebouncedValue } from '@/src/shared/hooks/useDebouncedValue';

interface BudgetImpactInput {
  kind: 'income' | 'expense';
  amount: number;
  category: string;
  date: string;
  enabled?: boolean;
}

/**
 * What the entry being typed would do to the user's budgets and saving goals.
 * The server does the maths; this only waits for typing to pause.
 */
export function useBudgetImpact({ kind, amount, category, date, enabled = true }: BudgetImpactInput) {
  // Only the typed amount needs a pause; kind, category and date change on a tap.
  const debouncedAmount = useDebouncedValue(amount, 400);
  const query = { kind, amount: debouncedAmount, categoryKey: category.trim().toLowerCase(), date };
  return useQuery({
    queryKey: ['budget-impact', query],
    queryFn: () => budgetsApi.impact(query),
    enabled: enabled && query.amount > 0,
    staleTime: 15_000,
    retry: false,
  });
}
