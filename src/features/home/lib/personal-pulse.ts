import { isInCurrentMonth } from '@/src/features/money/lib/expense';
import { visibleMoneyParties } from '@/src/features/money/lib/money';
import { getPartyBalanceMeta } from '@/src/features/parties/lib/party';
import { todayIso } from '@/src/shared/lib/format';
import type { Party, Purchase } from '@/src/types/models';

function onDay(iso: string | undefined, day: string) {
  return String(iso || '').slice(0, 10) === day;
}

export interface PersonalPulse {
  todaySpent: number;
  monthIncome: number;
  monthExpense: number;
  monthSaved: number;
  theyOweYou: number;
  youOweThem: number;
  oweCount: number;
  payCount: number;
  topOwedBy: string | null;
  topOwedTo: string | null;
}

export function buildPersonalPulse(input: {
  expenses?: Purchase[];
  incomes?: Purchase[];
  parties?: Party[];
  today?: string;
}): PersonalPulse {
  const today = input.today || todayIso();
  const expenses = input.expenses ?? [];
  const incomes = input.incomes ?? [];

  let todaySpent = 0;
  let monthIncome = 0;
  let monthExpense = 0;

  for (const item of expenses) {
    if (item.entryType && item.entryType !== 'expense') continue;
    const amount = Number(item.grandTotal || 0);
    if (onDay(item.purchaseDate, today)) todaySpent += amount;
    if (isInCurrentMonth(item.purchaseDate)) monthExpense += amount;
  }

  for (const item of incomes) {
    if (item.entryType && item.entryType !== 'income') continue;
    const amount = Number(item.grandTotal || 0);
    if (isInCurrentMonth(item.purchaseDate)) monthIncome += amount;
  }

  const visible = visibleMoneyParties(input.parties).map((party) => {
    const meta = getPartyBalanceMeta(party, undefined, true);
    return { name: party.name, meta };
  });

  const owing = visible
    .filter((item) => item.meta.tone === 'receive')
    .sort((a, b) => b.meta.absoluteAmount - a.meta.absoluteAmount);
  const payable = visible
    .filter((item) => item.meta.tone === 'pay')
    .sort((a, b) => b.meta.absoluteAmount - a.meta.absoluteAmount);

  return {
    todaySpent,
    monthIncome,
    monthExpense,
    monthSaved: monthIncome - monthExpense,
    theyOweYou: owing.reduce((sum, item) => sum + item.meta.absoluteAmount, 0),
    youOweThem: payable.reduce((sum, item) => sum + item.meta.absoluteAmount, 0),
    oweCount: owing.length,
    payCount: payable.length,
    topOwedBy: owing[0]?.name ?? null,
    topOwedTo: payable[0]?.name ?? null,
  };
}
