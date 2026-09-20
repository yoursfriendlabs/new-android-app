import { useQuery } from '@tanstack/react-query';

import { useAuthStore } from '@/src/stores/auth-store';

import { reportsApi } from '@/src/api';
import { usePagedList, type Page } from '@/src/shared/hooks/usePagedList';
import type { MoneyFeedItem, MoneyFeedResponse } from '@/src/types/models';

export interface MoneyFeedFilters {
  from?: string;
  to?: string;
  sources?: Array<MoneyFeedItem['source']>;
  direction?: 'in' | 'out';
  partyId?: string;
  partyOnly?: boolean;
  bankId?: string;
  includeCash?: boolean;
  amountBasis?: 'bill' | 'paid';
  search?: string;
  /** Extras for the first page: flow, categories, parties. */
  include?: Array<'flow' | 'categories' | 'parties'>;
  flowTo?: string;
  flowDays?: number;
}

type FeedMeta = Omit<MoneyFeedResponse, 'items' | 'total' | 'limit' | 'offset'>;
type FeedPage = Page<MoneyFeedItem> & { meta?: FeedMeta };

/**
 * Pages through money movements with totals worked out by the server
 * (GET /api/reports/money-feed). Totals, chart, categories and top parties come
 * with the first page and cover every matching row, not just the loaded ones.
 */
export function useMoneyFeed(filters: MoneyFeedFilters, enabled = true) {
  const businessId = useAuthStore((state) => state.session?.businessId);
  const paged = usePagedList<MoneyFeedItem>({
    queryKey: ['money-feed', businessId, filters],
    enabled: enabled && Boolean(businessId),
    fetchPage: async ({ limit, offset }): Promise<FeedPage> => {
      const { include, sources, ...rest } = filters;
      const response = await reportsApi.moneyFeed({
        ...rest,
        sources: sources?.join(','),
        include: offset === 0 && include?.length ? include.join(',') : undefined,
        limit,
        offset,
      });
      const { items, total, limit: _limit, offset: _offset, ...meta } = response;
      return { items: items ?? [], total: Number(total ?? 0), meta };
    },
  });
  const meta = (paged.data?.pages[0] as FeedPage | undefined)?.meta;
  return {
    ...paged,
    totals: meta?.totals ?? { in: 0, out: 0, net: 0, count: 0 },
    flow: meta?.flow ?? [],
    categories: meta?.categories ?? [],
    parties: meta?.parties ?? [],
  };
}

/** Totals, chart, categories and top parties only — no rows to page through. */
export function useMoneyFeedSummary(filters: MoneyFeedFilters, enabled = true) {
  const businessId = useAuthStore((state) => state.session?.businessId);
  return useQuery({
    queryKey: ['money-feed', businessId, 'summary', filters],
    enabled: enabled && Boolean(businessId),
    queryFn: async () => {
      const { include, sources, ...rest } = filters;
      const { items: _items, ...summary } = await reportsApi.moneyFeed({
        ...rest,
        sources: sources?.join(','),
        include: include?.join(','),
        limit: 1,
        offset: 0,
      });
      return summary;
    },
    staleTime: 30_000,
  });
}
