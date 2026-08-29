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

export function canCheckIn(habit: IntervalHabit, now = Date.now()) {
  if (!habit.lastCheckInAt) return true;
  const elapsed = now - new Date(habit.lastCheckInAt).getTime();
  const wait = Math.max(45_000, clampIntervalMinutes(habit.intervalMinutes) * 60_000 * 0.35);
  return elapsed >= wait;
}

export function makeIntervalHabit(input: {
  kind: IntervalKind;
  title: string;
  message?: string;
  intervalMinutes: number;
}): IntervalHabit {
  const template = INTERVAL_TEMPLATES.find((item) => item.kind === input.kind);
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
