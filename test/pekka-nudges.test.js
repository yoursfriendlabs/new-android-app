import test from 'node:test';
import assert from 'node:assert/strict';

import { buildNudges, nudgeRanges, nudgeSignature } from '../src/features/pekka/lib/nudges.ts';

const t = (key, params) => (params ? `${key} ${JSON.stringify(params)}` : key);
const cat = (categoryKey, total) => ({ categoryKey, categoryName: categoryKey, total });
const kinds = (input) => buildNudges({ isPersonal: false, dayOfMonth: 15, ...input }, { t }).map((n) => n.kind);

test('overdue customers come first, at most two, each opening their page', () => {
  const nudges = buildNudges({
    isPersonal: false,
    dayOfMonth: 1,
    overdue: [
      { id: 'a', name: 'Hari', amount: 5000, days: 42 },
      { id: 'b', name: 'Sita', amount: 800, days: 31 },
      { id: 'c', name: 'Gita', amount: 100, days: 90 },
    ],
  }, { t });
  assert.equal(nudges.length, 2);
  assert.equal(nudges[0].action.route, '/(app)/parties/a');
  assert.match(nudges[0].text, /"days":42/);
});

test('a category rise needs 30% and a real amount, and skips salary and new categories', () => {
  assert.deepEqual(kinds({ categoriesNow: [cat('tea', 1600)], categoriesBefore: [cat('tea', 1000)] }), ['categoryUp']);
  assert.deepEqual(kinds({ categoriesNow: [cat('tea', 1200)], categoriesBefore: [cat('tea', 1000)] }), []); // 20%
  assert.deepEqual(kinds({ categoriesNow: [cat('tea', 130)], categoriesBefore: [cat('tea', 100)] }), []); // too small
  assert.deepEqual(kinds({ categoriesNow: [cat('staff-salary', 90000)], categoriesBefore: [cat('staff-salary', 10000)] }), []);
  assert.deepEqual(kinds({ categoriesNow: [cat('rent', 9000)], categoriesBefore: [] }), []);
  assert.deepEqual(kinds({ dayOfMonth: 3, categoriesNow: [cat('tea', 4000)], categoriesBefore: [cat('tea', 1000)] }), []);
});

test('only the biggest rise is mentioned', () => {
  const nudges = buildNudges({
    isPersonal: true,
    dayOfMonth: 20,
    categoriesNow: [cat('tea', 2000), cat('fuel', 9000)],
    categoriesBefore: [cat('tea', 1000), cat('fuel', 5000)],
  }, { t });
  assert.equal(nudges.length, 1);
  assert.equal(nudges[0].id, 'categoryUp:fuel');
});

test('month loss waits until day 10 and uses personal wording in personal', () => {
  assert.deepEqual(kinds({ month: { profitOrLoss: -500 } }), ['monthLoss']);
  assert.deepEqual(kinds({ dayOfMonth: 5, month: { profitOrLoss: -500 } }), []);
  const personal = buildNudges({ isPersonal: true, dayOfMonth: 12, month: { revenueTotal: 100, expenseTotal: 400 } }, { t });
  assert.match(personal[0].text, /^pekka\.tips\.monthOverspend/);
  assert.equal(personal[0].action.route, '/(app)/budgets');
});

test('sales trend needs a 20% swing on a real week, shop only', () => {
  assert.deepEqual(kinds({ weekNow: { salesTotal: 13000 }, weekBefore: { salesTotal: 10000 } }), ['salesUp']);
  assert.deepEqual(kinds({ weekNow: { salesTotal: 7000 }, weekBefore: { salesTotal: 10000 } }), ['salesDown']);
  assert.deepEqual(kinds({ weekNow: { salesTotal: 11000 }, weekBefore: { salesTotal: 10000 } }), []);
  assert.deepEqual(kinds({ weekNow: { salesTotal: 900 }, weekBefore: { salesTotal: 300 } }), []);
  assert.equal(buildNudges({ isPersonal: true, dayOfMonth: 15, weekNow: { salesTotal: 20000 }, weekBefore: { salesTotal: 10000 } }, { t }).length, 0);
});

test('comparison windows line up, even at month ends', () => {
  const ranges = nudgeRanges(new Date(2026, 2, 31));
  assert.deepEqual(ranges.month, { from: '2026-03-01', to: '2026-03-31' });
  assert.deepEqual(ranges.monthBefore, { from: '2026-02-01', to: '2026-02-28' });
  assert.deepEqual(ranges.weekNow, { from: '2026-03-24', to: '2026-03-30' });
  assert.deepEqual(ranges.weekBefore, { from: '2026-03-17', to: '2026-03-23' });
});

test('the seen-signature changes only when the facts change', () => {
  const a = [{ id: 'overdue:a:5000' }, { id: 'salesUp' }];
  assert.equal(nudgeSignature(a, '2026-09-22'), '2026-09-22|overdue:a:5000,salesUp');
  assert.equal(nudgeSignature([], '2026-09-22'), '');
});
