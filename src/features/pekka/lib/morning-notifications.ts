import {
  cancelReminderNotification,
  reminderPermissionGranted,
  scheduleExactReminder,
} from '@/src/features/habits/lib/interval-reminders';

import { MORNING_DAYS_AHEAD, MORNING_ID_PREFIX, morningFireTimes, type MorningSettings } from './morning';

// Loaded only through dynamic import, so expo-notifications never loads in Expo Go.

export const MORNING_URL = '/(app)/(tabs)/home';

export function isMorningNotification(id: string) {
  return id.startsWith(MORNING_ID_PREFIX);
}

export async function cancelMorningNotifications() {
  for (let index = 0; index < MORNING_DAYS_AHEAD; index += 1) {
    await cancelReminderNotification(`${MORNING_ID_PREFIX}${index}`);
  }
}

/** Books the next week of mornings: the first with numbers, the rest a simple invite. */
export async function scheduleMorningNotifications(options: {
  settings: MorningSettings;
  title: string;
  firstBody: string;
  laterBody: string;
}) {
  if (!options.settings.enabled || !(await reminderPermissionGranted())) {
    await cancelMorningNotifications();
    return false;
  }
  const times = morningFireTimes(options.settings);
  for (const [index, at] of times.entries()) {
    await scheduleExactReminder({
      id: `${MORNING_ID_PREFIX}${index}`,
      title: options.title,
      body: index === 0 ? options.firstBody : options.laterBody,
      at,
      url: MORNING_URL,
    });
  }
  return true;
}
