import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { Alert } from 'react-native';

import { useHabitStore } from '@/src/stores/habit-store';

export function ReminderWatch() {
  const pings = useHabitStore((state) => state.scheduledPings);

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

  return null;
}
