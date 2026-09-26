import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getPartyBalanceMeta,
  summarizePartyStatement,
} from '../src/features/parties/lib/party.ts';

const party = { id: 'p1', name: 'Ram Traders' };

test('a statement with money still to pay never reads as settled', () => {
  // Every bill is marked paid, but a standing balance of 50 remains — the old
  // receipt summed row dues, saw zero, and stamped the statement "Paid".
  const rows = [
    { id: '1', type: 'sale', totalAmount: 1000, dueAmount: 0 },
    { id: '2', type: 'payment_in', amount: 950 },
  ];
  const standing = summarizePartyStatement(party, rows, { currentAmount: 50 });

  assert.equal(standing.tone, 'pay');
  assert.equal(standing.label, 'To Pay');
  assert.equal(standing.amount, 50);
});

test('the statement direction matches what the party screen shows', () => {
  const rows = [{ id: '1', type: 'sale', totalAmount: 800, dueAmount: 800 }];

  for (const currentAmount of [-800, 800, 0]) {
    const screen = getPartyBalanceMeta(party, currentAmount);
    const standing = summarizePartyStatement(party, rows, { currentAmount });
    assert.equal(standing.tone, screen.tone);
    assert.equal(standing.label, screen.label);
    assert.equal(standing.amount, screen.absoluteAmount);
  }
});

test('a settled party owes nothing either way', () => {
  const standing = summarizePartyStatement(party, [], { currentAmount: 0 });
  assert.equal(standing.tone, 'settled');
  assert.equal(standing.amount, 0);
});

test('billed total counts bills only, payments are counted apart', () => {
  const rows = [
    { id: '1', type: 'sale', totalAmount: 1000, dueAmount: 400 },
    { id: '2', type: 'purchase', totalAmount: 300, dueAmount: 0 },
    { id: '3', type: 'payment_in', amount: 600 },
    { id: '4', type: 'payment_out', amount: 300 },
  ];
  const standing = summarizePartyStatement(party, rows, -400);

  assert.equal(standing.billedTotal, 1300);
  assert.equal(standing.paidIn, 600);
  assert.equal(standing.paidOut, 300);
  assert.equal(standing.tone, 'receive');
  assert.equal(standing.amount, 400);
});

test('the server summary wins over row arithmetic for payments', () => {
  // Only the latest page of rows is in hand; the summary covers every entry.
  const rows = [{ id: '3', type: 'payment_in', amount: 100 }];
  const standing = summarizePartyStatement(party, rows, {
    currentAmount: -250,
    totalPaymentIn: 900,
    totalPaymentOut: 40,
  });

  assert.equal(standing.paidIn, 900);
  assert.equal(standing.paidOut, 40);
});
