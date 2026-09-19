import test from 'node:test';
import assert from 'node:assert/strict';

import { reminderTargetUrl } from '../src/features/habits/lib/reminder-links.ts';
import { dailyReminderDueNow, nextDailyFireAt } from '../src/features/habits/lib/daily-money-reminder.ts';

test('tapping a note reminder opens that note', () => {
  assert.equal(reminderTargetUrl('note:9f2c-11'), '/tasks/detail?id=9f2c-11&scope=note');
});

test('a reminder saved before the server replied opens the notes list', () => {
  assert.equal(reminderTargetUrl('note:1726740000000'), '/notes');
  assert.equal(reminderTargetUrl(undefined), '/notes');
});

test('task reminders open the task', () => {
  assert.equal(reminderTargetUrl('task:abc'), '/tasks/detail?id=abc');
});

test('daily money reminder is due once the time has passed and only once per day', () => {
  const reminder = { enabled: true, hour: 20, minute: 0, lastFiredDate: null };
  const evening = new Date(2026, 8, 19, 20, 5);
  const morning = new Date(2026, 8, 19, 9, 0);
  assert.equal(dailyReminderDueNow(reminder, morning, '2026-09-19'), false);
  assert.equal(dailyReminderDueNow(reminder, evening, '2026-09-19'), true);
  assert.equal(dailyReminderDueNow({ ...reminder, lastFiredDate: '2026-09-19' }, evening, '2026-09-19'), false);
  assert.equal(dailyReminderDueNow({ ...reminder, enabled: false }, evening, '2026-09-19'), false);
});

test('next daily fire rolls to tomorrow once today has passed', () => {
  const next = nextDailyFireAt(20, 0, new Date(2026, 8, 19, 21, 0));
  assert.equal(next.getDate(), 20);
  assert.equal(next.getHours(), 20);
  const sameDay = nextDailyFireAt(20, 0, new Date(2026, 8, 19, 8, 0));
  assert.equal(sameDay.getDate(), 19);
});
