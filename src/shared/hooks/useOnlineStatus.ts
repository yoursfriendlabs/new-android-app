import { useSyncStore } from '@/src/stores/sync-store';

export function useOnlineStatus() {
  const isOnline = useSyncStore((state) => state.isOnline);
  const isSyncing = useSyncStore((state) => state.isSyncing);
  const pendingCount = useSyncStore((state) => state.pendingCount);

  return {
    isOnline,
    isSyncing,
    pendingCount,
  };
}
