import { cancelReminderNotification, reminderPermissionGranted, scheduleExactReminder } from '@/src/features/habits/lib/interval-reminders';

import { DAY_CLOSE_DAYS_AHEAD, DAY_CLOSE_ID_PREFIX, dayCloseFireTimes, type DayCloseSettings } from './day-close';

// Loaded only through dynamic import, so expo-notifications never loads in Expo Go.

export const DAY_CLOSE_URL = '/(app)/(tabs)/home';

export function isDayCloseNotification(id: string) {
  return id.startsWith(DAY_CLOSE_ID_PREFIX);
}

export async function cancelDayCloseNotifications() {
  for (let index = 0; index < DAY_CLOSE_DAYS_AHEAD; index += 1) {
    await cancelReminderNotification(`${DAY_CLOSE_ID_PREFIX}${index}`);
  }
}

/** Books the next week of evenings: the first with numbers, the rest a simple invite. */
export async function scheduleDayCloseNotifications(options: {
  settings: DayCloseSettings;
  title: string;
  firstBody: string;
  laterBody: string;
}) {
  if (!options.settings.enabled || !(await reminderPermissionGranted())) {
    await cancelDayCloseNotifications();
    return false;
  }
  for (const [index, at] of dayCloseFireTimes(options.settings).entries()) {
    await scheduleExactReminder({
      id: `${DAY_CLOSE_ID_PREFIX}${index}`,
      title: options.title,
      body: index === 0 ? options.firstBody : options.laterBody,
      at,
      url: DAY_CLOSE_URL,
    });
  }
  return true;
}
