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
    label: 'To Cook',
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
}

export function getCafeOrderAttributes(sale: Partial<Sale> = {}): CafeOrderAttributes {
  const attributes = sale?.attributes && typeof sale.attributes === 'object' ? sale.attributes : {};

  return {
    orderStatus: normalizeCafeOrderStatus(attributes.order_status),
    orderType: asString(attributes.order_type).toLowerCase().replace(/[\s-]+/g, '_') || 'dine_in',
    tableNo: asString(attributes.table_no),
    waiterName: asString(attributes.waiter_name),
    guestCount: asString(attributes.guest_count),
  };
}

export function buildCafeOrderAttributes(
  previousAttributes: Record<string, unknown> = {},
  nextAttributes: Partial<CafeOrderAttributes> = {}
): Record<string, unknown> {
  const existing = previousAttributes && typeof previousAttributes === 'object' ? previousAttributes : {};

  return {
    ...existing,
    order_status: normalizeCafeOrderStatus(nextAttributes.orderStatus),
    order_type: asString(nextAttributes.orderType).toLowerCase().replace(/[\s-]+/g, '_') || 'dine_in',
    table_no: asString(nextAttributes.tableNo),
    waiter_name: asString(nextAttributes.waiterName),
    guest_count: asString(nextAttributes.guestCount),
  };
}

export function getCafePaymentMeta(order: Partial<Sale> = {}): { label: string; tone: string } {
  const dueAmount = Number(order?.dueAmount || 0);
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
  const activeStatuses = new Set(['new', 'to_cook', 'ready']);
  const occupancyByTable = new Map<string, Sale>();

  orders.forEach((order) => {
    const meta = getCafeOrderAttributes(order);
    if (!activeStatuses.has(meta.orderStatus)) return;
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
