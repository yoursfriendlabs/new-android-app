import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildDayClose,
  dayCloseFireTimes,
  dayCloseNotificationBody,
  normalizeDayClose,
  todayRange,
} from '../src/features/pekka/lib/day-close.ts';
import { buildShareSummary } from '../src/features/pekka/lib/share-summary.ts';
import {
  canRemindAgain,
  collectFireTime,
  buildCollectMessage,
  phoneForLinks,
  smsUrl,
  topOverdue,
  whatsappUrl,
} from '../src/features/pekka/lib/collect.ts';
import { en } from '../src/i18n/translations/en.ts';
import { ne } from '../src/i18n/translations/ne.ts';

// Echoes the key and params so the tests read the facts, not the wording.
const t = (key, params) => (params ? `${key} ${JSON.stringify(params)}` : key);

test('the day-close is off by default and set for 8 PM', () => {
  assert.deepEqual(normalizeDayClose(null), { enabled: false, hour: 20, minute: 0 });
  assert.deepEqual(normalizeDayClose({ enabled: true, hour: 99, minute: 61 }), { enabled: true, hour: 23, minute: 59 });
});

test('evenings are booked a week ahead, starting tomorrow once the hour has passed', () => {
  const settings = { enabled: true, hour: 20, minute: 0 };
  const early = dayCloseFireTimes(settings, new Date(2026, 8, 23, 18, 0));
  assert.equal(early.length, 7);
  assert.equal(early[0].getDate(), 23);
  assert.equal(early[0].getHours(), 20);
  const late = dayCloseFireTimes(settings, new Date(2026, 8, 23, 21, 0), 2);
  assert.equal(late[0].getDate(), 24);
});

test('today’s range is a single day', () => {
  const range = todayRange(new Date(2026, 8, 23, 13, 0));
  assert.equal(range.from, range.to);
  assert.match(range.from, /^\d{4}-\d{2}-\d{2}$/);
});

test('a day with sales reports what came in, what is left and what is still owed', () => {
  const brief = buildDayClose(
    { salesTotal: 5000, revenueTotal: 4000, expenseTotal: 1500, toReceive: 2000, lowStockCount: 0 },
    { isPersonal: false, t },
  );
  assert.equal(brief.quiet, false);
  assert.match(brief.lines[0], /pekka\.close\.shopDay/);
  assert.match(brief.lines[1], /pekka\.close\.left/);
  assert.ok(brief.lines.some((line) => line.startsWith('pekka.close.toReceive')));
  assert.equal(brief.action?.labelKey, 'pekka.close.openDues');
});

test('spending more than came in is said plainly', () => {
  const brief = buildDayClose(
    { salesTotal: 1000, revenueTotal: 1000, expenseTotal: 2500 },
    { isPersonal: false, t },
  );
  assert.ok(brief.lines.some((line) => line.startsWith('pekka.close.short')));
});

test('an empty day asks for today’s entries instead of reporting zero', () => {
  const shop = buildDayClose({}, { isPersonal: false, t });
  assert.equal(shop.quiet, true);
  assert.equal(shop.lines[0], 'pekka.close.quietDay');
  assert.equal(shop.action?.labelKey, 'pekka.close.openSale');

  const personal = buildDayClose({}, { isPersonal: true, t });
  assert.equal(personal.lines[0], 'pekka.close.quietPersonal');
  assert.equal(personal.action?.labelKey, 'pekka.close.openMoney');
});

test('the streak line follows whether today is already closed', () => {
  const closed = buildDayClose({ salesTotal: 10 }, { isPersonal: false, t, streak: { current: 4, loggedToday: true } });
  assert.ok(closed.lines.some((line) => line.startsWith('pekka.close.streak ')));

  const first = buildDayClose({ salesTotal: 10 }, { isPersonal: false, t, streak: { current: 1, loggedToday: true } });
  assert.ok(first.lines.includes('pekka.close.streakFirst'));

  const risk = buildDayClose({ salesTotal: 10 }, { isPersonal: false, t, streak: { current: 3, loggedToday: false } });
  assert.ok(risk.lines.some((line) => line.startsWith('pekka.close.streakAtRisk')));
});

test('the evening notification carries only facts that stay true for hours', () => {
  const body = dayCloseNotificationBody(
    { salesTotal: 9999, toReceive: 1200, lowStockCount: 2 },
    { isPersonal: false, t },
  );
  assert.ok(body.includes('pekka.close.pushToReceive'));
  assert.ok(body.includes('pekka.close.pushLowStock'));
  assert.ok(!body.includes('9999'));
  assert.equal(dayCloseNotificationBody(null, { isPersonal: false, t }), 'pekka.close.pushGeneric');
});

test('the shared summary names the shop, skips empty lines and says where it came from', () => {
  const text = buildShareSummary(
    { salesTotal: 5000, revenueTotal: 4000, expenseTotal: 1500, toReceive: 2000 },
    { isPersonal: false, t, title: 'Ram Store', dateLabel: '23 Sep 2026' },
  );
  assert.ok(text.startsWith('Ram Store · 23 Sep 2026'));
  assert.ok(text.includes('pekka.share.sales'));
  assert.ok(text.trimEnd().endsWith('pekka.share.footer'));

  const quiet = buildShareSummary({}, { isPersonal: true, t, dateLabel: '23 Sep 2026' });
  assert.ok(quiet.includes('pekka.share.quiet'));
  assert.ok(!quiet.includes('pekka.share.sales'));
});

test('reminder messages are written for the person and open in WhatsApp or SMS', () => {
  const message = buildCollectMessage({ name: 'Ram', amount: 1200 }, { t });
  assert.match(message, /pekka\.collect\.message/);
  assert.equal(phoneForLinks('98-4123 4567'), '9779841234567');
  assert.equal(phoneForLinks('+91 98765 43210'), '919876543210');
  assert.equal(phoneForLinks(''), '');
  assert.ok(whatsappUrl('9779841234567', 'hi there').endsWith('hi%20there'));
  assert.ok(smsUrl('9841234567', 'hi there').startsWith('sms:9841234567?body='));
});

test('the collect reminder waits days between nags and chases the longest overdue first', () => {
  const now = new Date(2026, 8, 23, 10, 0);
  assert.equal(canRemindAgain('', now), true);
  assert.equal(canRemindAgain(new Date(2026, 8, 22).toISOString(), now), false);
  assert.equal(canRemindAgain(new Date(2026, 8, 19).toISOString(), now), true);

  const target = topOverdue([
    { id: 'a', name: 'A', amount: 5000, days: 4 },
    { id: 'b', name: 'B', amount: 100, days: 40 },
    { id: 'c', name: 'C', amount: 0, days: 90 },
  ]);
  assert.equal(target?.id, 'b');
  assert.equal(topOverdue([]), null);

  const at = collectFireTime(11, new Date(2026, 8, 23, 15, 0));
  assert.equal(at.getDate(), 24);
  assert.equal(at.getHours(), 11);
});

test('every new line is written in both languages', () => {
  for (const dictionary of [en, ne]) {
    for (const key of ['question', 'cardTitle', 'cardOn', 'cardOff', 'shopDay', 'personalDay', 'quietDay', 'streak', 'coins', 'pushTitle', 'pushGeneric']) {
      assert.ok(dictionary.pekka.close[key]?.length, `close.${key}`);
    }
    for (const key of ['button', 'sales', 'income', 'expense', 'footer', 'quiet']) {
      assert.ok(dictionary.pekka.share[key]?.length, `share.${key}`);
    }
    for (const key of ['button', 'message', 'whatsapp', 'noPhone', 'pushTitle', 'pushBody']) {
      assert.ok(dictionary.pekka.collect[key]?.length, `collect.${key}`);
    }
    assert.ok(dictionary.pekka.morning.streak?.length);
  }
});
