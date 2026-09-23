import { billDue } from '@/src/shared/lib/bill-status';
import type { Sale, Table } from '@/src/types/models';

const DEFAULT_TABLE_COUNT = 12;

export interface OrderStatusMeta {
  value: string;
  label: string;
  tone: string;
  accent: string;
}

export const CAFE_ORDER_STATUSES: OrderStatusMeta[] = [
  {
    value: 'new',
    label: 'New',
    tone: 'border-slate-200 bg-slate-50 text-slate-700',
    accent: 'bg-slate-900',
  },
  {
    value: 'to_cook',
    label: 'In progress',
    tone: 'border-amber-200 bg-amber-50 text-amber-800',
    accent: 'bg-amber-500',
  },
  {
    value: 'ready',
    label: 'Ready',
    tone: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    accent: 'bg-emerald-500',
  },
  {
    value: 'completed',
    label: 'Completed',
    tone: 'border-slate-200 bg-slate-100 text-slate-600',
    accent: 'bg-slate-400',
  },
];

const CAFE_ORDER_STATUS_SET = new Set(CAFE_ORDER_STATUSES.map((status) => status.value));

const ORDER_TYPE_LABELS: Record<string, string> = {
  dine_in: 'Dine In',
  takeaway: 'Takeaway',
  delivery: 'Delivery',
};

function asString(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

export function normalizeCafeOrderStatus(value: unknown): string {
  const normalized = asString(value).toLowerCase().replace(/[\s-]+/g, '_');
  // The web app and the kitchen board have both written this stage a few ways.
  if (normalized === 'in_progress' || normalized === 'progress' || normalized === 'preparing') {
    return 'to_cook';
  }
  return CAFE_ORDER_STATUS_SET.has(normalized) ? normalized : 'new';
}

export function getCafeOrderStatusMeta(status: unknown): OrderStatusMeta {
  return CAFE_ORDER_STATUSES.find((entry) => entry.value === normalizeCafeOrderStatus(status)) || CAFE_ORDER_STATUSES[0];
}

export function getCafeOrderTypeLabel(value: unknown): string {
  const normalized = asString(value).toLowerCase().replace(/[\s-]+/g, '_');
  return ORDER_TYPE_LABELS[normalized] || 'Walk-in';
}

export interface CafeOrderAttributes {
  orderStatus: string;
  orderType: string;
  tableNo: string;
  waiterName: string;
  guestCount: string;
  /** Kept on the order so a delivery rider has somewhere to go. */
  customerName: string;
  customerPhone: string;
  customerAddress: string;
}

export function getCafeOrderAttributes(sale: Partial<Sale> = {}): CafeOrderAttributes {
  const attributes = sale?.attributes && typeof sale.attributes === 'object' ? sale.attributes : {};
  const party = (sale as { party?: { name?: string; phone?: string; address?: string } })?.party;

  return {
    orderStatus: normalizeCafeOrderStatus(attributes.order_status),
    orderType: asString(attributes.order_type).toLowerCase().replace(/[\s-]+/g, '_') || 'dine_in',
    tableNo: asString(attributes.table_no),
    waiterName: asString(attributes.waiter_name),
    guestCount: asString(attributes.guest_count),
    customerName: asString(party?.name || attributes.customer_name || sale?.partyName),
    customerPhone: asString(party?.phone || attributes.customer_phone),
    customerAddress: asString(party?.address || attributes.customer_address),
  };
}

export function buildCafeOrderAttributes(
  previousAttributes: Record<string, unknown> = {},
  nextAttributes: Partial<CafeOrderAttributes> = {}
): Record<string, unknown> {
  const existing = previousAttributes && typeof previousAttributes === 'object' ? previousAttributes : {};
  const keep = (next: string | undefined, previous: unknown) =>
    next === undefined ? asString(previous) : asString(next);

  return {
    ...existing,
    order_status: normalizeCafeOrderStatus(nextAttributes.orderStatus ?? existing.order_status),
    order_type:
      asString(nextAttributes.orderType ?? existing.order_type).toLowerCase().replace(/[\s-]+/g, '_') ||
      'dine_in',
    table_no: keep(nextAttributes.tableNo, existing.table_no),
    waiter_name: keep(nextAttributes.waiterName, existing.waiter_name),
    guest_count: keep(nextAttributes.guestCount, existing.guest_count),
    customer_name: keep(nextAttributes.customerName, existing.customer_name),
    customer_phone: keep(nextAttributes.customerPhone, existing.customer_phone),
    customer_address: keep(nextAttributes.customerAddress, existing.customer_address),
  };
}

/**
 * True only for bills taken as cafe orders. A plain counter sale carries no
 * order attributes, and without this check it reads as a brand new order and
 * sits on the kitchen board forever.
 */
export function isCafeOrder(sale: Partial<Sale> = {}): boolean {
  const attributes = sale?.attributes && typeof sale.attributes === 'object' ? sale.attributes : {};
  return Boolean(
    asString(attributes.order_status) ||
      asString(attributes.order_type) ||
      asString(attributes.table_no) ||
      sale?.tableId,
  );
}

/** An order the kitchen or the cashier still has work to do on. */
const OPEN_CAFE_STATUSES = new Set(['new', 'to_cook', 'ready']);

export function isOpenCafeOrder(sale: Partial<Sale> = {}): boolean {
  if (!isCafeOrder(sale)) return false;
  return OPEN_CAFE_STATUSES.has(getCafeOrderAttributes(sale).orderStatus);
}

/**
 * The open order sitting on a table, so a second round of items joins the same
 * bill instead of starting a new one.
 */
export function findOpenTableOrder(orders: Sale[] = [], tableId: string, tableName?: string): Sale | null {
  return (
    orders.find((order) => {
      if (!isOpenCafeOrder(order)) return false;
      if (order.tableId && String(order.tableId) === String(tableId)) return true;
      const meta = getCafeOrderAttributes(order);
      return Boolean(tableName) && meta.tableNo === tableName;
    }) ?? null
  );
}

export function getCafePaymentMeta(order: Partial<Sale> = {}): { label: string; tone: string } {
  const dueAmount = billDue(order);
  const grandTotal = Number(order?.grandTotal || 0);

  if (grandTotal > 0 && dueAmount <= 0) {
    return {
      label: 'Paid',
      tone: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    };
  }

  return {
    label: 'Open Bill',
    tone: 'text-amber-700 bg-amber-50 border-amber-200',
  };
}

export interface CafeTableOption {
  id: string;
  label: string;
}

export function getDefaultCafeTables(count = DEFAULT_TABLE_COUNT): CafeTableOption[] {
  return Array.from({ length: count }, (_, index) => ({
    id: String(index + 1),
    label: `T${index + 1}`,
  }));
}

export interface MappedTable extends CafeTableOption {
  order: Sale | null;
  occupied: boolean;
  orderMeta: CafeOrderAttributes | null;
  statusMeta: OrderStatusMeta | null;
}

export function buildCafeTableMap(orders: Sale[] = [], tables: CafeTableOption[] = getDefaultCafeTables()): MappedTable[] {
  const occupancyByTable = new Map<string, Sale>();

  orders.forEach((order) => {
    const meta = getCafeOrderAttributes(order);
    if (!isOpenCafeOrder(order)) return;
    const tableIdentifier = order.tableId || meta.tableNo;
    if (!tableIdentifier) return;
    occupancyByTable.set(String(tableIdentifier), order);
  });

  return tables.map((table) => {
    const order = occupancyByTable.get(String(table.id)) || occupancyByTable.get(table.label) || null;
    const orderMeta = order ? getCafeOrderAttributes(order) : null;
    const statusMeta = orderMeta ? getCafeOrderStatusMeta(orderMeta.orderStatus) : null;

    return {
      ...table,
      order,
      occupied: Boolean(order),
      orderMeta,
      statusMeta,
    };
  });
}

export function getNextCafeOrderStatus(status: string): OrderStatusMeta | null {
  const currentIndex = CAFE_ORDER_STATUSES.findIndex((entry) => entry.value === normalizeCafeOrderStatus(status));
  if (currentIndex === -1) return null;
  return CAFE_ORDER_STATUSES[currentIndex + 1] || null;
}
