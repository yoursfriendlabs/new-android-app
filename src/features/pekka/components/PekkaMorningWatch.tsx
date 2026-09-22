import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { metaApi } from '@/src/api';
import { normalizeDashboardSummary } from '@/src/api/normalize';
import { nativeRemindersAvailable } from '@/src/features/habits/lib/interval-habits';
import { useTranslation } from '@/src/i18n';
import { localIsoDate } from '@/src/shared/lib/format';
import { useAuthStore } from '@/src/stores/auth-store';

import { usePekkaWorkspace } from '../hooks/usePekkaWorkspace';
import { morningNotificationBody } from '../lib/morning';
import { usePekkaStore } from '../stores/pekka-store';

// Closing the app many times an hour should not refetch and rebook every time.
const RESCHEDULE_GAP_MS = 15 * 60_000;

/**
 * Keeps the morning summary booked. Notifications are set on this phone, so
 * the numbers are refreshed each time the app goes to the background.
 */
export function PekkaMorningWatch() {
  const { t } = useTranslation();
  const { isPersonal, currency } = usePekkaWorkspace();
  const signedIn = useAuthStore((state) => state.status === 'signed-in');
  const businessId = useAuthStore((state) => state.session?.businessId ?? '');
  const userName = useAuthStore((state) => state.user?.name?.split(' ')[0] ?? '');
  const morning = usePekkaStore((state) => state.morning);
  const morningReady = usePekkaStore((state) => state.morningReady);

  const latest = useRef({ t, isPersonal, currency, userName });
  latest.current = { t, isPersonal, currency, userName };
  const lastRun = useRef(0);

  useEffect(() => {
    void usePekkaStore.getState().hydrateMorning();
  }, []);

  useEffect(() => {
    if (!morningReady || !nativeRemindersAvailable()) return;
    let cancelled = false;

    const book = async (force: boolean) => {
      if (!force && Date.now() - lastRun.current < RESCHEDULE_GAP_MS) return;
      lastRun.current = Date.now();
      const mod = await import('../lib/morning-notifications');
      if (!signedIn || !businessId || !morning.enabled) {
        await mod.cancelMorningNotifications();
        return;
      }
      const { t: translate, isPersonal: personal, currency: code, userName: name } = latest.current;
      let firstBody = translate('pekka.morning.pushGeneric');
      try {
        const today = localIsoDate();
        const summary = normalizeDashboardSummary(await metaApi.dashboardSummary({ from: today, to: today }));
        firstBody = morningNotificationBody(summary, { isPersonal: personal, t: translate, currency: code });
      } catch {
        // Offline: the invite still goes out, and tapping it loads fresh numbers.
      }
      if (cancelled) return;
      await mod.scheduleMorningNotifications({
        settings: morning,
        title: name ? translate('pekka.morning.pushTitleNamed', { name }) : translate('pekka.morning.pushTitle'),
        firstBody,
        laterBody: translate('pekka.morning.pushGeneric'),
      });
    };

    // Settings, account or workspace changed: rebook now.
    void book(true).catch(() => undefined);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background') void book(false).catch(() => undefined);
    });
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [businessId, morning, morningReady, signedIn]);

  return null;
}
