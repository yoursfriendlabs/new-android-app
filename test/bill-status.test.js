import test from 'node:test';
import assert from 'node:assert/strict';

import {
  apiBillStatus,
  billDue,
  billPaid,
  billState,
  billStateLabel,
  isBillSettled,
} from '../src/shared/lib/bill-status.ts';

test('the server dueAmount wins over local arithmetic', () => {
  // A part-paid bill where amountReceived was never refreshed on this row.
  const sale = { grandTotal: 1000, amountReceived: 1000, dueAmount: 400 };
  assert.equal(billDue(sale), 400);
  assert.equal(billState(sale), 'partial');
  assert.equal(isBillSettled(sale), false);
});

test('a bill with nothing paid reads as unpaid, not paid', () => {
  const sale = { grandTotal: 500, amountReceived: 0 };
  assert.equal(billDue(sale), 500);
  assert.equal(billState(sale), 'unpaid');
  assert.equal(billStateLabel(billState(sale)), 'Unpaid');
});

test('a service job uses receivedTotal for what has been settled', () => {
  const service = { grandTotal: 800, receivedTotal: 300 };
  assert.equal(billPaid(service), 300);
  assert.equal(billDue(service), 500);
  assert.equal(billState(service), 'partial');
});

test('rounding noise under half a rupee counts as settled', () => {
  assert.equal(isBillSettled({ grandTotal: 100, amountReceived: 99.8 }), true);
  assert.equal(billState({ grandTotal: 100, amountReceived: 99.8 }), 'paid');
});

test('a cancelled bill owes nothing', () => {
  const sale = { grandTotal: 700, amountReceived: 0, status: 'cancelled' };
  assert.equal(billDue(sale), 0);
  assert.equal(billState(sale), 'cancelled');
});

test('paid amount can be worked back from the due amount alone', () => {
  assert.equal(billPaid({ grandTotal: 1000, dueAmount: 250 }), 750);
});

test('the status sent to the server is only ever due or paid', () => {
  assert.equal(apiBillStatus(1000, 0), 'due');
  assert.equal(apiBillStatus(1000, 600), 'due');
  assert.equal(apiBillStatus(1000, 1000), 'paid');
  assert.equal(apiBillStatus(1000, 1200), 'paid');
});
