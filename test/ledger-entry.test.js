import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isLedgerMoneyIn,
  ledgerEntryAmount,
  ledgerEntryDue,
  ledgerEntryTitle,
} from '../src/features/money/lib/ledger.ts';

test('a fully paid sale shows its full amount, not the zero still due', () => {
  const sale = { id: 's1', entryDate: '2026-09-01', refType: 'sale', refNo: 'INV-12', amount: 500, debit: 0, credit: 0 };
  assert.equal(ledgerEntryTitle(sale), 'Sale #INV-12');
  assert.equal(ledgerEntryAmount(sale), 500);
  assert.equal(ledgerEntryDue(sale), 0);
  assert.equal(isLedgerMoneyIn(sale), true);
});

test('a part-paid purchase shows the full amount and what is still due', () => {
  const purchase = { id: 'p1', entryDate: '2026-09-02', refType: 'purchase', amount: 300, credit: 120, debit: 0 };
  assert.equal(ledgerEntryTitle(purchase), 'Purchase');
  assert.equal(ledgerEntryAmount(purchase), 300);
  assert.equal(ledgerEntryDue(purchase), 120);
  assert.equal(isLedgerMoneyIn(purchase), false);
});

test('payments and personal rows fall back to debit/credit and never show a due', () => {
  const paidOut = { id: 'x', entryDate: '2026-09-03', refType: 'payment_out', debit: 80, credit: 0 };
  assert.equal(ledgerEntryTitle(paidOut), 'Payment given');
  assert.equal(ledgerEntryAmount(paidOut), 80);
  assert.equal(ledgerEntryDue(paidOut), 0);

  const income = { id: 'i', entryDate: '2026-09-03', refType: 'income', category: 'Salary', credit: 1000, debit: 0 };
  assert.equal(ledgerEntryTitle(income), 'Income · Salary');
  assert.equal(ledgerEntryDue(income), 0);
  assert.equal(isLedgerMoneyIn(income), true);
});

test('a ledger row says what it means without debit or credit talk', async () => {
  const { ledgerEntryEffect } = await import('../src/features/money/lib/ledger.ts');

  const unpaidSale = { id: 's2', entryDate: '2026-09-03', refType: 'sale', amount: 1000, dueAmount: 400 };
  assert.deepEqual(ledgerEntryEffect(unpaidSale), { kind: 'to_receive', label: 'To receive', amount: 400 });

  const paidSale = { id: 's3', entryDate: '2026-09-03', refType: 'sale', amount: 1000, dueAmount: 0 };
  assert.deepEqual(ledgerEntryEffect(paidSale), { kind: 'settled', label: 'Settled', amount: 0 });

  const unpaidPurchase = { id: 'p2', entryDate: '2026-09-04', refType: 'purchase', amount: 700, dueAmount: 300 };
  assert.deepEqual(ledgerEntryEffect(unpaidPurchase), { kind: 'to_pay', label: 'To pay', amount: 300 });

  const paymentIn = { id: 't1', entryDate: '2026-09-05', refType: 'payment_in', amount: 250, credit: 250 };
  assert.deepEqual(ledgerEntryEffect(paymentIn), { kind: 'received', label: 'Money received', amount: 250 });

  const paymentOut = { id: 't2', entryDate: '2026-09-06', refType: 'payment_out', amount: 180, debit: 180 };
  assert.deepEqual(ledgerEntryEffect(paymentOut), { kind: 'paid_out', label: 'Money paid', amount: 180 });
});

test('the server due amount is what a row reports as outstanding', async () => {
  const { ledgerEntryDue } = await import('../src/features/money/lib/ledger.ts');
  // amountReceived on this row is stale; dueAmount is the server's answer.
  assert.equal(ledgerEntryDue({ refType: 'sale', amount: 1000, dueAmount: 250, debit: 0 }), 250);
  assert.equal(ledgerEntryDue({ refType: 'payment_in', amount: 500, dueAmount: 0 }), 0);
});
