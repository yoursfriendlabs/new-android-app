import { useCallback, useMemo } from 'react';

import { useAuthStore } from '@/src/stores/auth-store';

import { reportsApi } from '@/src/api';
import { normalizeLedgerEntry } from '@/src/api/normalize';
import { useMoneyFeed, type MoneyFeedFilters } from '@/src/features/money/hooks/useMoneyFeed';
import { moneyRemarkFromNote } from '@/src/features/money/lib/money';
import { fetchAllPages, usePagedList, type Page } from '@/src/shared/hooks/usePagedList';
import type { LedgerEntry, MoneyFeedItem } from '@/src/types/models';

export type PersonalBook = 'income' | 'expense' | 'party';

interface LedgerEntriesInput {
  personal: boolean;
  book: PersonalBook;
  partyId?: string;
  from?: string;
  to?: string;
}

const BOOK_SOURCES: Record<PersonalBook, NonNullable<MoneyFeedFilters['sources']>> = {
  income: ['income'],
  expense: ['expense'],
  party: ['party'],
};

function feedItemToLedger(item: MoneyFeedItem): LedgerEntry {
  const isIn = item.kind === 'in';
  const isParty = item.source === 'party';
  return {
    id: item.id,
    partyId: item.partyId ?? '',
    partyName: item.partyName ?? '',
    refType: isParty ? (isIn ? 'payment_in' : 'payment_out') : item.source,
    refNo: item.invoiceNo ?? '',
    entryDate: item.date,
    description: isParty
      ? item.note || (isIn ? 'To Receive' : 'To Pay')
      : [item.category, moneyRemarkFromNote(item.note)].filter(Boolean).join(' · '),
    debit: isIn ? 0 : item.amount,
    credit: isIn ? item.amount : 0,
    runningBalance: undefined,
  };
}

type LedgerPage = Page<LedgerEntry> & { totals?: { debit: number; credit: number } };

/**
 * Ledger rows a page at a time, with debit/credit totals from the server.
 * Shops read the server ledger; personal books read the money feed.
 */
export function useLedgerEntries({ book, from, partyId, personal, to }: LedgerEntriesInput) {
  const businessId = useAuthStore((state) => state.session?.businessId);
  const fetchLedgerPage = useCallback(
    async ({ limit, offset }: { limit: number; offset: number }): Promise<LedgerPage> => {
      const response = await reportsApi.ledger({ partyId, from, to, limit, offset });
      const items = (response.items ?? []).map(normalizeLedgerEntry).filter((item) => item.id);
      return { items, total: Number(response.total ?? items.length), totals: response.totals };
    },
    [from, partyId, to],
  );

  const shopQuery = usePagedList<LedgerEntry>({
    queryKey: ['ledger', 'paged', businessId, partyId ?? 'all', from ?? 'all', to ?? 'all'],
    enabled: !personal && Boolean(businessId),
    fetchPage: fetchLedgerPage,
  });

  const feedFilters = useMemo<MoneyFeedFilters>(
    () => ({ sources: BOOK_SOURCES[book], partyId, from, to }),
    [book, from, partyId, to],
  );
  const personalQuery = useMoneyFeed(feedFilters, personal);

  const entries = useMemo(
    () => (personal ? personalQuery.items.map(feedItemToLedger) : shopQuery.items),
    [personal, personalQuery.items, shopQuery.items],
  );

  const shopTotals = (shopQuery.data?.pages[0] as LedgerPage | undefined)?.totals;
  const totals = personal
    ? { debit: personalQuery.totals.out, credit: personalQuery.totals.in }
    : { debit: Number(shopTotals?.debit ?? 0), credit: Number(shopTotals?.credit ?? 0) };

  const active = personal ? personalQuery : shopQuery;

  /** Every matching row, for PDF and print. */
  const loadAll = useCallback(async () => {
    if (!personal) return fetchAllPages(fetchLedgerPage);
    const rows = await fetchAllPages(async ({ limit, offset }) => {
      const response = await reportsApi.moneyFeed({
        sources: BOOK_SOURCES[book].join(','),
        partyId,
        from,
        to,
        limit,
        offset,
      });
      return { items: response.items ?? [], total: Number(response.total ?? 0) };
    });
    return rows.map(feedItemToLedger);
  }, [book, fetchLedgerPage, from, partyId, personal, to]);

  return {
    entries,
    totals,
    total: active.total,
    list: active,
    loadMore: active.loadMore,
    isLoading: active.isLoading,
    isRefreshing: active.isRefreshing,
    refetch: active.refetch,
    loadAll,
  };
}
