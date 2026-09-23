import test from 'node:test';
import assert from 'node:assert/strict';

import {
  aiEnabled,
  canAskAi,
  countQuestion,
  dailyLimit,
  mergeServerUsage,
  normalizeUsage,
  planCode,
  remainingQuestions,
  PEKKA_DAILY_QUESTIONS,
} from '../src/features/pekka/lib/quota.ts';
import { PLANS, planByCode } from '../src/features/billing/lib/plans.ts';
import { en } from '../src/i18n/translations/en.ts';
import { ne } from '../src/i18n/translations/ne.ts';

const today = '2026-09-23';

test('the AI is off unless an active plan names the feature', () => {
  assert.equal(aiEnabled(null), false);
  assert.equal(aiEnabled({ isActive: true, features: [] }), false);
  assert.equal(aiEnabled({ isActive: false, features: ['pekka_ai'] }), false);
  assert.equal(aiEnabled({ isActive: true, features: ['Pekka_AI'] }), true);
});

test('the daily allowance follows the plan, and the server can override it', () => {
  assert.equal(dailyLimit(null), PEKKA_DAILY_QUESTIONS.free);
  assert.equal(dailyLimit({ planCode: 'pro' }), PEKKA_DAILY_QUESTIONS.pro);
  assert.equal(dailyLimit({ planCode: 'unknown-plan' }), PEKKA_DAILY_QUESTIONS.free);
  assert.equal(dailyLimit({ planCode: 'free', pekkaDailyQuestions: 42 }), 42);
  assert.equal(planCode({ planName: 'Pro' }), 'pro');
});

test('yesterday’s questions never count against today', () => {
  assert.deepEqual(normalizeUsage({ day: '2026-09-22', used: 5 }, today), { day: today, used: 0 });
  assert.deepEqual(normalizeUsage({ day: today, used: 3 }, today), { day: today, used: 3 });
  assert.deepEqual(normalizeUsage(null, today), { day: today, used: 0 });
});

test('questions are counted until the allowance runs out', () => {
  let usage = normalizeUsage(null, today);
  for (let index = 0; index < 5; index += 1) {
    assert.equal(canAskAi(usage, 5, today), true);
    usage = countQuestion(usage, today);
  }
  assert.equal(canAskAi(usage, 5, today), false);
  assert.equal(remainingQuestions(usage, 5, today), 0);
});

test('the server’s count wins when it is higher, so two phones stay honest', () => {
  const usage = { day: today, used: 2 };
  assert.deepEqual(mergeServerUsage(usage, { used: 7 }, today), { day: today, used: 7 });
  assert.deepEqual(mergeServerUsage(usage, { used: 1 }, today), { day: today, used: 2 });
  assert.deepEqual(mergeServerUsage(usage, null, today), { day: today, used: 2 });
});

test('every plan is priced honestly and described in both languages', () => {
  assert.equal(planByCode('pro')?.code, 'pro');
  for (const plan of PLANS) {
    // A price of null means "not decided yet" and shows as "Ask us", never as 0.
    assert.ok(plan.price === null || plan.price >= 0, plan.code);
    assert.ok(plan.aiQuestions >= 0);
    for (const dictionary of [en, ne]) {
      const name = plan.nameKey.split('.').reduce((value, key) => value?.[key], dictionary);
      const summary = plan.summaryKey.split('.').reduce((value, key) => value?.[key], dictionary);
      assert.ok(name?.length, `${plan.code} name`);
      assert.ok(summary?.length, `${plan.code} summary`);
      for (const key of plan.featureKeys) {
        const line = key.split('.').reduce((value, part) => value?.[part], dictionary);
        assert.ok(line?.length, key);
      }
    }
  }
});
