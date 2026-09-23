import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { metaApi } from '@/src/api';
import { getPekkaNudges } from '@/src/api/pekka';
import { normalizeDashboardSummary } from '@/src/api/normalize';
import { nativeRemindersAvailable } from '@/src/features/habits/lib/interval-habits';
import { useTranslation } from '@/src/i18n';
import { formatCurrency, localIsoDate } from '@/src/shared/lib/format';
import { useAuthStore } from '@/src/stores/auth-store';
import type { DashboardSummary } from '@/src/types/models';

import { usePekkaWorkspace } from '../hooks/usePekkaWorkspace';
import { canRemindAgain, COLLECT_DEFAULT_HOUR, topOverdue } from '../lib/collect';
import { dayCloseNotificationBody } from '../lib/day-close';
import { morningNotificationBody } from '../lib/morning';
import { usePekkaStore } from '../stores/pekka-store';

// Closing the app many times an hour should not refetch and rebook every time.
const RESCHEDULE_GAP_MS = 15 * 60_000;

/**
 * Keeps Pekka's two daily moments booked — the morning summary and the evening
 * day-close. Notifications are set on this phone, so the numbers in them are
 * refreshed each time the app goes to the background.
 */
export function PekkaScheduleWatch() {
  const { t } = useTranslation();
  const { isPersonal, currency } = usePekkaWorkspace();
  const signedIn = useAuthStore((state) => state.status === 'signed-in');
  const businessId = useAuthStore((state) => state.session?.businessId ?? '');
  const userName = useAuthStore((state) => state.user?.name?.split(' ')[0] ?? '');
  const morning = usePekkaStore((state) => state.morning);
  const dayClose = usePekkaStore((state) => state.dayClose);
  const collectLast = usePekkaStore((state) => state.collectLast);
  const schedulesReady = usePekkaStore((state) => state.schedulesReady);

  const latest = useRef({ t, isPersonal, currency, userName });
  latest.current = { t, isPersonal, currency, userName };
  const lastRun = useRef(0);

  useEffect(() => {
    void usePekkaStore.getState().hydrateSchedules();
  }, []);

  useEffect(() => {
    if (!schedulesReady || !nativeRemindersAvailable()) return;
    let cancelled = false;

    const book = async (force: boolean) => {
      if (!force && Date.now() - lastRun.current < RESCHEDULE_GAP_MS) return;
      lastRun.current = Date.now();
      const [morningModule, closeModule] = await Promise.all([
        import('../lib/morning-notifications'),
        import('../lib/day-close-notifications'),
      ]);
      const active = signedIn && Boolean(businessId);
      if (!active || (!morning.enabled && !dayClose.enabled)) {
        await morningModule.cancelMorningNotifications();
        await closeModule.cancelDayCloseNotifications();
        return;
      }

      const { t: translate, isPersonal: personal, currency: code, userName: name } = latest.current;
      let summary: DashboardSummary | null = null;
      try {
        const today = localIsoDate();
        summary = normalizeDashboardSummary(await metaApi.dashboardSummary({ from: today, to: today }));
      } catch {
        // Offline: the invite still goes out, and tapping it loads fresh numbers.
      }
      if (cancelled) return;

      await morningModule.scheduleMorningNotifications({
        settings: morning,
        title: name ? translate('pekka.morning.pushTitleNamed', { name }) : translate('pekka.morning.pushTitle'),
        firstBody: morningNotificationBody(summary, { isPersonal: personal, t: translate, currency: code }),
        laterBody: translate('pekka.morning.pushGeneric'),
      });
      if (cancelled) return;
      await closeModule.scheduleDayCloseNotifications({
        settings: dayClose,
        title: name ? translate('pekka.close.pushTitleNamed', { name }) : translate('pekka.close.pushTitle'),
        firstBody: dayCloseNotificationBody(summary, { isPersonal: personal, t: translate, currency: code }),
        laterBody: translate('pekka.close.pushGeneric'),
      });
      if (cancelled || personal) return;
      await bookCollect({ translate, code });
    };

    /**
     * Money that has been owed for a long time is worth one reminder every few
     * days — often enough to get paid, rare enough not to become noise.
     */
    const bookCollect = async ({ translate, code }: { translate: typeof t; code: string }) => {
      if (!canRemindAgain(collectLast)) return;
      const collectModule = await import('../lib/collect-notifications');
      let target = null;
      try {
        const nudges = await getPekkaNudges();
        target = topOverdue(nudges?.overdue ?? []);
      } catch {
        // Older server without the tips endpoint: nothing to chase, nothing to book.
      }
      if (cancelled) return;
      if (!target) {
        await collectModule.cancelCollectNotification();
        return;
      }
      const booked = await collectModule.scheduleCollectNotification({
        title: translate('pekka.collect.pushTitle'),
        body: translate('pekka.collect.pushBody', {
          name: target.name,
          value: formatCurrency(target.amount, code),
          days: target.days,
        }),
        hour: dayClose.enabled ? dayClose.hour : COLLECT_DEFAULT_HOUR,
      });
      if (booked) await usePekkaStore.getState().markCollectSent();
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
  }, [businessId, collectLast, dayClose, morning, schedulesReady, signedIn]);

  return null;
}
