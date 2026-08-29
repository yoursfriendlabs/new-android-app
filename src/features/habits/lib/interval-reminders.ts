import { Platform } from 'react-native';

import {
  clampIntervalMinutes,
  nativeRemindersAvailable,
  type IntervalHabit,
} from '@/src/features/habits/lib/interval-habits';

export {
  CUSTOM_INTERVAL_CHIPS,
  INTERVAL_TEMPLATES,
  canCheckIn,
  clampIntervalMinutes,
  formatInterval,
  intervalCheckInBucket,
  makeIntervalHabit,
  nativeRemindersAvailable,
  type IntervalHabit,
  type IntervalKind,
  type IntervalTemplate,
} from '@/src/features/habits/lib/interval-habits';

type NotificationsModule = {
  AndroidImportance: { DEFAULT: number };
  IosAuthorizationStatus: { PROVISIONAL: number };
  SchedulableTriggerInputTypes: { TIME_INTERVAL: string; DATE: string };
  setNotificationHandler: (handler: {
    handleNotification: () => Promise<{
      shouldShowAlert: boolean;
      shouldPlaySound: boolean;
      shouldSetBadge: boolean;
      shouldShowBanner: boolean;
      shouldShowList: boolean;
    }>;
  }) => void;
  setNotificationChannelAsync: (id: string, options: Record<string, unknown>) => Promise<unknown>;
  getPermissionsAsync: () => Promise<{ granted?: boolean; ios?: { status?: number } }>;
  requestPermissionsAsync: () => Promise<{ granted?: boolean; ios?: { status?: number } }>;
  cancelScheduledNotificationAsync: (id: string) => Promise<unknown>;
  scheduleNotificationAsync: (options: Record<string, unknown>) => Promise<string>;
};

let notificationsModule: NotificationsModule | null | undefined;

function notifications(): NotificationsModule | null {
  if (notificationsModule !== undefined) return notificationsModule;
  if (!nativeRemindersAvailable()) {
    notificationsModule = null;
    return null;
  }
  try {
    // Expo Go throws if this package is imported. Never load it there.
    notificationsModule = require('expo-notifications') as NotificationsModule;
    return notificationsModule;
  } catch {
    notificationsModule = null;
    return null;
  }
}

export function configureReminderNotifications() {
  const Notifications = notifications();
  if (!Notifications) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

async function ensureChannel() {
  const Notifications = notifications();
  if (!Notifications || Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('habits', {
    name: 'Reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 180, 80, 180],
  });
}

export async function requestReminderPermission() {
  const Notifications = notifications();
  if (!Notifications) return false;
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted || current.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
      return true;
    }
    const next = await Notifications.requestPermissionsAsync();
    return Boolean(next.granted || next.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL);
  } catch {
    return false;
  }
}

export async function cancelReminderNotification(identifier?: string | null) {
  const Notifications = notifications();
  if (!Notifications || !identifier) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(identifier);
  } catch {
    // Native module may be missing until a rebuild.
  }
}

export async function scheduleIntervalNotification(habit: IntervalHabit) {
  if (!habit.enabled) {
    return { ...habit, notificationId: null };
  }

  const Notifications = notifications();
  if (!Notifications) {
    return { ...habit, notificationId: null };
  }

  const allowed = await requestReminderPermission();
  if (!allowed) {
    return { ...habit, notificationId: null };
  }

  await ensureChannel();
  await cancelReminderNotification(habit.notificationId || habit.id);

  const seconds = Math.max(60, clampIntervalMinutes(habit.intervalMinutes) * 60);
  const identifier = habit.id;

  try {
    await Notifications.scheduleNotificationAsync({
      identifier,
      content: {
        title: habit.title,
        body: habit.message,
        sound: true,
        ...(Platform.OS === 'android' ? { channelId: 'habits' } : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds,
        repeats: true,
      },
    });
    return { ...habit, notificationId: identifier };
  } catch {
    return { ...habit, notificationId: null };
  }
}

export async function scheduleOneShotReminder(options: {
  title: string;
  body?: string;
  minutes: number;
}) {
  const Notifications = notifications();
  if (!Notifications) return null;
  const allowed = await requestReminderPermission();
  if (!allowed) return null;
  await ensureChannel();
  const seconds = Math.max(15, Math.round(options.minutes) * 60);
  try {
    return await Notifications.scheduleNotificationAsync({
      content: {
        title: options.title,
        body: options.body || 'Time for your reminder.',
        sound: true,
        ...(Platform.OS === 'android' ? { channelId: 'habits' } : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds,
        repeats: false,
      },
    });
  } catch {
    return null;
  }
}

export async function scheduleExactReminder(options: {
  id: string;
  title: string;
  body?: string;
  at: Date;
}) {
  const Notifications = notifications();
  if (!Notifications) return false;
  const when = options.at.getTime();
  if (!Number.isFinite(when) || when <= Date.now() + 3000) return false;
  const allowed = await requestReminderPermission();
  if (!allowed) return false;
  await ensureChannel();
  await cancelReminderNotification(options.id);
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: options.id,
      content: {
        title: options.title,
        body: options.body || 'Time for your reminder.',
        sound: true,
        ...(Platform.OS === 'android' ? { channelId: 'habits' } : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: options.at,
      },
    });
    return true;
  } catch {
    try {
      const seconds = Math.max(15, Math.round((when - Date.now()) / 1000));
      await Notifications.scheduleNotificationAsync({
        identifier: options.id,
        content: {
          title: options.title,
          body: options.body || 'Time for your reminder.',
          sound: true,
          ...(Platform.OS === 'android' ? { channelId: 'habits' } : {}),
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds,
          repeats: false,
        },
      });
      return true;
    } catch {
      return false;
    }
  }
}

export async function rescheduleEnabledHabits(habits: IntervalHabit[]) {
  const next: IntervalHabit[] = [];
  for (const habit of habits) {
    if (!habit.enabled) {
      await cancelReminderNotification(habit.notificationId || habit.id);
      next.push({ ...habit, notificationId: null });
      continue;
    }
    next.push(await scheduleIntervalNotification(habit));
  }
  return next;
}
