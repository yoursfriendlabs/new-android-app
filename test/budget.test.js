import test from 'node:test';
import assert from 'node:assert/strict';

import {
  budgetHeadline,
  budgetTone,
  expectedPercent,
  safeDailySpend,
  sortBudgets,
} from '../src/features/money/lib/budget.ts';

test('budget tone puts over before nearly used before pacing', () => {
  assert.equal(budgetTone({ status: 'over', projectedStatus: 'over' }), 'over');
  assert.equal(budgetTone({ status: 'warning' }), 'warning');
  assert.equal(budgetTone({ status: 'ok', projectedStatus: 'over' }), 'pacing');
  assert.equal(budgetTone({ status: 'ok' }), 'ok');
});

test('budgets needing attention sort first', () => {
  const sorted = sortBudgets([
    { id: 'a', status: 'ok', percentUsed: 90 },
    { id: 'b', status: 'over', percentUsed: 120 },
    { id: 'c', status: 'ok', percentUsed: 10, projectedStatus: 'over' },
    { id: 'd', status: 'warning', percentUsed: 85 },
  ]);
  assert.deepEqual(sorted.map((item) => item.id), ['b', 'd', 'c', 'a']);
});

test('safe daily spend splits what is left over the days left', () => {
  assert.equal(safeDailySpend({ amount: 10000, spent: 4000, daysLeft: 10 }), 600);
  assert.equal(safeDailySpend({ amount: 10000, spent: 12000, daysLeft: 10 }), 0);
  assert.equal(safeDailySpend({ amount: 3000, spent: 0, daysLeft: 0 }), 3000);
});

test('expected percent follows the days elapsed', () => {
  assert.equal(expectedPercent({ daysElapsed: 15, daysTotal: 30 }), 50);
  assert.equal(expectedPercent({ daysElapsed: 40, daysTotal: 30 }), 100);
  assert.equal(expectedPercent({ daysTotal: 0 }), null);
});

test('headline speaks to the worst problem first', () => {
  assert.match(budgetHeadline({ budgetCount: 3, overCount: 1, warningCount: 1, projectedOverCount: 0 }), /gone over/);
  assert.match(budgetHeadline({ budgetCount: 3, overCount: 0, warningCount: 2, projectedOverCount: 0 }), /nearly used/);
  assert.match(budgetHeadline({ budgetCount: 3, overCount: 0, warningCount: 0, projectedOverCount: 0 }), /on track/);
});
