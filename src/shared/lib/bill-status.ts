/**
 * One place that answers "how much is still owed on this bill?".
 *
 * The server is the authority: it stores `dueAmount` on every sale, purchase
 * and service, and only ever keeps two statuses — 'due' or 'paid'. Screens used
 * to each work this out from their own arithmetic, which is how a bill with
 * money outstanding could print as settled.
 */

/** Anything below this is rounding noise, not a real balance. */
const SETTLED_EPSILON = 0.5;

export type BillState = 'paid' | 'partial' | 'unpaid' | 'cancelled';

export interface BillAmounts {
  grandTotal?: number | string | null;
  /** Sales and purchases call it this. */
  amountReceived?: number | string | null;
  /** Service jobs call it this. */
  receivedTotal?: number | string | null;
  dueAmount?: number | string | null;
  status?: string | null;
}

const CANCELLED = new Set(['cancelled', 'canceled', 'void']);

function num(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function hasValue(value: unknown) {
  return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
}

export function billTotal(bill: BillAmounts | null | undefined) {
  return num(bill?.grandTotal);
}

/** How much has been settled so far. */
export function billPaid(bill: BillAmounts | null | undefined) {
  if (!bill) return 0;
  if (hasValue(bill.amountReceived)) return num(bill.amountReceived);
  if (hasValue(bill.receivedTotal)) return num(bill.receivedTotal);
  if (hasValue(bill.dueAmount)) return Math.max(billTotal(bill) - num(bill.dueAmount), 0);
  return 0;
}

/** What is still outstanding. Trusts the server's `dueAmount` when it sent one. */
export function billDue(bill: BillAmounts | null | undefined) {
  if (!bill) return 0;
  if (isBillCancelled(bill)) return 0;
  if (hasValue(bill.dueAmount)) return Math.max(num(bill.dueAmount), 0);
  return Math.max(billTotal(bill) - billPaid(bill), 0);
}

export function isBillCancelled(bill: BillAmounts | null | undefined) {
  return CANCELLED.has(String(bill?.status ?? '').trim().toLowerCase());
}

export function isBillSettled(bill: BillAmounts | null | undefined) {
  return billDue(bill) < SETTLED_EPSILON;
}

export function billState(bill: BillAmounts | null | undefined): BillState {
  if (isBillCancelled(bill)) return 'cancelled';
  if (isBillSettled(bill)) return 'paid';
  return billPaid(bill) >= SETTLED_EPSILON ? 'partial' : 'unpaid';
}

export function billStateLabel(state: BillState) {
  if (state === 'paid') return 'Paid';
  if (state === 'partial') return 'Partly paid';
  if (state === 'cancelled') return 'Cancelled';
  return 'Unpaid';
}

/**
 * The status to send the server. It only understands 'due' and 'paid' — sending
 * 'partial' or 'unpaid' hides the bill from every open-bill list there is.
 */
export function apiBillStatus(grandTotal: number, amountSettled: number): 'due' | 'paid' {
  return Math.max(num(grandTotal) - num(amountSettled), 0) >= SETTLED_EPSILON ? 'due' : 'paid';
}
