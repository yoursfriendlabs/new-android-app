import { generateId } from '@/src/shared/lib/id';
import { todayIso } from '@/src/shared/lib/format';
import type { DraftPurchaseLine, PurchaseDraft } from '@/src/types/forms';
import type { Product } from '@/src/types/models';

/** Invoice numbers the phone made up while the server's next number was still loading. */
export const LOCAL_INVOICE_PREFIX = 'PUR-';

export interface PurchaseTotals {
  lineCount: number;
  quantity: number;
  subTotal: number;
  taxTotal: number;
  discountTotal: number;
  grandTotal: number;
  paid: number;
  due: number;
}

function round2(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(2)) : 0;
}

function toNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function createPurchaseDraft(): PurchaseDraft {
  return {
    supplier: null,
    invoiceNo: `${LOCAL_INVOICE_PREFIX}${Date.now().toString().slice(-6)}`,
    purchaseDate: todayIso(),
    status: 'received',
    notes: '',
    amountPaid: 0,
    paymentMethod: 'cash',
    bankId: undefined,
    paymentNote: '',
    discount: 0,
    taxOverride: undefined,
    items: [],
  };
}

export function createPurchaseLine(): DraftPurchaseLine {
  return {
    id: generateId('purchase-line'),
    product: null,
    description: '',
    quantity: 1,
    unitType: 'primary',
    unitPrice: 0,
    taxRate: 13,
    itemType: 'part',
  };
}

/**
 * The server hands out the real invoice number a moment after the form opens.
 * Take it only while the box still holds the made-up one, so a number the
 * supplier's own bill carries is never overwritten.
 */
export function nextInvoiceNo(current: string, serverNext?: string | null) {
  if (!serverNext) return current;
  return current.startsWith(LOCAL_INVOICE_PREFIX) ? serverNext : current;
}

export function lineTotalOf(line: Pick<DraftPurchaseLine, 'quantity' | 'unitPrice'>) {
  return round2(toNumber(line.quantity) * toNumber(line.unitPrice));
}

/** What the row is called on screen. */
export function lineLabel(line: DraftPurchaseLine) {
  return line.product?.name?.trim() || line.description.trim() || 'Bill line';
}

/**
 * A picked product brings its cost, tax and units with it. A typed description
 * survives a product swap; one left over from the old product does not.
 */
export function applyProductToLine(line: DraftPurchaseLine, product: Product): DraftPurchaseLine {
  const typed = line.description.trim();
  const keepDescription = Boolean(typed) && typed !== (line.product?.name ?? '').trim();

  return {
    ...line,
    product,
    description: keepDescription ? line.description : product.name,
    unitType: 'primary',
    unitPrice: toNumber(product.purchasePrice ?? product.salePrice),
    taxRate: toNumber(product.taxRate ?? 13),
  };
}

/** A carton costs more than a piece, so the unit cost follows the unit. */
export function applyUnitTypeToLine(
  line: DraftPurchaseLine,
  unitType: 'primary' | 'secondary',
  product?: Product | null,
): DraftPurchaseLine {
  const resolved = product ?? line.product;
  if (!resolved) return { ...line, unitType };

  const cost = toNumber(resolved.purchasePrice ?? resolved.salePrice);
  if (unitType !== 'secondary') return { ...line, unitType, unitPrice: cost };

  const conversionRate = toNumber(resolved.secondaryConversionRate);
  return {
    ...line,
    unitType,
    unitPrice: conversionRate > 0 ? round2(cost / conversionRate) : cost,
  };
}

/** How the line is counted and paid for, in the unit the row is written in. */
export function lineUnitLabel(line: DraftPurchaseLine) {
  if (line.unitType === 'secondary') return line.product?.secondaryUnit ?? 'unit';
  return line.product?.primaryUnit ?? 'unit';
}

export function purchaseTotals(draft: PurchaseDraft): PurchaseTotals {
  let subTotal = 0;
  let itemTax = 0;
  let quantity = 0;

  for (const line of draft.items) {
    const total = lineTotalOf(line);
    subTotal += total;
    itemTax += (total * toNumber(line.taxRate)) / 100;
    quantity += toNumber(line.quantity);
  }

  const roundedSub = round2(subTotal);
  const taxTotal = draft.taxOverride === undefined ? round2(itemTax) : Math.max(round2(draft.taxOverride), 0);
  const discountTotal = Math.max(round2(draft.discount), 0);
  const grandTotal = round2(Math.max(roundedSub + taxTotal - discountTotal, 0));
  const paid = Math.max(round2(draft.amountPaid), 0);

  return {
    lineCount: draft.items.length,
    quantity: round2(quantity),
    subTotal: roundedSub,
    taxTotal,
    discountTotal,
    grandTotal,
    paid,
    due: round2(Math.max(grandTotal - paid, 0)),
  };
}

/**
 * Has the user put anything of their own into this form? The invoice number and
 * today's date are filled in by the app, so neither counts as work to lose.
 */
export function isDraftDirty(draft: PurchaseDraft) {
  if (draft.supplier?.id) return true;
  if (draft.items.length) return true;
  if (draft.notes.trim() || draft.paymentNote.trim()) return true;
  if (toNumber(draft.amountPaid) > 0) return true;
  if (toNumber(draft.discount) > 0) return true;
  if (draft.taxOverride !== undefined) return true;
  return false;
}

/** The first thing wrong with the bill, in words the shopkeeper can act on. */
export function findDraftProblem(draft: PurchaseDraft): string | null {
  if (!draft.supplier?.id) return 'Pick the supplier this bill came from.';
  if (!draft.items.length) return 'Add at least one item to the bill.';

  for (const line of draft.items) {
    if (!line.product?.id && !line.description.trim()) {
      return 'Every line needs a product or a description.';
    }
    if (!(toNumber(line.quantity) > 0)) {
      return `Enter a quantity for "${lineLabel(line)}".`;
    }
    if (toNumber(line.unitPrice) < 0) {
      return `The unit cost for "${lineLabel(line)}" cannot be below zero.`;
    }
    if (line.unitType === 'secondary' && !(toNumber(line.product?.secondaryConversionRate) > 0)) {
      return `"${lineLabel(line)}" has no conversion rate for its second unit.`;
    }
  }

  if (draft.paymentMethod === 'bank' && toNumber(draft.amountPaid) > 0 && !draft.bankId) {
    return 'Choose the bank account the money went out of.';
  }

  return null;
}

/** The bill as the server wants it. */
export function buildPurchasePayload(draft: PurchaseDraft, totals: PurchaseTotals) {
  return {
    entryType: 'purchase' as const,
    partyId: draft.supplier?.id ?? '',
    partyName: draft.supplier?.name ?? '',
    invoiceNo: draft.invoiceNo,
    purchaseDate: draft.purchaseDate,
    status: draft.status,
    notes: draft.notes,
    amountReceived: totals.paid,
    paymentMethod: totals.paid > 0 ? draft.paymentMethod : 'cash',
    bankId: draft.paymentMethod === 'bank' ? draft.bankId : undefined,
    paymentNote: draft.paymentNote,
    subTotal: totals.subTotal,
    taxTotal: totals.taxTotal,
    discount: totals.discountTotal,
    discountTotal: totals.discountTotal,
    grandTotal: totals.grandTotal,
    items: draft.items.map((line) => ({
      productId: line.product?.id,
      quantity: toNumber(line.quantity),
      unitType: line.unitType,
      conversionRate: line.unitType === 'secondary' ? toNumber(line.product?.secondaryConversionRate) : 0,
      unitPrice: toNumber(line.unitPrice),
      taxRate: toNumber(line.taxRate),
      lineTotal: lineTotalOf(line),
      itemType: line.itemType,
      description: line.description.trim() || line.product?.name || '',
      expiryDate: line.expiryDate?.trim() || undefined,
      batchNumber: line.batchNumber?.trim() || undefined,
    })),
  };
}
