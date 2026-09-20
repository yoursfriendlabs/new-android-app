import test from 'node:test';
import assert from 'node:assert/strict';

import { fetchAllPages, flattenPages, nextPageOffset } from '../src/shared/hooks/usePagedList.ts';

const rows = (from, count) => Array.from({ length: count }, (_, index) => ({ id: `r${from + index}` }));

test('keeps paging while pages come back full', () => {
  const first = { items: rows(0, 30), total: 95 };
  assert.equal(nextPageOffset(first, [first], 30), 30);
});

test('stops on a short page or once the total is reached', () => {
  const full = { items: rows(0, 30), total: 30 };
  assert.equal(nextPageOffset(full, [full], 30), undefined);
  const short = { items: rows(30, 5), total: 0 };
  assert.equal(nextPageOffset(short, [{ items: rows(0, 30), total: 0 }, short], 30), undefined);
});

test('a row that shifted onto the next page is shown once', () => {
  const items = flattenPages([
    { items: [{ id: 'a' }, { id: 'b' }], total: 3 },
    { items: [{ id: 'b' }, { id: 'c' }], total: 3 },
  ]);
  assert.deepEqual(items.map((item) => item.id), ['a', 'b', 'c']);
});

test('fetchAllPages walks every page for exports', async () => {
  const calls = [];
  const all = await fetchAllPages(
    async ({ limit, offset }) => {
      calls.push(offset);
      const count = Math.max(0, Math.min(limit, 230 - offset));
      return { items: rows(offset, count), total: 230 };
    },
    { pageSize: 100 },
  );
  assert.equal(all.length, 230);
  assert.deepEqual(calls, [0, 100, 200]);
});

test('exports refuse to silently truncate large ledgers', async () => {
  await assert.rejects(fetchAllPages(async () => ({ items: rows(0, 100), total: 5001 })), /shorter date range/);
});

test('exactly the export limit is complete', async () => {
  const all = await fetchAllPages(async ({ limit, offset }) => ({ items: rows(offset, limit), total: 200 }), { pageSize: 100, maxRows: 200 });
  assert.equal(all.length, 200);
});
