import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getActiveWindow,
  getIntervalClaimStatus,
  intervalPingTimes,
  isWithinActiveWindow,
  parseTimeOfDay,
  toTimeOfDay,
} from '../src/features/habits/lib/interval-habits.ts';

function habit(overrides = {}) {
  return {
    id: 'ih_test',
    kind: 'water',
    title: 'Drink water',
    message: 'A glass now.',
    intervalMinutes: 60,
    enabled: true,
    activeFrom: null,
    activeTo: null,
    notificationId: null,
    notificationIds: null,
    lastCheckInAt: null,
    createdAt: new Date('2026-10-01T06:00:00').toISOString(),
    ...overrides,
  };
}

/** A local Date, so the tests read the same clock the helpers do. */
function at(day, hour, minute = 0) {
  return new Date(2026, 9, day, hour, minute, 0, 0);
}

test('parseTimeOfDay only accepts a real clock time', () => {
  assert.equal(parseTimeOfDay('08:00'), 480);
  assert.equal(parseTimeOfDay(' 21:30 '), 21 * 60 + 30);
  assert.equal(parseTimeOfDay('24:00'), null);
  assert.equal(parseTimeOfDay('08:60'), null);
  assert.equal(parseTimeOfDay('8am'), null);
  assert.equal(parseTimeOfDay(null), null);
});

test('toTimeOfDay pads and wraps', () => {
  assert.equal(toTimeOfDay(0), '00:00');
  assert.equal(toTimeOfDay(485), '08:05');
  assert.equal(toTimeOfDay(1440), '00:00');
});

test('a window needs both ends, and two equal ends mean all day', () => {
  assert.equal(getActiveWindow(habit()), null);
  assert.equal(getActiveWindow(habit({ activeFrom: '08:00' })), null);
  assert.equal(getActiveWindow(habit({ activeFrom: '09:00', activeTo: '09:00' })), null);
  assert.deepEqual(getActiveWindow(habit({ activeFrom: '08:00', activeTo: '21:00' })), {
    fromMinutes: 480,
    toMinutes: 1260,
  });
});

test('no window means every hour is inside it', () => {
  assert.equal(isWithinActiveWindow(habit(), at(1, 3)), true);
  assert.equal(isWithinActiveWindow(habit(), at(1, 23, 59)), true);
});

test('a daytime window keeps the night out', () => {
  const day = habit({ activeFrom: '08:00', activeTo: '21:00' });
  assert.equal(isWithinActiveWindow(day, at(1, 7, 59)), false);
  assert.equal(isWithinActiveWindow(day, at(1, 8)), true);
  assert.equal(isWithinActiveWindow(day, at(1, 20, 59)), true);
  assert.equal(isWithinActiveWindow(day, at(1, 21)), false);
});

test('a window through midnight covers both sides of it', () => {
  const night = habit({ activeFrom: '22:00', activeTo: '06:00' });
  assert.equal(isWithinActiveWindow(night, at(1, 21, 59)), false);
  assert.equal(isWithinActiveWindow(night, at(1, 22)), true);
  assert.equal(isWithinActiveWindow(night, at(1, 23, 30)), true);
  assert.equal(isWithinActiveWindow(night, at(2, 2)), true);
  assert.equal(isWithinActiveWindow(night, at(2, 6)), false);
});

test('a turned-off ping is paused and cannot be claimed', () => {
  const status = getIntervalClaimStatus(habit({ enabled: false }), at(1, 10).getTime());
  assert.equal(status.status, 'paused');
  assert.equal(status.canClaim, false);
});

test('outside its hours a ping reports off hours, not missed', () => {
  const status = getIntervalClaimStatus(
    habit({ activeFrom: '08:00', activeTo: '21:00', lastCheckInAt: at(1, 20).toISOString() }),
    at(2, 3).getTime(),
  );
  assert.equal(status.status, 'offHours');
  assert.equal(status.canClaim, false);
  assert.match(status.message, /hours/);
});

test('the first ping after the window opens is claimable, not missed', () => {
  const status = getIntervalClaimStatus(
    habit({ activeFrom: '08:00', activeTo: '21:00', lastCheckInAt: at(1, 20, 30).toISOString() }),
    at(2, 8, 5).getTime(),
  );
  assert.equal(status.status, 'ready');
  assert.equal(status.canClaim, true);
});

test('inside the window the usual wait still applies', () => {
  const status = getIntervalClaimStatus(
    habit({ activeFrom: '08:00', activeTo: '21:00', lastCheckInAt: at(1, 10).toISOString() }),
    at(1, 10, 5).getTime(),
  );
  assert.equal(status.status, 'waiting');
  assert.equal(status.canClaim, false);
});

test('no window books no one-shot pings — the repeating timer handles it', () => {
  assert.deepEqual(intervalPingTimes(habit(), { from: at(1, 9) }), []);
});

test('ping times land inside the window, on the interval, and stop at its end', () => {
  const times = intervalPingTimes(
    habit({ intervalMinutes: 180, activeFrom: '08:00', activeTo: '20:00' }),
    { from: at(1, 9), horizonHours: 24, limit: 50 },
  );

  assert.ok(times.length > 0);
  for (const time of times) {
    const minutes = time.getHours() * 60 + time.getMinutes();
    assert.ok(minutes >= 480 && minutes <= 1200, `${time} fell outside 08:00–20:00`);
    assert.ok(time.getTime() > at(1, 9).getTime(), `${time} is in the past`);
    assert.equal(minutes % 180, 480 % 180, `${time} is off the 3 hour step`);
  }

  // Today's remaining pings, then tomorrow's, in order.
  assert.deepEqual(
    times.slice(0, 3).map((time) => `${time.getDate()}@${time.getHours()}`),
    ['1@11', '1@14', '1@17'],
  );
});

test('an overnight window books pings across midnight', () => {
  const times = intervalPingTimes(
    habit({ intervalMinutes: 120, activeFrom: '22:00', activeTo: '04:00' }),
    { from: at(1, 21), horizonHours: 12, limit: 50 },
  );

  const stamps = times.map((time) => `${time.getDate()}@${time.getHours()}`);
  assert.deepEqual(stamps, ['1@22', '2@0', '2@2', '2@4']);
});

test('the ping list respects its limit', () => {
  const times = intervalPingTimes(
    habit({ intervalMinutes: 15, activeFrom: '00:00', activeTo: '23:45' }),
    { from: at(1, 1), horizonHours: 48, limit: 10 },
  );
  assert.equal(times.length, 10);
});
