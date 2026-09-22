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
