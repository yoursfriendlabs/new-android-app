import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import { StatusBar } from 'expo-status-bar';
import type { PropsWithChildren } from 'react';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { initializeDatabase } from '@/src/data/database';
import { flushQueuedMutations } from '@/src/data/sync';
import { setUnauthorizedHandler } from '@/src/api/client';
import { palette } from '@/src/theme';
import { useAuthStore } from '@/src/stores/auth-store';
import { useReceiptStore } from '@/src/stores/receipt-store';
import { useSyncStore } from '@/src/stores/sync-store';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function BootstrapRuntime() {
  useEffect(() => {
    let isMounted = true;

    initializeDatabase()
      .then(() => useAuthStore.getState().bootstrap())
      .then(() => useSyncStore.getState().refreshPendingCount())
      .then(async () => {
        if (useAuthStore.getState().status === 'signed-in') {
          await useAuthStore.getState().hydrateRemoteData();
        }
      })
      .finally(() => {
        if (isMounted) {
          void flushQueuedMutations();
        }
      });

    const unsubscribe = NetInfo.addEventListener((state) => {
      const isOnline = Boolean(state.isConnected && state.isInternetReachable !== false);
      useSyncStore.getState().setOnline(isOnline);
      if (isOnline) {
        void flushQueuedMutations();
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => useAuthStore.getState().signOut());
    return () => {
      setUnauthorizedHandler(null);
    };
  }, []);

  return null;
}

function SessionStateBridge() {
  const queryClient = useQueryClient();
  const status = useAuthStore((state) => state.status);

  useEffect(() => {
    if (status !== 'signed-out') {
      return;
    }

    queryClient.clear();
    useReceiptStore.getState().clearReceipt();
    void useSyncStore.getState().refreshPendingCount();
  }, [queryClient, status]);

  return null;
}

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: palette.background }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="dark" backgroundColor={palette.background} translucent={false} />
          <BootstrapRuntime />
          <SessionStateBridge />
          {children}
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
