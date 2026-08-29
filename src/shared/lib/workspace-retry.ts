import { useAuthStore } from '@/src/stores/auth-store';
import { isNoAccessToBusinessError } from '@/src/shared/lib/workspace';

export async function withWorkspaceRetry<T>(task: () => Promise<T>): Promise<T> {
  try {
    return await task();
  } catch (error) {
    if (!isNoAccessToBusinessError(error)) throw error;
    await useAuthStore.getState().hydrateRemoteData({ refreshSession: true });
    return task();
  }
}
