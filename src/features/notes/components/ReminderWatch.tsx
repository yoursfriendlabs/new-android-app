import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';

import { notesApi } from '@/src/api';
import { extractListItems, normalizeNote } from '@/src/api/normalize';

import { DAILY_MONEY_REMINDER_COPY, dailyReminderDueNow } from '@/src/features/habits/lib/daily-money-reminder';
import { useToast } from '@/src/shared/feedback/ToastProvider';
import { nativeRemindersAvailable } from '@/src/features/habits/lib/interval-habits';
import { MORNING_ID_PREFIX } from '@/src/features/pekka/lib/morning';
import { usePekkaStore } from '@/src/features/pekka/stores/pekka-store';
import { isPersonalWorkspace } from '@/src/shared/lib/business';
import { useAuthStore } from '@/src/stores/auth-store';
import { useHabitStore } from '@/src/stores/habit-store';
import { useLanguageStore } from '@/src/stores/language-store';
import type { Note } from '@/src/types/models';

export function ReminderWatch() {
  const toast = useToast();
  const pings = useHabitStore((state) => state.scheduledPings);
  const dailyReminder = useHabitStore((state) => state.dailyMoneyReminder);
  const businessType = useAuthStore((state) => state.businessProfile?.businessType ?? state.businessProfile?.type);
  const personal = isPersonalWorkspace({ businessType: String(businessType ?? '') });
  const signedIn = useAuthStore((state) => state.status === 'signed-in');
  const businessId = useAuthStore((state) => state.session?.businessId ?? '');
  const habitsReady = useHabitStore((state) => state.status === 'ready');

  // Reminders live on the server, but alarms live on this phone. After a reinstall or on a
  // second phone, re-arm every upcoming reminder the phone does not know about yet.
  useEffect(() => {
    // Wait for saved pings to load, or scheduling would overwrite them.
    if (!signedIn || !businessId || !habitsReady || !nativeRemindersAvailable()) return;
    let cancelled = false;
    void (async () => {
      try {
        const response = await notesApi.list({ kind: 'reminder', status: 'open', limit: 100 });
        const notes = extractListItems<Note>(response).map(normalizeNote);
        const known = new Map(useHabitStore.getState().scheduledPings.map((ping) => [ping.id, ping]));
        for (const note of notes) {
          if (cancelled) return;
          const at = note.remindAt ? new Date(note.remindAt) : null;
          if (!note.id || !at || Number.isNaN(at.getTime()) || at.getTime() <= Date.now()) continue;
          const id = `note:${note.id}`;
          const existing = known.get(id);
          if (existing && new Date(existing.at).getTime() === at.getTime()) continue;
          await useHabitStore.getState().schedulePing({
            id,
            title: note.title,
            body: note.body?.trim() || note.title,
            at: at.toISOString(),
            native: true,
          });
        }
      } catch {
        // Offline or older server: the reminders scheduled on this phone still fire.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [businessId, habitsReady, signedIn]);

  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      for (const ping of useHabitStore.getState().scheduledPings) {
        if (ping.fired) continue;
        const at = new Date(ping.at).getTime();
        if (!Number.isFinite(at) || at > now) continue;
        void useHabitStore.getState().markPingFired(ping.id);
        // The phone already showed this one as a notification.
        if (ping.native) continue;
        try {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        } catch {
          // Optional.
        }
        toast.info(ping.title ? `${ping.title}: ${ping.body}` : ping.body || 'Time for your reminder.');
      }
    };

    tick();
    const timer = setInterval(tick, 12_000);
    return () => clearInterval(timer);
  }, [pings, toast]);

  useEffect(() => {
    // With a native build the daily nudge arrives as a real notification; the toast is the Expo Go stand-in.
    if (!personal || !dailyReminder.enabled || nativeRemindersAvailable()) return;

    const tick = () => {
      if (!dailyReminderDueNow(useHabitStore.getState().dailyMoneyReminder)) return;
      void useHabitStore.getState().markDailyReminderFired();
      try {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } catch {
        // Optional.
      }
      const isNe = useLanguageStore.getState().language === 'ne';
      const body = isNe
        ? 'कृपया भविष्यको विवरणका लागि आफ्ना आम्दानी, खर्च र कारोबारहरू दर्ता गर्नुहोस्।'
        : DAILY_MONEY_REMINDER_COPY.body;
      toast.info(body, { duration: 6000 });
    };

    tick();
    const timer = setInterval(tick, 12_000);
    return () => clearInterval(timer);
  }, [dailyReminder.enabled, dailyReminder.hour, dailyReminder.lastFiredDate, dailyReminder.minute, personal]);

  useEffect(() => {
    if (!nativeRemindersAvailable()) return;

    let sub: { remove: () => void } | null = null;
    let cancelled = false;
    const handled = new Set<string>();

    const open = (response: any) => {
      const request = response?.notification?.request;
      const key = `${request?.identifier ?? ''}:${response?.notification?.date ?? ''}`;
      if (handled.has(key)) return;
      handled.add(key);
      const data = request?.content?.data;
      const reminderId = typeof data?.reminderId === 'string' ? data.reminderId : '';
      // Pekka's morning summary opens Pekka itself, not a saved reminder.
      const pekkaMorning = reminderId.startsWith(MORNING_ID_PREFIX);
      if (reminderId && !pekkaMorning) void useHabitStore.getState().markPingFired(reminderId);
      const targetUrl = typeof data?.url === 'string' && data.url ? data.url : '/notes';
      try {
        const { router } = require('expo-router');
        router.push(targetUrl);
        if (pekkaMorning) usePekkaStore.getState().openBrief();
      } catch {
        // Navigation fallback
      }
    };

    try {
      // Lazy load expo-notifications to prevent Expo Go crashes
      const Notifications = require('expo-notifications');
      sub = Notifications.addNotificationResponseReceivedListener(open);
      // A tap that launched the app from closed arrives before this listener exists.
      void Notifications.getLastNotificationResponseAsync?.()
        .then((response: any) => {
          if (cancelled || !response) return;
          Notifications.clearLastNotificationResponseAsync?.();
          // Wait for sign-in to settle so the auth redirect does not overwrite this navigation.
          const openWhenSignedIn = () => {
            if (useAuthStore.getState().status !== 'signed-in') return false;
            setTimeout(() => open(response), 300);
            return true;
          };
          if (openWhenSignedIn()) return;
          const unsubscribe = useAuthStore.subscribe(() => {
            if (cancelled || openWhenSignedIn()) unsubscribe();
          });
        })
        .catch(() => undefined);
    } catch {
      // Native module unavailable in Expo Go
    }

    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, []);

  return null;
}
