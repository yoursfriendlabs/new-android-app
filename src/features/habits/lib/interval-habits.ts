import type { ComponentProps } from 'react';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
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
  notificationId: string | null;
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

export function nativeRemindersAvailable() {
  if (Platform.OS === 'web') return false;
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return false;
  if (Constants.appOwnership === 'expo') return false;
  return true;
}

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

export function intervalCheckInBucket(habit: Pick<IntervalHabit, 'id' | 'intervalMinutes'>) {
  const windowMs = Math.max(60_000, clampIntervalMinutes(habit.intervalMinutes) * 60_000);
  return `checkin:${habit.id}:${Math.floor(Date.now() / windowMs)}`;
}

export type IntervalStatusKind = 'ready' | 'waiting' | 'missed' | 'paused';

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

  const cycleMs = clampIntervalMinutes(habit.intervalMinutes) * 60_000;
  const lastTime = habit.lastCheckInAt
    ? new Date(habit.lastCheckInAt).getTime()
    : new Date(habit.createdAt).getTime();
  const elapsed = Math.max(0, now - lastTime);

  const minWaitMs = Math.max(45_000, cycleMs * 0.35);
  const maxWindowMs = cycleMs * 1.6;

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
}): IntervalHabit {
  const template = ALL_INTERVAL_TEMPLATES.find((item) => item.kind === input.kind);
  return {
    id: `ih_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    kind: input.kind,
    title: input.title.trim() || template?.title || 'Reminder',
    message: (input.message || template?.message || 'Time for a quick check-in.').trim(),
    intervalMinutes: clampIntervalMinutes(input.intervalMinutes),
    enabled: true,
    notificationId: null,
    lastCheckInAt: null,
    createdAt: new Date().toISOString(),
  };
}
