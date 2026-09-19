import { useInfiniteQuery, type QueryKey } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import { extractListItems, normalizePaginated } from '@/src/api/normalize';

/** Rows per request. Small enough to feel instant on 3G, big enough to fill a phone screen twice. */
export const PAGE_SIZE = 30;

export interface Page<T> {
  items: T[];
  total: number;
}

/** Turns a raw `{ items, total }` list response into a page of normalized rows. */
export function toPage<T>(response: unknown, normalize: (raw: T) => T): Page<T> {
  const items = extractListItems<T>(response)
    .map(normalize)
    .filter((item) => Boolean((item as { id?: string }).id));
  return { items, total: normalizePaginated(response, items).total ?? items.length };
}

/** Offset of the next page, or undefined once a short page or the server total says we are done. */
export function nextPageOffset(lastPage: Page<unknown>, pages: Array<Page<unknown>>, pageSize: number) {
  const loaded = pages.reduce((sum, page) => sum + page.items.length, 0);
  if (lastPage.items.length < pageSize) return undefined;
  if (lastPage.total > 0 && loaded >= lastPage.total) return undefined;
  return loaded;
}

/** All loaded rows in order. A row created between two page loads shifts offsets by one; drop the repeat. */
export function flattenPages<T extends { id: string }>(pages: Array<Page<T>>) {
  const seen = new Set<string>();
  const rows: T[] = [];
  for (const page of pages) {
    for (const item of page.items) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      rows.push(item);
    }
  }
  return rows;
}

/**
 * Loads a list one page at a time instead of fetching every row up front.
 * Call `loadMore` when the user nears the end of the list.
 */
export function usePagedList<T extends { id: string }>(options: {
  queryKey: QueryKey;
  fetchPage: (page: { limit: number; offset: number }) => Promise<Page<T>>;
  enabled?: boolean;
  pageSize?: number;
  staleTime?: number;
}) {
  const pageSize = options.pageSize ?? PAGE_SIZE;
  const query = useInfiniteQuery({
    queryKey: options.queryKey,
    enabled: options.enabled ?? true,
    initialPageParam: 0,
    queryFn: ({ pageParam }) => options.fetchPage({ limit: pageSize, offset: pageParam }),
    getNextPageParam: (lastPage, pages) => nextPageOffset(lastPage, pages, pageSize),
    staleTime: options.staleTime ?? 30_000,
  });

  const items = useMemo(() => flattenPages(query.data?.pages ?? []), [query.data]);

  const total = query.data?.pages[0]?.total ?? items.length;
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;

  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  return {
    ...query,
    items,
    total: Math.max(total, items.length),
    loadMore,
    /** Pull-to-refresh state that ignores "load more" fetches. */
    isRefreshing: query.isRefetching && !query.isFetchingNextPage,
  };
}

/** Pages through a whole list once, for exports that must include every row. */
export async function fetchAllPages<T>(
  fetchPage: (page: { limit: number; offset: number }) => Promise<Page<T>>,
  { pageSize = 100, maxRows = 5000 } = {},
) {
  const rows: T[] = [];
  for (let offset = 0; offset < maxRows; offset += pageSize) {
    const page = await fetchPage({ limit: pageSize, offset });
    rows.push(...page.items);
    if (page.items.length < pageSize || (page.total > 0 && rows.length >= page.total)) break;
  }
  return rows;
}
