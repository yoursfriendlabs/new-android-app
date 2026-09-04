import { isInCurrentMonth } from '@/src/features/money/lib/expense';
import { visibleMoneyParties } from '@/src/features/money/lib/money';
import { getPartyBalanceMeta } from '@/src/features/parties/lib/party';
import { todayIso } from '@/src/shared/lib/format';
import type { Party, PartyTransaction, Purchase } from '@/src/types/models';

function onDay(iso: string | undefined, day: string) {
  return String(iso || '').slice(0, 10) === day;
}

export interface PersonalPulse {
  todaySpent: number;
  monthIncome: number;
  monthExpense: number;
  monthSaved: number;
  theyOweYou: number;
  oweCount: number;
  topOwedBy: string | null;
}

export function buildPersonalPulse(input: {
  expenses?: Purchase[];
  payments?: PartyTransaction[];
  parties?: Party[];
  today?: string;
}): PersonalPulse {
  const today = input.today || todayIso();
  const expenses = input.expenses ?? [];
  const payments = input.payments ?? [];

  let todaySpent = 0;
  let monthIncome = 0;
  let monthExpense = 0;

  for (const item of expenses) {
    if (item.entryType && item.entryType !== 'expense') continue;
    const amount = Number(item.grandTotal || 0);
    if (onDay(item.purchaseDate, today)) todaySpent += amount;
    if (isInCurrentMonth(item.purchaseDate)) monthExpense += amount;
  }

  for (const item of payments) {
    const amount = Number(item.amount || 0);
    if (item.direction === 'receive') {
      if (isInCurrentMonth(item.txDate)) monthIncome += amount;
      continue;
    }
    if (onDay(item.txDate, today)) todaySpent += amount;
    if (isInCurrentMonth(item.txDate)) monthExpense += amount;
  }

  const owing = visibleMoneyParties(input.parties)
    .map((party) => {
      const meta = getPartyBalanceMeta(party, undefined, true);
      return { name: party.name, amount: meta.tone === 'receive' ? meta.absoluteAmount : 0 };
    })
    .filter((item) => item.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  return {
    todaySpent,
    monthIncome,
    monthExpense,
    monthSaved: monthIncome - monthExpense,
    theyOweYou: owing.reduce((sum, item) => sum + item.amount, 0),
    oweCount: owing.length,
    topOwedBy: owing[0]?.name ?? null,
  };
}
