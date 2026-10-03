import { reportsApi } from '@/src/api';
import { usePagedList, type Page } from '@/src/shared/hooks/usePagedList';
import { useAuthStore } from '@/src/stores/auth-store';
import type { DayBookEntry, DayBookResponse } from '@/src/types/models';

type DayBookPage = Page<DayBookEntry> & { report: DayBookResponse };

export interface DayBookFilters {
  /** The day to report on. Defaults to today on the server. */
  date?: string;
  from?: string;
  to?: string;
  /** Narrows the entry list only; the account balances are never filtered. */
  search?: string;
  limit?: number;
}

/**
 * A day's money closed off per account (GET /api/reports/day-book), so the
 * screen can show cash in hand and each bank balance without adding anything
 * up on the phone.
 */
export function useDayBook(filters: DayBookFilters, enabled = true) {
  const businessId = useAuthStore((state) => state.session?.businessId);

  const paged = usePagedList<DayBookEntry>({
    queryKey: ['day-book', businessId, filters],
    enabled: enabled && Boolean(businessId),
    pageSize: filters.limit ?? 50,
    fetchPage: async ({ limit, offset }): Promise<DayBookPage> => {
      const report = await reportsApi.dayBook({ ...filters, limit, offset });
      return { items: report.entries, total: report.total, report };
    },
    staleTime: 30_000,
  });
  const report = (paged.data?.pages[0] as DayBookPage | undefined)?.report;
  return {
    ...paged,
    data: report ? { ...report, entries: paged.items } : undefined,
  };
}
