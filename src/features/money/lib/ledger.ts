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
  if (type.startsWith('payment')) return 0;
  // The statement sends the outstanding amount straight through; older ledger
  // rows only carried it in whichever of debit/credit applied.
  if (entry.dueAmount !== undefined && entry.dueAmount !== null) {
    return Math.max(Number(entry.dueAmount), 0);
  }
  if (!Number(entry.amount || 0)) return 0;
  return Math.max(Number(entry.credit || 0), Number(entry.debit || 0));
}

export type LedgerEffectKind = 'to_receive' | 'to_pay' | 'received' | 'paid_out' | 'settled';

export interface LedgerEffect {
  kind: LedgerEffectKind;
  /** Plain words for what this row means, with no debit/credit talk. */
  label: string;
  /** The figure the label is about: what is still owed, or the cash that moved. */
  amount: number;
}

/**
 * What a ledger row means for the shop, said the way a shopkeeper would say it.
 * Debit and credit only make sense to a bookkeeper; everyone else wants to know
 * whether they are getting money or giving it.
 */
export function ledgerEntryEffect(entry: LedgerEntry): LedgerEffect {
  const type = String(entry.refType || '').toLowerCase();

  if (type === 'payment_in' || type.includes('receive')) {
    return { kind: 'received', label: 'Money received', amount: ledgerEntryAmount(entry) };
  }
  if (type === 'payment_out' || type.includes('give')) {
    return { kind: 'paid_out', label: 'Money paid', amount: ledgerEntryAmount(entry) };
  }

  const due = ledgerEntryDue(entry);
  if (due <= 0) {
    return { kind: 'settled', label: 'Settled', amount: 0 };
  }

  // A sale or service the customer has not cleared is money coming to us; an
  // unpaid purchase or expense is money we still owe.
  return MONEY_IN.has(type)
    ? { kind: 'to_receive', label: 'To receive', amount: due }
    : { kind: 'to_pay', label: 'To pay', amount: due };
}
