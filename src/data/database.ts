import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { generateId } from '@/src/lib/id';
import type { QueuedMutation } from '@/src/types/models';

const DATABASE_NAME = 'counterflow.db';

const QUERIES = {
  INITIALIZE: `
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS cache_records (
      cache_key TEXT NOT NULL,
      record_id TEXT NOT NULL,
      title TEXT,
      subtitle TEXT,
      searchable_text TEXT,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (cache_key, record_id)
    );
    CREATE TABLE IF NOT EXISTS drafts (
      draft_key TEXT PRIMARY KEY NOT NULL,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sync_queue (
      id TEXT PRIMARY KEY NOT NULL,
      method TEXT NOT NULL,
      path TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      body TEXT,
      created_at TEXT NOT NULL,
      last_error TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_cache_records_key_search
      ON cache_records(cache_key, searchable_text);
    CREATE INDEX IF NOT EXISTS idx_sync_queue_created_at
      ON sync_queue(created_at);
  `,
  DELETE_CACHE_BY_KEY: 'DELETE FROM cache_records WHERE cache_key = ?',
  INSERT_CACHE_RECORD: `
    INSERT OR REPLACE INTO cache_records
      (cache_key, record_id, title, subtitle, searchable_text, data, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `,
  SELECT_CACHE_RECORDS: 'SELECT data FROM cache_records WHERE cache_key = ? ORDER BY updated_at DESC',
  SEARCH_CACHE_RECORDS: `
    SELECT data
      FROM cache_records
     WHERE cache_key = ?
       AND (searchable_text LIKE ? OR title LIKE ? OR subtitle LIKE ?)
     ORDER BY updated_at DESC
     LIMIT ?
  `,
  UPSERT_DRAFT: `
    INSERT OR REPLACE INTO drafts (draft_key, data, updated_at)
    VALUES (?, ?, ?)
  `,
  SELECT_DRAFT: 'SELECT data FROM drafts WHERE draft_key = ?',
  DELETE_DRAFT: 'DELETE FROM drafts WHERE draft_key = ?',
  DELETE_ALL_DRAFTS: 'DELETE FROM drafts',
  UPSERT_SYNC_QUEUE: `
    INSERT OR REPLACE INTO sync_queue
      (id, method, path, entity_type, body, created_at, last_error)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `,
  SELECT_SYNC_QUEUE: 'SELECT * FROM sync_queue ORDER BY created_at ASC',
  DELETE_SYNC_QUEUE: 'DELETE FROM sync_queue WHERE id = ?',
  DELETE_ALL_SYNC_QUEUE: 'DELETE FROM sync_queue',
  UPDATE_SYNC_QUEUE_ERROR: 'UPDATE sync_queue SET last_error = ? WHERE id = ?',
  COUNT_SYNC_QUEUE: 'SELECT COUNT(*) as total FROM sync_queue',
  DELETE_ALL_CACHE_RECORDS: 'DELETE FROM cache_records',
} as const;

let databasePromise: Promise<SQLiteDatabase> | null = null;

function serializePayload(value: unknown) {
  return JSON.stringify(value ?? null);
}

function deserializePayload<T>(value: string | null) {
  if (!value) return null;

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

async function getDatabase() {
  if (!databasePromise) {
    databasePromise = openDatabaseAsync(DATABASE_NAME);
  }

  return databasePromise;
}

export async function initializeDatabase() {
  const db = await getDatabase();
  await db.execAsync(QUERIES.INITIALIZE);
}

export async function replaceCacheRecords<T>(
  cacheKey: string,
  records: T[],
  options: {
    getId: (record: T) => string;
    getTitle?: (record: T) => string | undefined;
    getSubtitle?: (record: T) => string | undefined;
    getSearchText?: (record: T) => string | undefined;
  },
) {
  const db = await getDatabase();

  await db.withTransactionAsync(async () => {
    await db.runAsync(QUERIES.DELETE_CACHE_BY_KEY, cacheKey);

    const now = new Date().toISOString();
    for (const record of records) {
      await db.runAsync(
        QUERIES.INSERT_CACHE_RECORD,
        cacheKey,
        options.getId(record),
        options.getTitle?.(record) ?? null,
        options.getSubtitle?.(record) ?? null,
        options.getSearchText?.(record)?.toLowerCase() ?? null,
        serializePayload(record),
        now,
      );
    }
  });
}

export async function upsertCacheRecord<T>(
  cacheKey: string,
  record: T,
  options: {
    getId: (record: T) => string;
    getTitle?: (record: T) => string | undefined;
    getSubtitle?: (record: T) => string | undefined;
    getSearchText?: (record: T) => string | undefined;
  },
) {
  const db = await getDatabase();

  await db.runAsync(
    QUERIES.INSERT_CACHE_RECORD,
    cacheKey,
    options.getId(record),
    options.getTitle?.(record) ?? null,
    options.getSubtitle?.(record) ?? null,
    options.getSearchText?.(record)?.toLowerCase() ?? null,
    serializePayload(record),
    new Date().toISOString(),
  );
}

export async function readCacheRecords<T>(cacheKey: string) {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ data: string }>(QUERIES.SELECT_CACHE_RECORDS, cacheKey);

  return rows
    .map((row) => deserializePayload<T>(row.data))
    .filter((row): row is T => Boolean(row));
}

export async function searchCacheRecords<T>(cacheKey: string, search: string, limit = 50) {
  const db = await getDatabase();
  const query = `%${search.trim().toLowerCase()}%`;
  const rows = await db.getAllAsync<{ data: string }>(
    QUERIES.SEARCH_CACHE_RECORDS,
    cacheKey,
    query,
    query,
    query,
    limit,
  );

  return rows
    .map((row) => deserializePayload<T>(row.data))
    .filter((row): row is T => Boolean(row));
}

export async function saveDraft<T>(draftKey: string, value: T) {
  const db = await getDatabase();
  await db.runAsync(
    QUERIES.UPSERT_DRAFT,
    draftKey,
    serializePayload(value),
    new Date().toISOString(),
  );
}

export async function readDraft<T>(draftKey: string) {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ data: string }>(QUERIES.SELECT_DRAFT, draftKey);

  return deserializePayload<T>(row?.data ?? null);
}

export async function clearDraft(draftKey: string) {
  const db = await getDatabase();
  await db.runAsync(QUERIES.DELETE_DRAFT, draftKey);
}

export async function clearAllDrafts() {
  const db = await getDatabase();
  await db.runAsync(QUERIES.DELETE_ALL_DRAFTS);
}

export async function enqueueMutation(
  input: Omit<QueuedMutation, 'id' | 'createdAt'> & { id?: string; createdAt?: string },
) {
  const db = await getDatabase();
  const mutation: QueuedMutation = {
    id: input.id ?? generateId('queue'),
    createdAt: input.createdAt ?? new Date().toISOString(),
    lastError: input.lastError ?? null,
    ...input,
  };

  await db.runAsync(
    QUERIES.UPSERT_SYNC_QUEUE,
    mutation.id,
    mutation.method,
    mutation.path,
    mutation.entityType,
    serializePayload(mutation.body),
    mutation.createdAt,
    mutation.lastError ?? null,
  );

  return mutation;
}

export async function listQueuedMutations() {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    id: string;
    method: QueuedMutation['method'];
    path: string;
    entity_type: string;
    body: string | null;
    created_at: string;
    last_error: string | null;
  }>(QUERIES.SELECT_SYNC_QUEUE);

  return rows.map<QueuedMutation>((row) => ({
    id: row.id,
    method: row.method,
    path: row.path,
    entityType: row.entity_type,
    body: deserializePayload<Record<string, unknown>>(row.body) ?? undefined,
    createdAt: row.created_at,
    lastError: row.last_error,
  }));
}

export async function removeQueuedMutation(id: string) {
  const db = await getDatabase();
  await db.runAsync(QUERIES.DELETE_SYNC_QUEUE, id);
}

export async function clearAllQueuedMutations() {
  const db = await getDatabase();
  await db.runAsync(QUERIES.DELETE_ALL_SYNC_QUEUE);
}

export async function updateQueuedMutationError(id: string, error: string | null) {
  const db = await getDatabase();
  await db.runAsync(QUERIES.UPDATE_SYNC_QUEUE_ERROR, error, id);
}

export async function countQueuedMutations() {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ total: number }>(QUERIES.COUNT_SYNC_QUEUE);
  return row?.total ?? 0;
}

export async function clearAllCacheRecords() {
  const db = await getDatabase();
  await db.runAsync(QUERIES.DELETE_ALL_CACHE_RECORDS);
}

export async function clearAllLocalData() {
  await Promise.all([clearAllCacheRecords(), clearAllDrafts(), clearAllQueuedMutations()]);
}
