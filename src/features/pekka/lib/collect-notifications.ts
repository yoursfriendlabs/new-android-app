import { cancelReminderNotification, reminderPermissionGranted, scheduleExactReminder } from '@/src/features/habits/lib/interval-reminders';

import { COLLECT_ID_PREFIX, collectFireTime } from './collect';

// Loaded only through dynamic import, so expo-notifications never loads in Expo Go.

export const COLLECT_URL = '/(app)/(tabs)/parties';
export const COLLECT_ID = `${COLLECT_ID_PREFIX}0`;

export function isCollectNotification(id: string) {
  return id.startsWith(COLLECT_ID_PREFIX);
}

export async function cancelCollectNotification() {
  await cancelReminderNotification(COLLECT_ID);
}

/** One reminder about the person who has owed the longest. */
export async function scheduleCollectNotification(options: { title: string; body: string; hour: number }) {
  if (!(await reminderPermissionGranted())) {
    await cancelCollectNotification();
    return false;
  }
  await scheduleExactReminder({
    id: COLLECT_ID,
    title: options.title,
    body: options.body,
    at: collectFireTime(options.hour),
    url: COLLECT_URL,
  });
  return true;
}
