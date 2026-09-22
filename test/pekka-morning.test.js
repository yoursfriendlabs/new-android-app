import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildMorningBrief,
  morningFireTimes,
  morningNotificationBody,
  normalizeMorning,
  yesterdayRange,
} from '../src/features/pekka/lib/morning.ts';

// Echoes the key and params so the tests read the facts, not the wording.
const t = (key, params) => (params ? `${key} ${JSON.stringify(params)}` : key);

test('settings are clamped and default to 8 AM, off', () => {
  assert.deepEqual(normalizeMorning(null), { enabled: false, hour: 8, minute: 0 });
  assert.deepEqual(normalizeMorning({ enabled: true, hour: 30, minute: -5 }), { enabled: true, hour: 23, minute: 0 });
});

test('a week of mornings starts today only if the time is still ahead', () => {
  const settings = { enabled: true, hour: 8, minute: 0 };
  const early = morningFireTimes(settings, new Date(2026, 8, 22, 6, 0));
  assert.equal(early.length, 7);
  assert.equal(early[0].getDate(), 22);
  assert.equal(early[6].getDate(), 28);
  const late = morningFireTimes(settings, new Date(2026, 8, 22, 9, 0));
  assert.equal(late[0].getDate(), 23);
  assert.equal(late[0].getHours(), 8);
  // Crosses the month end without skipping a day.
  const monthEnd = morningFireTimes(settings, new Date(2026, 8, 30, 9, 0), 2);
  assert.deepEqual(monthEnd.map((d) => [d.getMonth(), d.getDate()]), [[9, 1], [9, 2]]);
});

test('yesterday is the local day before', () => {
  assert.deepEqual(yesterdayRange(new Date(2026, 9, 1, 0, 30)), { from: '2026-09-30', to: '2026-09-30' });
});

test('shop brief lists the day, dues and low stock, and points at stock first', () => {
  const brief = buildMorningBrief(
    { salesTotal: 1200, revenueTotal: 1500, expenseTotal: 300, toReceive: 5000, toPay: 0, lowStockCount: 4,
      lowStockItems: [{ name: 'Sugar' }, { name: 'Rice' }, { name: 'Oil' }, { name: 'Salt' }] },
    { isPersonal: false, t },
  );
  assert.equal(brief.lines.length, 3);
  assert.match(brief.lines[0], /^pekka\.morning\.shopDay/);
  assert.match(brief.lines[1], /^pekka\.morning\.toReceive/);
  assert.match(brief.lines[2], /"names":"Sugar, Rice, Oil"/);
  assert.equal(brief.action?.route, '/(app)/(tabs)/inventory');
});

test('quiet personal day never mentions stock', () => {
  const brief = buildMorningBrief({ lowStockCount: 9 }, { isPersonal: true, t });
  assert.deepEqual(brief.lines, ['pekka.morning.quietDay']);
  assert.equal(brief.action?.route, '/(app)/(tabs)/expenses');
});

test('notification text only uses numbers that stay true overnight', () => {
  assert.equal(morningNotificationBody(null, { isPersonal: false, t }), 'pekka.morning.pushGeneric');
  assert.equal(morningNotificationBody({ salesTotal: 999 }, { isPersonal: false, t }), 'pekka.morning.pushGeneric');
  const body = morningNotificationBody({ toReceive: 2000, lowStockCount: 2 }, { isPersonal: false, t });
  assert.match(body, /pushToReceive.*·.*pushLowStock.*pushTap/);
  assert.doesNotMatch(morningNotificationBody({ lowStockCount: 2 }, { isPersonal: true, t }), /pushLowStock/);
});
