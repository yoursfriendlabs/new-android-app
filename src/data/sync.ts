import { ApiError, apiRequest } from '@/src/api/client';
import { enqueueMutation, listQueuedMutations, removeQueuedMutation, updateQueuedMutationError } from '@/src/data/database';
import { useSyncStore } from '@/src/stores/sync-store';
import type { QueueMethod } from '@/src/types/models';

export interface OfflineSubmitResult<T> {
  queued: boolean;
  data?: T;
}

export function isOfflineLikeError(error: unknown) {
  if (error instanceof ApiError) {
    return error.status === undefined || error.status >= 500 || error.message.includes('Missing EXPO_PUBLIC_API_BASE_URL');
  }

  return error instanceof TypeError;
}

export async function submitWithOfflineQueue<TResponse, TBody extends Record<string, unknown>>(
  input: {
    entityType: string;
    method: QueueMethod;
    path: string;
    body: TBody;
  },
) {
  try {
    const data = await apiRequest<TResponse, TBody>({
      method: input.method,
      path: input.path,
      body: input.body,
    });

    return {
      queued: false,
      data,
    } satisfies OfflineSubmitResult<TResponse>;
  } catch (error) {
    if (!isOfflineLikeError(error)) {
      throw error;
    }

    await enqueueMutation({
      entityType: input.entityType,
      method: input.method,
      path: input.path,
      body: input.body,
    });

    await useSyncStore.getState().refreshPendingCount();

    return {
      queued: true,
    } satisfies OfflineSubmitResult<TResponse>;
  }
}

export async function flushQueuedMutations() {
  const { isOnline, isSyncing } = useSyncStore.getState();
  if (!isOnline || isSyncing) return;

  useSyncStore.getState().setSyncing(true);

  try {
    const queuedMutations = await listQueuedMutations();

    for (const mutation of queuedMutations) {
      try {
        await apiRequest({
          method: mutation.method,
          path: mutation.path,
          body: mutation.body,
        });
        await removeQueuedMutation(mutation.id);
      } catch (error) {
        if (!isOfflineLikeError(error)) {
          await updateQueuedMutationError(
            mutation.id,
            error instanceof Error ? error.message : 'Failed to sync queued action',
          );
        }
        break;
      }
    }
  } finally {
    await useSyncStore.getState().refreshPendingCount();
    useSyncStore.getState().setSyncing(false);
  }
}
