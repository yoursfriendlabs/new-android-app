import { useQuery } from '@tanstack/react-query';

import { useAuthStore } from '@/src/stores/auth-store';
import { metaApi } from '@/src/api';
import { normalizePurchase } from '@/src/api/normalize';
import { localIsoDate } from '@/src/shared/lib/format';
import type { MoneyActivity } from '@/src/types/models';

/**
 * The personal home's chart, streak days, counts, party balance leaders and
 * latest entries in one request, instead of loading every entry to add up here.
 */
export function useMoneyActivity(days = 7) {
  const businessId = useAuthStore((state) => state.session?.businessId);
  const to = localIsoDate(new Date());
  return useQuery<MoneyActivity>({
    // 'dashboard' prefix so invalidateMoneyQueries refreshes it after a save.
    queryKey: ['dashboard', 'activity', businessId, to, days],
    enabled: Boolean(businessId),
    queryFn: async () => {
      const response = await metaApi.dashboardActivity({ to, days, recentLimit: 6 });
      return {
        ...response,
        recentPurchases: (response.recentPurchases ?? []).map(normalizePurchase),
      };
    },
    staleTime: 30_000,
  });
}
