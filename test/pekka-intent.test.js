import test from 'node:test';
import assert from 'node:assert/strict';

import { matchPekkaIntent } from '../src/features/pekka/lib/intent.ts';

const shop = (text) => matchPekkaIntent(text, false);
const personal = (text) => matchPekkaIntent(text, true);
const helpId = (intent) => (intent?.type === 'help' ? intent.topic.id : null);

test('how-to questions open the right screen', () => {
  assert.equal(helpId(shop('How do I add stock?')), 'stock');
  assert.equal(helpId(shop('how to record a sale')), 'sale');
  assert.equal(helpId(shop('where can I see sales history')), 'salesHistory');
  assert.equal(helpId(shop('kasari kharcha rakhne')), 'money');
  assert.equal(helpId(shop('स्टक कसरी थप्ने?')), 'stock');
  assert.equal(helpId(shop('how do I change language')), 'settings');
  assert.equal(helpId(shop('how to delete my account')), 'deleteAccount');
});

test('shop-only topics stay out of personal workspaces', () => {
  assert.equal(helpId(personal('how do I add stock')), null);
  assert.equal(helpId(personal('how do I add a contact')), 'contacts');
  assert.equal(helpId(personal('how to set a reminder')), 'notes');
  assert.equal(helpId(shop('how to set a reminder')), null);
});

test('totals questions pick the total and the period', () => {
  assert.deepEqual(shop('how much did I spend this month'), { type: 'total', id: 'expense', period: 'this_month' });
  assert.deepEqual(shop('total sales today'), { type: 'total', id: 'sales', period: 'today' });
  assert.deepEqual(shop('am I in profit'), { type: 'total', id: 'profit', period: null });
  assert.deepEqual(shop('yo mahina ko aamdani kati'), { type: 'total', id: 'income', period: 'this_month' });
  assert.deepEqual(shop('आज कति बिक्री भयो'), { type: 'total', id: 'sales', period: 'today' });
  assert.equal(personal('total sales today'), null);
});

test('lookups and narrow questions are left for the server', () => {
  assert.equal(shop('price of sugar'), null);
  assert.equal(shop('how much does Ram owe'), null);
  assert.equal(shop('Ram ko baki kati cha'), null);
  assert.equal(shop('how much did I spend on tea'), null);
  assert.equal(shop(''), null);
});
