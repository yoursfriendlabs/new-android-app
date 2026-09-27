import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSale } from '../src/api/normalize.ts';
import { changeCartUnit, hasSecondaryUnit, primaryQuantity, toCartLine } from '../src/features/pos/lib/cart-line.ts';

const product = { id: 'p1', name: 'Tea', primaryUnit: 'box', secondaryUnit: 'piece', secondaryConversionRate: 12, salePrice: 100, stockOnHand: 2 };

test('Sequelize sale details retain sold item names, prices and line IDs', () => {
  const sale = normalizeSale({ data: { id: 's1', grandTotal: '200.00', Party: { name: 'Ram' }, SaleItems: [
    { id: 'l1', productId: 'p1', quantity: '2.000', unitPrice: '100.00', taxRate: '13', lineTotal: '200.00', unitType: 'primary', Product: product },
  ] } });
  assert.equal(sale.items.length, 1);
  assert.equal(sale.items[0].id, 'l1');
  assert.equal(sale.items[0].productName, 'Tea');
  assert.equal(sale.items[0].unit, 'box');
  assert.equal(sale.items[0].quantity, 2);
  assert.equal(sale.items[0].unitPrice, 100);
  assert.equal(sale.items[0].lineTotal, 200);
  assert.equal(sale.grandTotal, 200);
  assert.equal(sale.partyName, 'Ram');
});

test('normalized items and secondary units work without Sequelize aliases', () => {
  const sale = normalizeSale({ id: 's2', items: [{ productName: 'Tea', product, unitType: 'secondary', quantity: '3', unitPrice: '8.33', conversionRate: '12' }] });
  assert.equal(sale.items[0].unit, 'piece');
  assert.equal(sale.items[0].lineTotal, 24.99);
  assert.equal(sale.items[0].conversionRate, 12);
  assert.deepEqual(normalizeSale({ id: 'empty' }).items, []);
});

test('explicit zero prices and totals stay zero', () => {
  const sale = normalizeSale({ items: [{ quantity: 2, unitPrice: 100, lineTotal: 0 }] });
  assert.equal(sale.items[0].lineTotal, 0);
});

test('unit choice updates price without rounding drift when switched back', () => {
  const primary = toCartLine(product, 3);
  const secondary = changeCartUnit(primary, 'secondary');
  assert.equal(secondary.unit, 'piece');
  assert.equal(secondary.quantity, 3);
  assert.equal(secondary.unitPrice, 8.33);
  assert.equal(primaryQuantity(secondary), 0.25);
  assert.equal(changeCartUnit(secondary, 'primary').unitPrice, 100);
  assert.equal(changeCartUnit(secondary, 'secondary'), secondary);
});

test('stock limits compare pieces to boxes, including fractional stock', () => {
  const line = changeCartUnit(toCartLine(product), 'secondary');
  assert.equal(primaryQuantity(line, 24), 2);
  assert.ok(primaryQuantity(line, 25) > 2);
  assert.equal(primaryQuantity(line, 6), 0.5);
});

test('invalid conversions never enable a secondary unit', () => {
  for (const rate of [0, -1, NaN, Infinity, undefined]) {
    const line = { ...toCartLine(product), secondaryConversionRate: rate };
    assert.equal(hasSecondaryUnit(line), false);
    assert.equal(changeCartUnit(line, 'secondary'), line);
  }
});
