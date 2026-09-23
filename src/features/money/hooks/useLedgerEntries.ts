import { useCallback, useMemo } from 'react';

import { useAuthStore } from '@/src/stores/auth-store';

import { reportsApi } from '@/src/api';
import { normalizePartyStatement } from '@/src/api/normalize';
import { useMoneyFeed, type MoneyFeedFilters } from '@/src/features/money/hooks/useMoneyFeed';
import { moneyRemarkFromNote } from '@/src/features/money/lib/money';
import { fetchAllPages, usePagedList, type Page } from '@/src/shared/hooks/usePagedList';
import type {
  LedgerEntry,
  MoneyFeedItem,
  PartyStatementRow,
  PartyStatementSummary,
} from '@/src/types/models';

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
    note: isParty ? item.note : moneyRemarkFromNote(item.note),
    category: isParty ? undefined : item.category,
    debit: isIn ? 0 : item.amount,
    credit: isIn ? item.amount : 0,
    runningBalance: undefined,
  };
}

type LedgerPage = Page<LedgerEntry> & { summary?: PartyStatementSummary };

/**
 * What a shop actually needs off a ledger row: the full bill amount and what is
 * still owed on it. The plain /reports/ledger rows only carry debit and credit,
 * which is how a settled sale used to show up as zero.
 */
function statementRowToLedger(row: PartyStatementRow): LedgerEntry {
  const type = String(row.type || '').toLowerCase();
  const isPayment = type === 'payment_in' || type === 'payment_out';
  const party = (row as { party?: { id?: string; name?: string } }).party;
  const total = Number(row.totalAmount ?? 0) || Number(row.amount ?? 0);
  const due = Math.max(Number(row.dueAmount ?? 0), 0);
  const paymentAmount = Number(row.amount ?? total);

  return {
    id: String(row.id),
    partyId: String(party?.id ?? row.partyId ?? ''),
    partyName: String(party?.name ?? row.partyName ?? ''),
    refType: type,
    refNo: String(row.referenceNo ?? ''),
    entryDate: String(row.date ?? row.createdAt ?? ''),
    note: String(row.note ?? ''),
    amount: isPayment ? paymentAmount : total,
    dueAmount: due,
    // Kept so the exported ledger PDF can still print both columns.
    debit: type === 'sale' || type === 'service' ? due : type === 'payment_out' ? paymentAmount : 0,
    credit: type === 'purchase' || type === 'expense' ? due : type === 'payment_in' ? paymentAmount : 0,
    runningBalance: row.runningBalance ?? undefined,
  };
}

/** What the shop is owed and what it owes, over the chosen party and dates. */
export interface LedgerStanding {
  toReceive: number;
  toPay: number;
  cashIn: number;
  cashOut: number;
  /** The selected party's own balance: above zero means the shop owes them. */
  currentAmount: number;
}

function toStanding(summary?: PartyStatementSummary): LedgerStanding {
  return {
    toReceive: Number(summary?.salesDue ?? 0) + Number(summary?.servicesDue ?? 0),
    toPay: Number(summary?.purchasesDue ?? 0) + Number(summary?.expensesDue ?? 0),
    cashIn: Number(summary?.totalPaymentIn ?? 0),
    cashOut: Number(summary?.totalPaymentOut ?? 0),
    currentAmount: Number(summary?.currentAmount ?? 0),
  };
}

/**
 * Ledger rows a page at a time, plus what the shop is owed and owes over the
 * same filter. Shops read the party statement, which carries full bill amounts
 * and the outstanding due on each; personal books read the money feed.
 */
export function useLedgerEntries({ book, from, partyId, personal, to }: LedgerEntriesInput) {
  const businessId = useAuthStore((state) => state.session?.businessId);
  const fetchLedgerPage = useCallback(
    async ({ limit, offset }: { limit: number; offset: number }): Promise<LedgerPage> => {
      const statement = normalizePartyStatement(
        await reportsApi.partyStatement({ partyId, from, to, limit, offset }),
      );
      const items = statement.rows.map(statementRowToLedger).filter((item) => item.id);
      return {
        items,
        total: Number(statement.summary.totalRows ?? items.length),
        summary: statement.summary,
      };
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

  const shopSummary = (shopQuery.data?.pages[0] as LedgerPage | undefined)?.summary;
  const standing = toStanding(shopSummary);
  const totals = personal
    ? { debit: personalQuery.totals.out, credit: personalQuery.totals.in }
    : { debit: standing.toReceive, credit: standing.toPay };

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
    standing,
    total: active.total,
    list: active,
    loadMore: active.loadMore,
    isLoading: active.isLoading,
    isRefreshing: active.isRefreshing,
    refetch: active.refetch,
    loadAll,
  };
}
