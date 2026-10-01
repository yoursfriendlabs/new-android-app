import type { ComponentProps } from 'react';
import type MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export type IntervalKind = 'water' | 'focus' | 'relax' | 'custom';

export interface IntervalHabit {
  id: string;
  kind: IntervalKind;
  title: string;
  message: string;
  intervalMinutes: number;
  enabled: boolean;
  /**
   * Clock times ('HH:MM') the pings are allowed between. Leave both unset for
   * all day. A from later than a to means the window runs through midnight.
   */
  activeFrom?: string | null;
  activeTo?: string | null;
  notificationId: string | null;
  /** The one-shot pings a time window is made of, so they can all be cancelled. */
  notificationIds?: string[] | null;
  lastCheckInAt: string | null;
  createdAt: string;
}

export interface IntervalTemplate {
  kind: Exclude<IntervalKind, 'custom'>;
  title: string;
  message: string;
  icon: IconName;
  defaultMinutes: number;
  chips: number[];
}

export const INTERVAL_TEMPLATES: IntervalTemplate[] = [
  {
    kind: 'water',
    title: 'Drink water',
    message: 'A glass now. Your body will thank you.',
    icon: 'cup-water',
    defaultMinutes: 45,
    chips: [20, 30, 45, 60, 90],
  },
  {
    kind: 'focus',
    title: 'Focus',
    message: 'One quiet stretch. Close the loop.',
    icon: 'timer-outline',
    defaultMinutes: 25,
    chips: [15, 25, 50, 90],
  },
  {
    kind: 'relax',
    title: 'Relax',
    message: 'Stand, stretch, look away from the screen.',
    icon: 'meditation',
    defaultMinutes: 90,
    chips: [30, 60, 90, 120],
  },
];

export const CUSTOM_TEMPLATE: IntervalTemplate = {
  kind: 'custom' as any,
  title: 'Custom ping',
  message: 'Time for your scheduled check-in.',
  icon: 'bell-ring-outline',
  defaultMinutes: 60,
  chips: [15, 30, 45, 60, 90, 120, 180],
};

export const ALL_INTERVAL_TEMPLATES: IntervalTemplate[] = [
  ...INTERVAL_TEMPLATES,
  CUSTOM_TEMPLATE,
];

export const CUSTOM_INTERVAL_CHIPS = [15, 30, 45, 60, 90, 120, 180];

const MIN_MINUTES = 1;
const MAX_MINUTES = 12 * 60;

export function clampIntervalMinutes(value: number) {
  if (!Number.isFinite(value)) return 30;
  return Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, Math.round(value)));
}

export function formatInterval(minutes: number) {
  const value = clampIntervalMinutes(minutes);
  if (value < 60) return `every ${value} min`;
  if (value === 60) return 'every hour';
  if (value % 60 === 0) return `every ${value / 60} hours`;
  const hours = Math.floor(value / 60);
  const rest = value % 60;
  return `every ${hours}h ${rest}m`;
}

const DAY_MINUTES = 24 * 60;

export interface ActiveWindow {
  /** Minutes past midnight the window opens. */
  fromMinutes: number;
  /** Minutes past midnight it closes; smaller than fromMinutes when it crosses midnight. */
  toMinutes: number;
}

/** 'HH:MM' to minutes past midnight, or null when there is nothing usable. */
export function parseTimeOfDay(value?: string | null): number | null {
  const match = /^\s*(\d{1,2}):(\d{2})\s*$/.exec(String(value ?? ''));
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}

export function toTimeOfDay(minutes: number): string {
  const total = ((Math.round(minutes) % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  const hour = Math.floor(total / 60);
  const minute = total % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function formatTimeOfDay(value?: string | null): string {
  const minutes = parseTimeOfDay(value);
  if (minutes === null) return '';
  const date = new Date();
  date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/** The habit's hours, or null when it may ping round the clock. */
export function getActiveWindow(habit: Pick<IntervalHabit, 'activeFrom' | 'activeTo'>): ActiveWindow | null {
  const fromMinutes = parseTimeOfDay(habit.activeFrom);
  const toMinutes = parseTimeOfDay(habit.activeTo);
  if (fromMinutes === null || toMinutes === null) return null;
  // Equal ends would leave no room for a single ping, so treat it as all day.
  if (fromMinutes === toMinutes) return null;
  return { fromMinutes, toMinutes };
}

export function formatActiveWindow(habit: Pick<IntervalHabit, 'activeFrom' | 'activeTo'>): string {
  const window = getActiveWindow(habit);
  if (!window) return 'all day';
  return `${formatTimeOfDay(habit.activeFrom)} – ${formatTimeOfDay(habit.activeTo)}`;
}

function minutesIntoDay(date: Date) {
  return date.getHours() * 60 + date.getMinutes();
}

export function isWithinActiveWindow(
  habit: Pick<IntervalHabit, 'activeFrom' | 'activeTo'>,
  at: Date = new Date(),
): boolean {
  const window = getActiveWindow(habit);
  if (!window) return true;
  const now = minutesIntoDay(at);
  if (window.fromMinutes < window.toMinutes) {
    return now >= window.fromMinutes && now < window.toMinutes;
  }
  // Runs through midnight, e.g. 22:00 to 06:00.
  return now >= window.fromMinutes || now < window.toMinutes;
}

/**
 * When the window the habit is currently inside opened, as a timestamp. Null
 * when there is no window, or when the clock is outside it.
 */
export function activeWindowStartedAt(
  habit: Pick<IntervalHabit, 'activeFrom' | 'activeTo'>,
  at: Date = new Date(),
): number | null {
  const window = getActiveWindow(habit);
  if (!window || !isWithinActiveWindow(habit, at)) return null;
  const start = new Date(at);
  start.setHours(Math.floor(window.fromMinutes / 60), window.fromMinutes % 60, 0, 0);
  if (start.getTime() > at.getTime()) {
    // Opened yesterday, on a window that crosses midnight.
    start.setDate(start.getDate() - 1);
  }
  return start.getTime();
}

/**
 * Every moment this habit should ping over the next stretch of time. Used when
 * a window is set, because a plain repeating timer cannot skip the off hours.
 */
export function intervalPingTimes(
  habit: Pick<IntervalHabit, 'intervalMinutes' | 'activeFrom' | 'activeTo'>,
  options: { from?: Date; horizonHours?: number; limit?: number } = {},
): Date[] {
  const window = getActiveWindow(habit);
  if (!window) return [];

  const from = options.from ?? new Date();
  const horizonMs = Math.max(1, options.horizonHours ?? 48) * 3_600_000;
  const limit = Math.max(1, options.limit ?? 48);
  const stepMs = clampIntervalMinutes(habit.intervalMinutes) * 60_000;
  const spanMinutes =
    window.fromMinutes < window.toMinutes
      ? window.toMinutes - window.fromMinutes
      : DAY_MINUTES - window.fromMinutes + window.toMinutes;

  // Far enough ahead that the lock screen is never the thing that goes quiet.
  const earliest = from.getTime() + 60_000;
  const latest = from.getTime() + horizonMs;
  const times: Date[] = [];

  for (let dayOffset = 0; dayOffset <= Math.ceil(horizonMs / 86_400_000) + 1; dayOffset += 1) {
    const open = new Date(from);
    open.setDate(open.getDate() + dayOffset - 1);
    open.setHours(Math.floor(window.fromMinutes / 60), window.fromMinutes % 60, 0, 0);
    const close = open.getTime() + spanMinutes * 60_000;

    for (let at = open.getTime(); at <= close; at += stepMs) {
      if (at < earliest) continue;
      if (at > latest) break;
      times.push(new Date(at));
      if (times.length >= limit) return times;
    }
  }

  return times;
}

export function intervalCheckInBucket(habit: Pick<IntervalHabit, 'id' | 'intervalMinutes'>) {
  const windowMs = Math.max(60_000, clampIntervalMinutes(habit.intervalMinutes) * 60_000);
  return `checkin:${habit.id}:${Math.floor(Date.now() / windowMs)}`;
}

export type IntervalStatusKind = 'ready' | 'waiting' | 'missed' | 'paused' | 'offHours';

export interface IntervalStatusInfo {
  status: IntervalStatusKind;
  canClaim: boolean;
  message: string;
  waitMinutesLeft?: number;
}

export function getIntervalClaimStatus(habit: IntervalHabit, now = Date.now()): IntervalStatusInfo {
  if (!habit.enabled) {
    return {
      status: 'paused',
      canClaim: false,
      message: 'Interval is paused.',
    };
  }

  const at = new Date(now);
  if (!isWithinActiveWindow(habit, at)) {
    return {
      status: 'offHours',
      canClaim: false,
      message: `Outside your chosen hours (${formatActiveWindow(habit)}). Pings start again then.`,
    };
  }

  const cycleMs = clampIntervalMinutes(habit.intervalMinutes) * 60_000;
  const lastTime = habit.lastCheckInAt
    ? new Date(habit.lastCheckInAt).getTime()
    : new Date(habit.createdAt).getTime();
  const elapsed = Math.max(0, now - lastTime);

  const minWaitMs = Math.max(45_000, cycleMs * 0.35);
  const maxWindowMs = cycleMs * 1.6;

  // A check-in from before today's window opened says nothing about this one, so
  // the first ping of the day is always claimable rather than counted as missed.
  const windowStart = activeWindowStartedAt(habit, at);
  if (windowStart !== null && lastTime < windowStart) {
    return {
      status: 'ready',
      canClaim: true,
      message: 'Active check-in window! Check in now to claim your coins.',
    };
  }

  if (elapsed < minWaitMs) {
    const waitMinutesLeft = Math.max(1, Math.ceil((minWaitMs - elapsed) / 60_000));
    return {
      status: 'waiting',
      canClaim: false,
      waitMinutesLeft,
      message: `Next ping soon. Ready in ${waitMinutesLeft} min.`,
    };
  }

  if (elapsed > maxWindowMs && habit.lastCheckInAt !== null) {
    return {
      status: 'missed',
      canClaim: false,
      message: 'You missed the previous notification window. Check-in resets your interval timer for the next ping.',
    };
  }

  return {
    status: 'ready',
    canClaim: true,
    message: 'Active check-in window! Check in now to claim your coins.',
  };
}

export function canCheckIn(habit: IntervalHabit, now = Date.now()) {
  const statusInfo = getIntervalClaimStatus(habit, now);
  return statusInfo.status === 'ready' || statusInfo.status === 'missed';
}

export function makeIntervalHabit(input: {
  kind: IntervalKind;
  title: string;
  message?: string;
  intervalMinutes: number;
  enabled?: boolean;
  activeFrom?: string | null;
  activeTo?: string | null;
}): IntervalHabit {
  const template = ALL_INTERVAL_TEMPLATES.find((item) => item.kind === input.kind);
  return {
    id: `ih_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    kind: input.kind,
    title: input.title.trim() || template?.title || 'Reminder',
    message: (input.message || template?.message || 'Time for a quick check-in.').trim(),
    intervalMinutes: clampIntervalMinutes(input.intervalMinutes),
    enabled: input.enabled ?? true,
    activeFrom: input.activeFrom ?? null,
    activeTo: input.activeTo ?? null,
    notificationId: null,
    notificationIds: null,
    lastCheckInAt: null,
    createdAt: new Date().toISOString(),
  };
}
