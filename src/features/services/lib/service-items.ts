import type { Product, Service, ServiceItem } from '@/src/types/models';

/** One line of a job's bill while it is being edited on the phone. */
export interface EditableServiceLine {
  /** Local key, stable while the sheet is open. */
  key: string;
  /** Set once the line exists on the server. */
  itemId?: string;
  itemType: 'labor' | 'part';
  productId?: string;
  productName?: string;
  description: string;
  quantity: number;
  unitType: string;
  conversionRate: number;
  unitPrice: number;
  taxRate: number;
}

export interface ServiceItemPayload {
  id?: string;
  _delete?: true;
  itemType: 'labor' | 'part';
  description: string;
  productId?: string;
  quantity: number;
  unitType: string;
  conversionRate: number;
  unitPrice: number;
  taxRate: number;
  lineTotal: number;
}

export interface ServiceTotals {
  laborTotal: number;
  partsTotal: number;
  subTotal: number;
  taxTotal: number;
  discountTotal: number;
  grandTotal: number;
}

function round2(value: number) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(2)) : 0;
}

function toNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

let keyCounter = 0;

function nextKey(prefix: string) {
  keyCounter += 1;
  return `${prefix}-${keyCounter}-${Date.now()}`;
}

export function lineTotalOf(line: Pick<EditableServiceLine, 'quantity' | 'unitPrice'>) {
  return round2(toNumber(line.quantity) * toNumber(line.unitPrice));
}

/** What the row should be called on screen. */
export function lineLabel(line: EditableServiceLine) {
  return (
    line.description.trim() ||
    line.productName?.trim() ||
    (line.itemType === 'part' ? 'Product' : 'Service charge')
  );
}

export function toEditableLines(items?: ServiceItem[] | null): EditableServiceLine[] {
  return (items ?? []).map((item) => {
    const itemType = String(item.itemType || (item.productId ? 'part' : 'labor')) === 'part' ? 'part' : 'labor';
    return {
      key: nextKey(itemType),
      itemId: item.id ? String(item.id) : undefined,
      itemType,
      productId: item.productId ? String(item.productId) : undefined,
      productName: typeof item.productName === 'string' ? item.productName : undefined,
      description: String(item.description ?? ''),
      quantity: toNumber(item.quantity),
      unitType: String(item.unitType || 'primary'),
      conversionRate: toNumber(item.conversionRate),
      unitPrice: toNumber(item.unitPrice),
      taxRate: toNumber(item.taxRate),
    };
  });
}

export function emptyLine(itemType: 'labor' | 'part'): EditableServiceLine {
  return {
    key: nextKey(itemType),
    itemType,
    description: '',
    quantity: 1,
    unitType: 'primary',
    conversionRate: 0,
    unitPrice: 0,
    taxRate: 0,
  };
}

/**
 * A picked product brings its own price, tax and units. The description only
 * changes when it was empty or still held the old product's name, so a typed
 * remark survives a product swap.
 */
export function applyProductToLine(line: EditableServiceLine, product: Product): EditableServiceLine {
  const keepDescription =
    line.description.trim() && line.description.trim() !== (line.productName ?? '').trim();

  return {
    ...line,
    itemType: 'part',
    productId: product.id,
    productName: product.name,
    description: keepDescription ? line.description : product.name,
    unitType: 'primary',
    conversionRate: 0,
    unitPrice: toNumber(product.salePrice),
    taxRate: toNumber(product.taxRate),
  };
}

/** Secondary units price and count differently, so the rate follows the unit. */
export function applyUnitTypeToLine(
  line: EditableServiceLine,
  unitType: 'primary' | 'secondary',
  product?: Product | null,
): EditableServiceLine {
  if (!product) return { ...line, unitType };
  const conversionRate = toNumber(product.secondaryConversionRate);
  if (unitType === 'secondary') {
    const secondaryPrice = toNumber(product.secondarySalePrice);
    return {
      ...line,
      unitType,
      conversionRate,
      unitPrice: secondaryPrice > 0
        ? secondaryPrice
        : conversionRate > 0
          ? round2(toNumber(product.salePrice) / conversionRate)
          : toNumber(product.salePrice),
    };
  }
  return { ...line, unitType, conversionRate: 0, unitPrice: toNumber(product.salePrice) };
}

/** Adds up the same way the server does, so the screen and the bill agree. */
export function summarizeLines(lines: EditableServiceLine[], discount = 0): ServiceTotals {
  let laborTotal = 0;
  let partsTotal = 0;
  let taxTotal = 0;

  for (const line of lines) {
    const total = lineTotalOf(line);
    if (line.itemType === 'part') partsTotal += total;
    else laborTotal += total;
    taxTotal += (total * toNumber(line.taxRate)) / 100;
  }

  const subTotal = round2(laborTotal + partsTotal);
  const roundedTax = round2(taxTotal);
  const discountTotal = Math.min(Math.max(round2(discount), 0), subTotal);

  return {
    laborTotal: round2(laborTotal),
    partsTotal: round2(partsTotal),
    subTotal,
    taxTotal: roundedTax,
    discountTotal,
    grandTotal: round2(Math.max(subTotal + roundedTax - discountTotal, 0)),
  };
}

/** First thing wrong with the bill, in words the shopkeeper can act on. */
export function findLineProblem(lines: EditableServiceLine[]): string | null {
  for (const line of lines) {
    if (line.itemType === 'part' && !line.productId) {
      return 'Pick a product for every product line, or remove it.';
    }
    if (!(toNumber(line.quantity) > 0)) {
      return `Enter a quantity for "${lineLabel(line)}".`;
    }
    if (toNumber(line.unitPrice) < 0) {
      return `The rate for "${lineLabel(line)}" cannot be below zero.`;
    }
    if (line.itemType === 'part' && line.unitType === 'secondary' && !(toNumber(line.conversionRate) > 0)) {
      return `"${lineLabel(line)}" has no conversion rate for its second unit.`;
    }
  }
  return null;
}

/** True when the lines no longer match what the server holds. */
export function linesChanged(lines: EditableServiceLine[], original?: ServiceItem[] | null) {
  const before = toEditableLines(original);
  if (before.length !== lines.length) return true;

  return lines.some((line, index) => {
    const was = before[index];
    if (!was) return true;
    return (
      was.itemId !== line.itemId ||
      was.itemType !== line.itemType ||
      (was.productId ?? '') !== (line.productId ?? '') ||
      was.description !== line.description ||
      was.quantity !== line.quantity ||
      was.unitType !== line.unitType ||
      was.conversionRate !== line.conversionRate ||
      was.unitPrice !== line.unitPrice ||
      was.taxRate !== line.taxRate
    );
  });
}

/**
 * The list the server expects: kept lines carry their id, brand new ones carry
 * none, and anything the user pulled off the bill is marked for deletion.
 */
export function buildItemsPayload(
  lines: EditableServiceLine[],
  original?: ServiceItem[] | null,
): ServiceItemPayload[] {
  const keptIds = new Set(lines.map((line) => line.itemId).filter(Boolean) as string[]);

  const kept: ServiceItemPayload[] = lines.map((line) => ({
    ...(line.itemId ? { id: line.itemId } : {}),
    itemType: line.itemType,
    description: line.description.trim() || line.productName?.trim() || '',
    ...(line.itemType === 'part' && line.productId ? { productId: line.productId } : {}),
    quantity: toNumber(line.quantity),
    unitType: line.unitType || 'primary',
    conversionRate: line.unitType === 'secondary' ? toNumber(line.conversionRate) : 0,
    unitPrice: toNumber(line.unitPrice),
    taxRate: toNumber(line.taxRate),
    lineTotal: lineTotalOf(line),
  }));

  const removed: ServiceItemPayload[] = (original ?? [])
    .filter((item) => item.id && !keptIds.has(String(item.id)))
    .map((item) => ({
      id: String(item.id),
      _delete: true as const,
      itemType: (String(item.itemType) === 'part' ? 'part' : 'labor') as 'labor' | 'part',
      description: String(item.description ?? ''),
      quantity: toNumber(item.quantity),
      unitType: String(item.unitType || 'primary'),
      conversionRate: toNumber(item.conversionRate),
      unitPrice: toNumber(item.unitPrice),
      taxRate: toNumber(item.taxRate),
      lineTotal: toNumber(item.lineTotal),
    }));

  return [...kept, ...removed];
}

/**
 * A tax invoice the tax office has already seen. Its lines and totals are
 * frozen; only status, payment and notes may still move.
 */
export function isServiceBillLocked(service?: Service | null) {
  if (!service) return false;
  const record = service as Record<string, unknown>;
  return record.isLocked === true || record.isLocked === 'true' || record.isLocked === 1;
}
