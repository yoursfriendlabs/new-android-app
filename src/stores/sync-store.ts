import { create } from 'zustand';

import { countQueuedMutations } from '@/src/data/database';

interface SyncState {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  setOnline: (isOnline: boolean) => void;
  setSyncing: (isSyncing: boolean) => void;
  refreshPendingCount: () => Promise<void>;
}

export const useSyncStore = create<SyncState>((set) => ({
  isOnline: true,
  isSyncing: false,
  pendingCount: 0,
  setOnline: (isOnline) => set({ isOnline }),
  setSyncing: (isSyncing) => set({ isSyncing }),
  refreshPendingCount: async () => {
    const pendingCount = await countQueuedMutations();
    set({ pendingCount });
  },
}));
