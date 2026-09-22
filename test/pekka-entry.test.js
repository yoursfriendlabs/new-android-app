import test from 'node:test';
import assert from 'node:assert/strict';

import { parseEntry } from '../src/features/pekka/lib/entry-parser.ts';

test('sales in English with items, customer, total and credit', () => {
  assert.deepEqual(parseEntry('Sold 2 Coke and 1 chips to Ram, 100 baki'), {
    type: 'sale', items: [{ name: 'coke', quantity: 2 }, { name: 'chips', quantity: 1 }],
    partyName: 'ram', total: null, payment: 'credit', dueAmount: 100,
  });
  assert.deepEqual(parseEntry('sold 5 kg rice for Rs 1,200'), {
    type: 'sale', items: [{ name: 'rice', quantity: 5 }], partyName: null, total: 1200, payment: 'paid', dueAmount: null,
  });
  const twoItems = parseEntry('sold coke 2 and chips 3 on credit to Hari Bahadur');
  assert.deepEqual(twoItems.items, [{ name: 'coke', quantity: 2 }, { name: 'chips', quantity: 3 }]);
  assert.equal(twoItems.partyName, 'hari bahadur');
  assert.equal(twoItems.payment, 'credit');
});

test('sales in romanised Nepali and Nepali', () => {
  const roman = parseEntry('Ram lai 2 ta coke becheko 100 rupiya');
  assert.deepEqual(roman.items, [{ name: 'coke', quantity: 2 }]);
  assert.equal(roman.partyName, 'ram');
  assert.equal(roman.total, 100);
  const nepali = parseEntry('रामलाई २ वटा कोक बेचें, उधार');
  assert.deepEqual(nepali.items, [{ name: 'कोक', quantity: 2 }]);
  assert.equal(nepali.partyName, 'राम');
  assert.equal(nepali.payment, 'credit');
});

test('expenses and income', () => {
  assert.deepEqual(parseEntry('spent 250 on tea'), { type: 'money', kind: 'expense', amount: 250, label: 'tea', fromName: null });
  assert.deepEqual(parseEntry('chiya ma 250 kharcha'), { type: 'money', kind: 'expense', amount: 250, label: 'chiya', fromName: null });
  assert.deepEqual(parseEntry('चियामा २५० खर्च भयो'), { type: 'money', kind: 'expense', amount: 250, label: 'चिया', fromName: null });
  assert.deepEqual(parseEntry('got 5 hajar salary'), { type: 'money', kind: 'income', amount: 5000, label: 'salary', fromName: null });
  assert.deepEqual(parseEntry('received 500 from Ram'), { type: 'money', kind: 'income', amount: 500, label: null, fromName: 'ram' });
  assert.equal(parseEntry('spent 1.5k on fuel').amount, 1500);
});

test('questions and sentences without numbers are not entries', () => {
  assert.equal(parseEntry('how do I sell 2 items'), null);
  assert.equal(parseEntry('how much did I spend this month'), null);
  assert.equal(parseEntry('sold coke to Ram'), null);
  assert.equal(parseEntry('price of sugar'), null);
  assert.equal(parseEntry(''), null);
});

import { pickMatch } from '../src/features/pekka/lib/match.ts';
import { sellableStock, toCartLine } from '../src/features/pos/lib/cart-line.ts';

test('a match below 0.6 is treated as not found', () => {
  assert.equal(pickMatch([{ id: 'a', name: 'Coke', detail: '', score: 0.55 }]), null);
  assert.equal(pickMatch([{ id: 'a', name: 'Coke', detail: '', score: '0.8' }]).id, 'a');
  assert.equal(pickMatch([]), null);
});

test('cart lines use the listed price and only non-expired stock', () => {
  const product = { id: 'p', name: 'Coke', primaryUnit: 'pcs', salePrice: 50, taxRate: 13, stockOnHand: 10, expiredQuantity: 4 };
  assert.equal(sellableStock(product), 6);
  const line = toCartLine(product, 2);
  assert.deepEqual(
    [line.productId, line.quantity, line.unitPrice, line.taxRate, line.stockOnHand, line.unitType],
    ['p', 2, 50, 13, 6, 'primary'],
  );
});
