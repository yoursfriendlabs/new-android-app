import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { Alert } from 'react-native';

import { DAILY_MONEY_REMINDER_COPY, dailyReminderDueNow } from '@/src/features/habits/lib/daily-money-reminder';
import { nativeRemindersAvailable } from '@/src/features/habits/lib/interval-habits';
import { isPersonalWorkspace } from '@/src/shared/lib/business';
import { useAuthStore } from '@/src/stores/auth-store';
import { useHabitStore } from '@/src/stores/habit-store';
import { useLanguageStore } from '@/src/stores/language-store';

export function ReminderWatch() {
  const pings = useHabitStore((state) => state.scheduledPings);
  const dailyReminder = useHabitStore((state) => state.dailyMoneyReminder);
  const businessType = useAuthStore((state) => state.businessProfile?.businessType ?? state.businessProfile?.type);
  const personal = isPersonalWorkspace({ businessType: String(businessType ?? '') });

  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      for (const ping of useHabitStore.getState().scheduledPings) {
        if (ping.fired) continue;
        const at = new Date(ping.at).getTime();
        if (!Number.isFinite(at) || at > now) continue;
        void useHabitStore.getState().markPingFired(ping.id);
        try {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        } catch {
          // Optional.
        }
        Alert.alert(ping.title, ping.body || 'Time for your reminder.');
      }
    };

    tick();
    const timer = setInterval(tick, 12_000);
    return () => clearInterval(timer);
  }, [pings]);

  useEffect(() => {
    if (!personal || !dailyReminder.enabled) return;

    const tick = () => {
      if (!dailyReminderDueNow(useHabitStore.getState().dailyMoneyReminder)) return;
      void useHabitStore.getState().markDailyReminderFired();
      try {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } catch {
        // Optional.
      }
      const isNe = useLanguageStore.getState().language === 'ne';
      const title = isNe ? 'दैनिक हिसाब सम्झाउनी' : DAILY_MONEY_REMINDER_COPY.title;
      const body = isNe ? 'कृपया भविष्यको विवरणका लागि आफ्ना आम्दानी, खर्च र कारोबारहरू दर्ता गर्नुहोस्।' : DAILY_MONEY_REMINDER_COPY.body;
      Alert.alert(title, body);
    };

    tick();
    const timer = setInterval(tick, 12_000);
    return () => clearInterval(timer);
  }, [dailyReminder.enabled, dailyReminder.hour, dailyReminder.lastFiredDate, dailyReminder.minute, personal]);

  useEffect(() => {
    if (!nativeRemindersAvailable()) return;

    let sub: { remove: () => void } | null = null;
    try {
      // Lazy load expo-notifications to prevent Expo Go crashes
      const Notifications = require('expo-notifications');
      sub = Notifications.addNotificationResponseReceivedListener((response: any) => {
        const data = response?.notification?.request?.content?.data;
        const targetUrl = data?.url || '/(app)/tasks/inbox';
        try {
          const { router } = require('expo-router');
          router.push(targetUrl);
        } catch {
          // Navigation fallback
        }
      });
    } catch {
      // Native module unavailable in Expo Go
    }

    return () => {
      sub?.remove();
    };
  }, []);

  return null;
}
