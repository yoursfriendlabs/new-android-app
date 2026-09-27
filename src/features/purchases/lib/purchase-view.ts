import { billDue, billState, billStateLabel, isBillSettled, type BillState } from '@/src/shared/lib/bill-status';
import type { PurchaseStatsResponse } from '@/src/types/contracts';
import type { Party, Purchase } from '@/src/types/models';

export type StatusTone = 'info' | 'warning' | 'success' | 'danger' | 'muted';

export interface PurchaseStatusView {
  state: BillState;
  label: string;
  tone: StatusTone;
  icon: 'check-circle-outline' | 'clock-outline' | 'alert-circle-outline' | 'close-circle-outline';
}

export interface PurchaseSupplier {
  name: string;
  phone: string;
  address: string;
  party?: Party;
}

export interface PurchaseCounts {
  all: number;
  due: number;
  paid: number;
  totalBilled: number;
  totalDue: number;
  /** False once any number above is only the rows loaded so far. */
  fromServer: boolean;
}

/** How much is still owed on this bill. The server's own figure wins. */
export function purchaseDue(item: Purchase | null | undefined) {
  return billDue(item);
}

export function isPurchaseSettled(item: Purchase | null | undefined) {
  return isBillSettled(item);
}

/** The pill on the row: paid, part paid, unpaid or cancelled. */
export function purchaseStatusView(item: Purchase | null | undefined): PurchaseStatusView {
  const state = billState(item);
  const label = billStateLabel(state);

  if (state === 'cancelled') return { state, label, tone: 'muted', icon: 'close-circle-outline' };
  if (state === 'paid') return { state, label, tone: 'success', icon: 'check-circle-outline' };
  if (state === 'partial') return { state, label, tone: 'warning', icon: 'clock-outline' };
  return { state, label, tone: 'danger', icon: 'alert-circle-outline' };
}

/**
 * The supplier behind a bill. A row may carry the name itself, a nested party,
 * or only an id — the loaded party list fills in phone and address.
 */
export function resolvePurchaseSupplier(item: Purchase, partyMap?: Map<string, Party>): PurchaseSupplier {
  const record = item as Record<string, unknown>;
  const nested = (record.party || record.Party || record.supplier) as Party | undefined;
  const directName = item.partyName || nested?.name || (record.supplierName as string | undefined);
  const directPhone = nested?.phone || (record.supplierPhone as string | undefined) || (record.phone as string | undefined);
  const matched = item.partyId ? partyMap?.get(item.partyId) : undefined;

  return {
    name: directName || matched?.name || 'Supplier',
    phone: String(directPhone || matched?.phone || ''),
    address: String(matched?.address || nested?.address || ''),
    party: matched ?? nested,
  };
}

/**
 * The four tiles above the list. Server stats cover every bill; without them we
 * can only add up the pages loaded so far, and the tiles say so.
 */
export function purchaseCounts(rows: Purchase[], stats?: PurchaseStatsResponse | null, loadedTotal?: number): PurchaseCounts {
  let due = 0;
  let paid = 0;
  let totalBilled = 0;
  let totalDue = 0;

  for (const item of rows) {
    totalBilled += Number(item.grandTotal || 0);
    totalDue += purchaseDue(item);
    if (isPurchaseSettled(item)) paid += 1;
    else due += 1;
  }

  if (stats?.purchaseCount !== undefined && stats.purchaseDueCount !== undefined) {
    return {
      all: stats.purchaseCount,
      due: stats.purchaseDueCount,
      paid: Math.max(0, stats.purchaseCount - stats.purchaseDueCount),
      totalBilled: Number(stats.totalPurchases ?? totalBilled),
      totalDue: Number(stats.purchaseDue ?? totalDue),
      fromServer: true,
    };
  }

  return {
    all: Math.max(loadedTotal ?? rows.length, rows.length),
    due,
    paid,
    totalBilled,
    totalDue,
    fromServer: false,
  };
}

/**
 * Keeps the paid/unpaid tabs honest on servers that ignore the payment filter.
 * Search is left to the server, which also looks inside notes and line items.
 */
export function filterByPayment(rows: Purchase[], filter: 'all' | 'due' | 'paid') {
  if (filter === 'all') return rows;
  return rows.filter((item) => (filter === 'paid' ? isPurchaseSettled(item) : !isPurchaseSettled(item)));
}
