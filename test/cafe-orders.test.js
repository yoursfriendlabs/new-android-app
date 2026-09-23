import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildCafeOrderAttributes,
  findOpenTableOrder,
  getCafeOrderAttributes,
  getCafeOrderStatusMeta,
  isCafeOrder,
  isOpenCafeOrder,
  normalizeCafeOrderStatus,
} from '../src/features/cafe/lib/cafeOrders.ts';

test('a plain counter sale is not a cafe order', () => {
  const counterSale = { id: 's1', grandTotal: 400, attributes: {} };
  assert.equal(isCafeOrder(counterSale), false);
  // Without this, an untagged sale reads as "New" and never leaves the board.
  assert.equal(isOpenCafeOrder(counterSale), false);
});

test('an order the kitchen is still working on counts as open', () => {
  const order = { id: 's2', attributes: { order_status: 'to_cook', order_type: 'dine_in', table_no: 'T4' } };
  assert.equal(isCafeOrder(order), true);
  assert.equal(isOpenCafeOrder(order), true);

  const done = { id: 's3', attributes: { order_status: 'completed', order_type: 'takeaway' } };
  assert.equal(isOpenCafeOrder(done), false);
});

test('the web app\'s in-progress wording lands on the same stage', () => {
  assert.equal(normalizeCafeOrderStatus('in_progress'), 'to_cook');
  assert.equal(normalizeCafeOrderStatus('Preparing'), 'to_cook');
  assert.equal(getCafeOrderStatusMeta('in progress').label, 'In progress');
});

test('a second round of items joins the order already on the table', () => {
  const orders = [
    { id: 'done', tableId: 't1', attributes: { order_status: 'completed', order_type: 'dine_in' } },
    { id: 'open', tableId: 't1', attributes: { order_status: 'ready', order_type: 'dine_in', table_no: 'T1' } },
  ];
  assert.equal(findOpenTableOrder(orders, 't1')?.id, 'open');
  assert.equal(findOpenTableOrder(orders, 't9'), null);
});

test('an order saved by table name alone is still found', () => {
  const orders = [{ id: 'open', attributes: { order_status: 'new', order_type: 'dine_in', table_no: 'T7' } }];
  assert.equal(findOpenTableOrder(orders, 'unknown-id', 'T7')?.id, 'open');
});

test('saving again keeps the stage and the delivery details', () => {
  const previous = {
    order_status: 'to_cook',
    order_type: 'delivery',
    table_no: '',
    customer_name: 'Sita',
    customer_phone: '9800000000',
    customer_address: 'Patan',
  };
  // Nothing passed for the stage, so the kitchen's progress is not undone.
  const next = buildCafeOrderAttributes(previous, { orderType: 'delivery' });
  assert.equal(next.order_status, 'to_cook');
  assert.equal(next.customer_name, 'Sita');
  assert.equal(next.customer_address, 'Patan');
});

test('delivery details come back out of a saved order', () => {
  const order = {
    attributes: {
      order_status: 'new',
      order_type: 'delivery',
      customer_name: 'Hari',
      customer_phone: '9811111111',
      customer_address: 'Thamel',
    },
  };
  const meta = getCafeOrderAttributes(order);
  assert.equal(meta.orderType, 'delivery');
  assert.equal(meta.customerName, 'Hari');
  assert.equal(meta.customerPhone, '9811111111');
  assert.equal(meta.customerAddress, 'Thamel');
});
