import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSale } from '../src/api/normalize.ts';

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
