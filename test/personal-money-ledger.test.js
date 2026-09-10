import test from 'node:test';
import assert from 'node:assert/strict';

import { buildSevenDayFlow } from '../src/features/home/lib/flow-series.ts';
import { buildPersonalPulse } from '../src/features/home/lib/personal-pulse.ts';
import {
  buildMoneyPurchasePayload,
  moneyCategoryFromPurchase,
  moneyRemarkFromNote,
} from '../src/features/money/lib/money.ts';

test('income payload is a purchase entry that does not require a party', () => {
  const payload = buildMoneyPurchasePayload({
    kind: 'income',
    category: 'Salary',
    amount: 25000,
    amountPaid: 0,
    date: '2026-09-08',
    notes: 'September',
    paymentMethod: 'cash',
  });

  assert.equal(payload.entryType, 'income');
  assert.equal(payload.partyId, undefined);
  assert.equal(payload.amountReceived, 25000);
  assert.equal(payload.items[0].itemType, 'income');
  assert.equal(payload.items[0].categoryType, 'income');
});

test('expense payload carries no party either', () => {
  const payload = buildMoneyPurchasePayload({
    kind: 'expense',
    category: 'Food',
    amount: 450,
    amountPaid: 450,
    date: '2026-09-10',
    paymentMethod: 'cash',
  });

  // Income and expense must never land on a contact's ledger: what a contact
  // owes or is owed comes only from payment in / payment out.
  assert.equal(payload.partyId, undefined);
  assert.equal(payload.partyName, undefined);
  assert.equal(payload.entryType, 'expense');
});

test('money list shows what was typed, not the category again', () => {
  assert.equal(moneyRemarkFromNote('Food · lunch for the staff'), 'lunch for the staff');
  // No remark typed: the note is just the category, which the row already titles.
  assert.equal(moneyRemarkFromNote('Food'), '');
  assert.equal(moneyRemarkFromNote(''), '');
  assert.equal(moneyRemarkFromNote(null), '');
  // A remark containing the separator keeps all of itself.
  assert.equal(moneyRemarkFromNote('Bills · wifi · office'), 'wifi · office');
});

test('personal pulse uses income purchases, not party payments', () => {
  const pulse = buildPersonalPulse({
    today: '2026-09-08',
    expenses: [
      { id: 'e1', purchaseDate: '2026-09-08', grandTotal: 400, entryType: 'expense' },
    ],
    incomes: [
      { id: 'i1', purchaseDate: '2026-09-08', grandTotal: 10000, entryType: 'income' },
    ],
    parties: [
      {
        id: 'p1',
        name: 'Hari',
        type: 'customer',
        currentAmount: -1500,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
      {
        id: 'p2',
        name: 'Sita',
        type: 'customer',
        currentAmount: 800,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
    ],
  });

  assert.equal(pulse.monthIncome, 10000);
  assert.equal(pulse.monthExpense, 400);
  assert.equal(pulse.theyOweYou, 1500);
  assert.equal(pulse.youOweThem, 800);
});

test('seven-day flow counts income purchases separately from expenses', () => {
  const today = new Date();
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const series = buildSevenDayFlow({
    expenses: [{ purchaseDate: iso, grandTotal: 50, entryType: 'expense' }],
    incomes: [{ purchaseDate: iso, grandTotal: 200, entryType: 'income' }],
  });
  const todayPoint = series.find((point) => point.key === iso);
  assert.equal(todayPoint?.income, 200);
  assert.equal(todayPoint?.expense, 50);
});

test('income category is read from the purchase line', () => {
  assert.equal(
    moneyCategoryFromPurchase({
      id: 'i1',
      notes: 'Salary · extra',
      items: [{ description: 'Freelance' }],
    }),
    'Freelance',
  );
});
