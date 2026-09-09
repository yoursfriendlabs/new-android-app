import { format, subDays } from 'date-fns';

import { localIsoDate } from '@/src/shared/lib/format';

export interface FlowPoint {
  key: string;
  label: string;
  income: number;
  expense: number;
}

export function lastSevenDayKeys() {
  return Array.from({ length: 7 }, (_, index) => {
    const date = subDays(new Date(), 6 - index);
    return {
      key: localIsoDate(date),
      label: format(date, 'EEEEE'),
    };
  });
}

export function buildSevenDayFlow(input: {
  expenses: Array<{ purchaseDate?: string; grandTotal?: number; entryType?: string }>;
  incomes?: Array<{ purchaseDate?: string; grandTotal?: number; entryType?: string }>;
}): FlowPoint[] {
  const days = lastSevenDayKeys();
  const byDay = new Map(days.map((day) => [day.key, { income: 0, expense: 0 }]));

  for (const item of input.expenses) {
    if (item.entryType && item.entryType !== 'expense') continue;
    const key = String(item.purchaseDate || '').slice(0, 10);
    const bucket = byDay.get(key);
    if (bucket) bucket.expense += Number(item.grandTotal || 0);
  }

  for (const item of input.incomes ?? []) {
    if (item.entryType && item.entryType !== 'income') continue;
    const key = String(item.purchaseDate || '').slice(0, 10);
    const bucket = byDay.get(key);
    if (bucket) bucket.income += Number(item.grandTotal || 0);
  }

  return days.map((day) => ({
    ...day,
    income: byDay.get(day.key)?.income ?? 0,
    expense: byDay.get(day.key)?.expense ?? 0,
  }));
}
