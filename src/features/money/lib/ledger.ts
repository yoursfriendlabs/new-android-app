import type { LedgerEntry } from '@/src/types/models';

const TITLES: Record<string, string> = {
  sale: 'Sale',
  service: 'Service',
  purchase: 'Purchase',
  expense: 'Expense',
  income: 'Income',
  payment_in: 'Payment received',
  payment_out: 'Payment given',
};

const MONEY_IN = new Set(['sale', 'service', 'income', 'payment_in']);

/** Headline for a ledger row, e.g. "Sale #INV-12" or "Expense · Rent". */
export function ledgerEntryTitle(entry: LedgerEntry) {
  const type = String(entry.refType || '').toLowerCase();
  const base = TITLES[type] ?? 'Transaction';
  if (entry.refNo) return `${base} #${entry.refNo}`;
  if (entry.category) return `${base} · ${entry.category}`;
  return base;
}

/** True when the row brought money in (sale, service, income, payment received). */
export function isLedgerMoneyIn(entry: LedgerEntry) {
  const type = String(entry.refType || '').toLowerCase();
  if (type in TITLES) return MONEY_IN.has(type);
  return Number(entry.credit || 0) >= Number(entry.debit || 0);
}

/**
 * The full transaction amount. debit/credit only carry what is still due on a
 * bill, so a fully paid sale would show 0 without this.
 */
export function ledgerEntryAmount(entry: LedgerEntry) {
  const full = Number(entry.amount || 0);
  if (full > 0) return full;
  return Math.max(Number(entry.credit || 0), Number(entry.debit || 0));
}

/** What is still unpaid on a bill row, or 0 for payments and settled bills. */
export function ledgerEntryDue(entry: LedgerEntry) {
  const type = String(entry.refType || '').toLowerCase();
  if (type.startsWith('payment') || !Number(entry.amount || 0)) return 0;
  return Math.max(Number(entry.credit || 0), Number(entry.debit || 0));
}
