import { Platform } from 'react-native';

import {
  clampIntervalMinutes,
  getActiveWindow,
  intervalPingTimes,
  type IntervalHabit,
} from '@/src/features/habits/lib/interval-habits';
import { nativeRemindersAvailable } from '@/src/features/habits/lib/native-reminders';
import { reminderTargetUrl } from '@/src/features/habits/lib/reminder-links';

export {
  CUSTOM_INTERVAL_CHIPS,
  INTERVAL_TEMPLATES,
  canCheckIn,
  clampIntervalMinutes,
  formatActiveWindow,
  formatInterval,
  getActiveWindow,
  intervalCheckInBucket,
  intervalPingTimes,
  isWithinActiveWindow,
  makeIntervalHabit,
  type IntervalHabit,
  type IntervalKind,
  type IntervalTemplate,
} from '@/src/features/habits/lib/interval-habits';
export { nativeRemindersAvailable } from '@/src/features/habits/lib/native-reminders';

type NotificationsModule = {
  AndroidImportance: { DEFAULT: number };
  IosAuthorizationStatus: { PROVISIONAL: number };
  SchedulableTriggerInputTypes: { TIME_INTERVAL: string; DATE: string; DAILY?: string; CALENDAR?: string };
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
  cancelAllScheduledNotificationsAsync: () => Promise<void>;
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

/** Checks without asking, for work that runs while the app is closing. */
export async function reminderPermissionGranted() {
  const Notifications = notifications();
  if (!Notifications) return false;
  try {
    const current = await Notifications.getPermissionsAsync();
    return Boolean(current.granted || current.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL);
  } catch {
    return false;
  }
}

/** Clears every reminder on this phone, e.g. after the account is deleted. */
export async function cancelAllReminderNotifications() {
  const Notifications = notifications();
  if (!Notifications) return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // Native module may be missing until a rebuild.
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

/** Clears every ping this habit has on the phone, single or windowed. */
export async function cancelIntervalNotifications(habit: IntervalHabit) {
  await cancelReminderNotification(habit.notificationId || habit.id);
  for (const id of habit.notificationIds ?? []) {
    await cancelReminderNotification(id);
  }
}

/** How far ahead windowed pings are booked, and how many at most. */
const WINDOW_HORIZON_HOURS = 48;
const WINDOW_PING_LIMIT = 48;

export async function scheduleIntervalNotification(habit: IntervalHabit) {
  const cleared = { ...habit, notificationId: null, notificationIds: null };
  if (!habit.enabled) {
    return cleared;
  }

  const Notifications = notifications();
  if (!Notifications) {
    return cleared;
  }

  const allowed = await requestReminderPermission();
  if (!allowed) {
    return cleared;
  }

  await ensureChannel();
  await cancelIntervalNotifications(habit);

  const content = {
    title: habit.title,
    body: habit.message,
    sound: true,
    data: {
      url: '/notes',
      habitId: habit.id,
      kind: habit.kind,
    },
    ...(Platform.OS === 'android' ? { channelId: 'habits' } : {}),
  };

  // Chosen hours cannot be expressed as one repeating timer, so the pings
  // inside the window are booked one by one and topped up on each app start.
  if (getActiveWindow(habit)) {
    const times = intervalPingTimes(habit, {
      horizonHours: WINDOW_HORIZON_HOURS,
      limit: WINDOW_PING_LIMIT,
    });
    const notificationIds: string[] = [];
    for (let index = 0; index < times.length; index += 1) {
      const identifier = `${habit.id}#${index}`;
      try {
        await Notifications.scheduleNotificationAsync({
          identifier,
          content,
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: times[index],
          },
        });
        notificationIds.push(identifier);
      } catch {
        // Native module may be missing until a rebuild.
      }
    }
    return { ...habit, notificationId: null, notificationIds: notificationIds.length ? notificationIds : null };
  }

  const seconds = Math.max(60, clampIntervalMinutes(habit.intervalMinutes) * 60);
  const identifier = habit.id;

  try {
    await Notifications.scheduleNotificationAsync({
      identifier,
      content,
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds,
        repeats: true,
      },
    });
    return { ...habit, notificationId: identifier, notificationIds: null };
  } catch {
    return cleared;
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
        data: {
          url: '/notes',
        },
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
  url?: string;
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
        data: {
          url: options.url ?? reminderTargetUrl(options.id),
          reminderId: options.id,
        },
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
          data: {
            url: options.url ?? reminderTargetUrl(options.id),
            reminderId: options.id,
          },
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

export async function scheduleDailyReminder(options: {
  id: string;
  title: string;
  body?: string;
  hour: number;
  minute: number;
  url?: string;
}) {
  const Notifications = notifications();
  if (!Notifications) return false;
  const allowed = await requestReminderPermission();
  if (!allowed) return false;
  await ensureChannel();
  await cancelReminderNotification(options.id);

  const content = {
    title: options.title,
    body: options.body || 'Time for your reminder.',
    sound: true,
    data: { url: options.url ?? '/notes', reminderId: options.id },
    ...(Platform.OS === 'android' ? { channelId: 'habits' } : {}),
  };

  const dailyType = Notifications.SchedulableTriggerInputTypes.DAILY;
  if (dailyType) {
    try {
      await Notifications.scheduleNotificationAsync({
        identifier: options.id,
        content,
        trigger: {
          type: dailyType,
          hour: options.hour,
          minute: options.minute,
        },
      });
      return true;
    } catch {
      // Fall through to a calendar or one-shot trigger.
    }
  }

  const calendarType = Notifications.SchedulableTriggerInputTypes.CALENDAR;
  if (calendarType) {
    try {
      await Notifications.scheduleNotificationAsync({
        identifier: options.id,
        content,
        trigger: {
          type: calendarType,
          hour: options.hour,
          minute: options.minute,
          repeats: true,
        },
      });
      return true;
    } catch {
      // Fall through to the next occurrence.
    }
  }

  const next = new Date();
  next.setHours(options.hour, options.minute, 0, 0);
  if (next.getTime() <= Date.now() + 3000) {
    next.setDate(next.getDate() + 1);
  }
  return scheduleExactReminder({
    id: options.id,
    title: options.title,
    body: options.body,
    at: next,
    url: options.url,
  });
}

export async function rescheduleEnabledHabits(habits: IntervalHabit[]) {
  const next: IntervalHabit[] = [];
  for (const habit of habits) {
    if (!habit.enabled) {
      await cancelIntervalNotifications(habit);
      next.push({ ...habit, notificationId: null, notificationIds: null });
      continue;
    }
    next.push(await scheduleIntervalNotification(habit));
  }
  return next;
}
