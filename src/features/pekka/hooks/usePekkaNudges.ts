import { useQuery } from '@tanstack/react-query';

import { analyticsApi, metaApi } from '@/src/api';
import { normalizeDashboardSummary, normalizeExpenseAnalytics } from '@/src/api/normalize';
import { getPekkaNudges } from '@/src/api/pekka';
import { useTranslation } from '@/src/i18n';
import { localIsoDate } from '@/src/shared/lib/format';
import { useAuthStore } from '@/src/stores/auth-store';

import { buildNudges, nudgeRanges, type NudgeInputs } from '../lib/nudges';
import { usePekkaWorkspace } from './usePekkaWorkspace';

// Tips change slowly; one refresh every half hour is plenty.
const NUDGE_STALE_MS = 30 * 60_000;

// Each source is optional: a staff member without reports access still gets the rest.
async function settled<T>(promise: Promise<T>): Promise<T | undefined> {
  try {
    return await promise;
  } catch {
    return undefined;
  }
}

async function loadNudgeInputs(isPersonal: boolean): Promise<NudgeInputs> {
  const now = new Date();
  const ranges = nudgeRanges(now);
  const summary = (range: { from: string; to: string }) =>
    settled(metaApi.dashboardSummary(range).then(normalizeDashboardSummary));
  const categories = (range: { from: string; to: string }) =>
    settled(analyticsApi.expenses(range).then((raw) => normalizeExpenseAnalytics(raw).categories.breakdown));

  const [nudges, categoriesNow, categoriesBefore, month, weekNow, weekBefore] = await Promise.all([
    settled(getPekkaNudges()),
    categories(ranges.month),
    categories(ranges.monthBefore),
    summary(ranges.month),
    isPersonal ? Promise.resolve(undefined) : summary(ranges.weekNow),
    isPersonal ? Promise.resolve(undefined) : summary(ranges.weekBefore),
  ]);

  return {
    isPersonal,
    dayOfMonth: now.getDate(),
    overdue: nudges?.overdue ?? [],
    categoriesNow,
    categoriesBefore,
    month,
    weekNow,
    weekBefore,
  };
}

/** Pekka's tips for the current workspace, loaded in the background. */
export function usePekkaNudges(enabled = true) {
  const { t } = useTranslation();
  const { isPersonal, currency } = usePekkaWorkspace();
  const businessId = useAuthStore((state) => state.session?.businessId ?? '');
  const signedIn = useAuthStore((state) => state.status === 'signed-in');

  const query = useQuery({
    queryKey: ['pekka-nudges', businessId, isPersonal, localIsoDate()],
    enabled: enabled && signedIn && Boolean(businessId),
    queryFn: () => loadNudgeInputs(isPersonal),
    staleTime: NUDGE_STALE_MS,
    retry: 0,
  });

  // Wording is applied on read, so switching language needs no refetch.
  const nudges = query.data ? buildNudges(query.data, { t, currency }) : [];
  return { nudges, isLoading: query.isLoading, isFetching: query.isFetching, refetch: query.refetch };
}
