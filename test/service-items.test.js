import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyProductToLine,
  applyUnitTypeToLine,
  buildItemsPayload,
  emptyLine,
  findLineProblem,
  isServiceBillLocked,
  lineLabel,
  lineTotalOf,
  linesChanged,
  summarizeLines,
  toEditableLines,
} from '../src/features/services/lib/service-items.ts';
import { normalizeService, normalizeServiceItem } from '../src/api/normalize.ts';

test('prices and quantities arriving as strings become numbers', () => {
  const item = normalizeServiceItem({
    id: 'item-1',
    productId: 'p-1',
    productName: 'Screen',
    quantity: '2.000',
    unitPrice: '1500.00',
    taxRate: '13.00',
    lineTotal: '3000.00',
  });

  assert.equal(item.quantity, 2);
  assert.equal(item.unitPrice, 1500);
  assert.equal(item.taxRate, 13);
  assert.equal(item.lineTotal, 3000);
  // A part with no typed remark falls back to the product's name, never its id.
  assert.equal(item.description, 'Screen');
  assert.equal(item.itemType, 'part');
});

test('a line total missing from the server is worked out from quantity and rate', () => {
  const item = normalizeServiceItem({ quantity: '3', unitPrice: '250.50' });
  assert.equal(item.lineTotal, 751.5);
  assert.equal(item.itemType, 'labor');
});

test('a service carries its items through as numbers', () => {
  const service = normalizeService({
    id: 'so-1',
    orderNo: 'SO-1',
    grandTotal: '1130.00',
    receivedTotal: '500.00',
    items: [{ id: 'i-1', itemType: 'labor', description: 'Repair', quantity: '1', unitPrice: '1000.00', taxRate: '13' }],
  });

  assert.equal(service.items.length, 1);
  assert.equal(service.items[0].unitPrice, 1000);
  assert.equal(service.grandTotal, 1130);
});

test('a service response with no items list still gives an empty list', () => {
  const service = normalizeService({ id: 'so-2', orderNo: 'SO-2' });
  assert.deepEqual(service.items, []);
});

test('totals add up the way the server does', () => {
  const lines = toEditableLines([
    { id: 'i-1', itemType: 'labor', description: 'Labour', quantity: '1', unitPrice: '1000', taxRate: '0' },
    { id: 'i-2', itemType: 'part', productId: 'p-1', productName: 'Screen', quantity: '2', unitPrice: '500', taxRate: '13' },
  ]);

  const totals = summarizeLines(lines, 100);
  assert.equal(totals.laborTotal, 1000);
  assert.equal(totals.partsTotal, 1000);
  assert.equal(totals.subTotal, 2000);
  assert.equal(totals.taxTotal, 130);
  assert.equal(totals.discountTotal, 100);
  assert.equal(totals.grandTotal, 2030);
});

test('a discount can never run past the bill', () => {
  const lines = [{ ...emptyLine('labor'), quantity: 1, unitPrice: 500 }];
  assert.equal(summarizeLines(lines, 900).discountTotal, 500);
  assert.equal(summarizeLines(lines, 900).grandTotal, 0);
  assert.equal(summarizeLines(lines, -50).discountTotal, 0);
});

test('an empty bill totals zero', () => {
  assert.deepEqual(summarizeLines([], 250), {
    laborTotal: 0,
    partsTotal: 0,
    subTotal: 0,
    taxTotal: 0,
    discountTotal: 0,
    grandTotal: 0,
  });
});

test('a removed line is sent as a deletion, a new one without an id', () => {
  const original = [
    { id: 'i-1', itemType: 'labor', description: 'Labour', quantity: 1, unitPrice: 1000, taxRate: 0, lineTotal: 1000 },
    { id: 'i-2', itemType: 'part', productId: 'p-1', description: 'Screen', quantity: 1, unitPrice: 500, taxRate: 13, lineTotal: 500 },
  ];
  const lines = toEditableLines(original);
  const kept = [lines[0], { ...emptyLine('part'), productId: 'p-9', productName: 'Battery', description: 'Battery', quantity: 2, unitPrice: 300 }];

  const payload = buildItemsPayload(kept, original);

  assert.equal(payload.length, 3);
  assert.equal(payload[0].id, 'i-1');
  assert.equal(payload[1].id, undefined);
  assert.equal(payload[1].productId, 'p-9');
  assert.equal(payload[1].lineTotal, 600);
  assert.deepEqual({ id: payload[2].id, _delete: payload[2]._delete }, { id: 'i-2', _delete: true });
});

test('a labor line is sent without a product id', () => {
  const payload = buildItemsPayload([
    { ...emptyLine('labor'), description: 'Service charge', quantity: 1, unitPrice: 750 },
  ]);

  assert.equal('productId' in payload[0], false);
  assert.equal(payload[0].lineTotal, 750);
});

test('untouched lines report no change, an edited quantity does', () => {
  const original = [
    { id: 'i-1', itemType: 'labor', description: 'Labour', quantity: 1, unitPrice: 1000, taxRate: 0, lineTotal: 1000 },
  ];
  const lines = toEditableLines(original);
  assert.equal(linesChanged(lines, original), false);
  assert.equal(linesChanged([{ ...lines[0], quantity: 2 }], original), true);
  assert.equal(linesChanged([], original), true);
});

test('a product line waiting on a product is refused', () => {
  const problem = findLineProblem([emptyLine('part')]);
  assert.match(problem, /Pick a product/);
});

test('a zero quantity is refused by name', () => {
  const line = { ...emptyLine('labor'), description: 'Tuning', quantity: 0, unitPrice: 100 };
  assert.equal(findLineProblem([line]), 'Enter a quantity for "Tuning".');
});

test('a good bill has nothing to report', () => {
  const line = { ...emptyLine('labor'), description: 'Tuning', quantity: 1, unitPrice: 100 };
  assert.equal(findLineProblem([line]), null);
});

test('picking a product brings its rate, tax and name across', () => {
  const line = applyProductToLine(emptyLine('part'), {
    id: 'p-1',
    name: 'Screen',
    salePrice: 1200,
    taxRate: 13,
    primaryUnit: 'pcs',
  });

  assert.equal(line.itemType, 'part');
  assert.equal(line.unitPrice, 1200);
  assert.equal(line.taxRate, 13);
  assert.equal(line.description, 'Screen');
  assert.equal(lineLabel(line), 'Screen');
});

test('a typed remark survives swapping the product', () => {
  const product = { id: 'p-1', name: 'Screen', salePrice: 1200, primaryUnit: 'pcs' };
  const first = applyProductToLine(emptyLine('part'), product);
  const noted = { ...first, description: 'Screen (customer supplied)' };
  const swapped = applyProductToLine(noted, { id: 'p-2', name: 'Battery', salePrice: 800, primaryUnit: 'pcs' });

  assert.equal(swapped.description, 'Screen (customer supplied)');
  assert.equal(swapped.unitPrice, 800);
});

test('the second unit prices per pack and remembers the conversion', () => {
  const product = { id: 'p-1', name: 'Oil', salePrice: 100, primaryUnit: 'ml', secondaryUnit: 'bottle', secondaryConversionRate: 4 };
  const line = applyUnitTypeToLine(applyProductToLine(emptyLine('part'), product), 'secondary', product);

  assert.equal(line.unitType, 'secondary');
  assert.equal(line.conversionRate, 4);
  assert.equal(line.unitPrice, 25);
  assert.equal(lineTotalOf({ quantity: 2, unitPrice: line.unitPrice }), 50);
});

test('a locked tax invoice is recognised', () => {
  assert.equal(isServiceBillLocked({ isLocked: true }), true);
  assert.equal(isServiceBillLocked({ isLocked: false }), false);
  assert.equal(isServiceBillLocked(null), false);
});
