/**
 * Shared clock work for Pekka's booked moments — the morning summary and the
 * evening day-close. Both are one-a-day notifications the phone books a week
 * ahead, so they behave the same way and only differ in wording and time.
 */

export interface PekkaScheduleSettings {
  enabled: boolean;
  hour: number;
  minute: number;
}

/** A week is booked at a time: enough to survive a quiet week, short enough to go stale. */
export const SCHEDULE_DAYS_AHEAD = 7;

export function normalizeSchedule(
  value: Partial<PekkaScheduleSettings> | null | undefined,
  fallback: PekkaScheduleSettings,
): PekkaScheduleSettings {
  const hour = Math.round(Number(value?.hour));
  const minute = Math.round(Number(value?.minute));
  return {
    enabled: Boolean(value?.enabled),
    hour: Number.isFinite(hour) ? Math.min(23, Math.max(0, hour)) : fallback.hour,
    minute: Number.isFinite(minute) ? Math.min(59, Math.max(0, minute)) : fallback.minute,
  };
}

/** The next `count` days at the chosen time, starting tomorrow if today's has passed. */
export function scheduleFireTimes(
  settings: PekkaScheduleSettings,
  from = new Date(),
  count = SCHEDULE_DAYS_AHEAD,
): Date[] {
  const first = new Date(from);
  first.setHours(settings.hour, settings.minute, 0, 0);
  if (first.getTime() <= from.getTime() + 60_000) first.setDate(first.getDate() + 1);
  return Array.from({ length: count }, (_, index) => {
    const at = new Date(first);
    at.setDate(first.getDate() + index);
    return at;
  });
}
