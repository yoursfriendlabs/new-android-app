import { todayIso } from '@/src/shared/lib/format';

export const DAILY_MONEY_REMINDER_ID = 'personal-daily-money';

export const DAILY_MONEY_REMINDER_COPY = {
  title: 'Daily Reminder: Record Transactions',
  body: 'Please record your transactions, expenses, and other details for future reference.',
};

export interface DailyMoneyReminderSettings {
  enabled: boolean;
  hour: number;
  minute: number;
  lastFiredDate: string | null;
}

export const DEFAULT_DAILY_MONEY_REMINDER: DailyMoneyReminderSettings = {
  enabled: false,
  hour: 20,
  minute: 0,
  lastFiredDate: null,
};

export const DAILY_REMINDER_CHIPS = [
  { label: '8:00 AM', hour: 8, minute: 0 },
  { label: '12:00 PM', hour: 12, minute: 0 },
  { label: '8:00 PM', hour: 20, minute: 0 },
  { label: '9:00 PM', hour: 21, minute: 0 },
];

export function clampClockHour(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_DAILY_MONEY_REMINDER.hour;
  return Math.min(23, Math.max(0, Math.round(value)));
}

export function clampClockMinute(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(59, Math.max(0, Math.round(value)));
}

export function normalizeDailyMoneyReminder(
  value?: Partial<DailyMoneyReminderSettings> | null,
): DailyMoneyReminderSettings {
  return {
    enabled: Boolean(value?.enabled),
    hour: clampClockHour(Number(value?.hour)),
    minute: clampClockMinute(Number(value?.minute)),
    lastFiredDate: value?.lastFiredDate ? String(value.lastFiredDate).slice(0, 10) : null,
  };
}

export function formatClockTime(hour: number, minute: number) {
  const date = new Date();
  date.setHours(clampClockHour(hour), clampClockMinute(minute), 0, 0);
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function nextDailyFireAt(hour: number, minute: number, from = new Date()) {
  const next = new Date(from);
  next.setHours(clampClockHour(hour), clampClockMinute(minute), 0, 0);
  if (next.getTime() <= from.getTime() + 3000) {
    next.setDate(next.getDate() + 1);
  }
  return next;
}

export function dailyReminderDueNow(
  reminder: DailyMoneyReminderSettings,
  now = new Date(),
  today = todayIso(),
) {
  if (!reminder.enabled) return false;
  if (reminder.lastFiredDate === today) return false;
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  const minutesDue = clampClockHour(reminder.hour) * 60 + clampClockMinute(reminder.minute);
  return minutesNow >= minutesDue;
}
