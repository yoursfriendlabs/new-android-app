import { useQuery } from '@tanstack/react-query';

import { getPekkaQuota } from '@/src/api/pekka';
import { useSubscription } from '@/src/shared/hooks/useAppQueries';
import { localIsoDate } from '@/src/shared/lib/format';
import { useAuthStore } from '@/src/stores/auth-store';

import { resolveStanding, type PekkaStanding } from '../lib/quota';

// The allowance only moves when questions are asked, so a minute is plenty.
const QUOTA_STALE_MS = 60_000;

/**
 * What this account may do with Pekka's AI today.
 *
 * Reads the server's allowance first — that endpoint is open to staff, while
 * the subscription is owner-only — and falls back to the subscription on a
 * server that has no quota endpoint yet. The date is part of the key, so the
 * allowance refreshes by itself when the day turns over.
 */
export function usePekkaAi(): PekkaStanding & { serverUsed: number | null } {
  const businessId = useAuthStore((state) => state.session?.businessId ?? '');
  const signedIn = useAuthStore((state) => state.status === 'signed-in');
  const { data: subscription } = useSubscription();

  const { data } = useQuery({
    queryKey: ['pekka-quota', businessId, localIsoDate()],
    enabled: signedIn && Boolean(businessId),
    queryFn: getPekkaQuota,
    staleTime: QUOTA_STALE_MS,
    retry: 0,
  });

  return {
    ...resolveStanding(data, subscription),
    serverUsed: typeof data?.used === 'number' ? data.used : null,
  };
}
