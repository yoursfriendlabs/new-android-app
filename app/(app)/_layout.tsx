import { Redirect, Stack, useSegments } from 'expo-router';

import { canAccessSegment } from '@/src/lib/business';
import { useAuthStore } from '@/src/stores/auth-store';

export default function AppLayout() {
  const status = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);
  const session = useAuthStore((state) => state.session);
  const accessControl = useAuthStore((state) => state.accessControl);
  const businessProfile = useAuthStore((state) => state.businessProfile);
  const segments = useSegments();

  if (status === 'signed-out') {
    return <Redirect href="/(auth)/login" />;
  }

  const currentLeafSegment = segments[segments.length - 1];
  const accessContext = {
    role: session?.role ?? user?.role ?? null,
    permissions: accessControl?.permissions ?? user?.permissions,
    accessControl,
    enabledModules: businessProfile?.enabledModules,
  };

  const role = session?.role ?? user?.role ?? null;
  const isGeneralStaff = role === 'staff' || accessControl?.staffCategory === 'general_staff';

  if (isGeneralStaff && (currentLeafSegment === 'home' || currentLeafSegment === '(tabs)' || (currentLeafSegment as string) === 'index' || !currentLeafSegment)) {
    const membershipId = accessControl?.membershipId || '';
    const name = user?.name || '';
    return <Redirect href={`/(app)/staff-salary?membershipId=${membershipId}&name=${encodeURIComponent(name)}` as any} />;
  }

  if (typeof currentLeafSegment === 'string' && !canAccessSegment(accessContext, currentLeafSegment)) {
    if (isGeneralStaff) {
      const membershipId = accessControl?.membershipId || '';
      const name = user?.name || '';
      return <Redirect href={`/(app)/staff-salary?membershipId=${membershipId}&name=${encodeURIComponent(name)}` as any} />;
    }
    return <Redirect href="/(app)/(tabs)/home" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="service-create" options={{ presentation: 'modal' }} />
      <Stack.Screen name="purchase-create" options={{ presentation: 'modal' }} />
      <Stack.Screen name="invoice" options={{ presentation: 'modal' }} />
      <Stack.Screen name="print-preview" options={{ presentation: 'modal' }} />
      <Stack.Screen name="change-password" options={{ presentation: 'modal' }} />
      <Stack.Screen name="expense-categories" options={{ presentation: 'modal' }} />
      <Stack.Screen name="tasks/inbox" />
      <Stack.Screen name="tasks/detail" />
      <Stack.Screen name="tasks/form" options={{ presentation: 'modal' }} />
      <Stack.Screen name="tasks/notifications" />
      <Stack.Screen name="purchases" />
      <Stack.Screen name="parties" />
      <Stack.Screen name="banks" />
      <Stack.Screen name="ledger" />
      <Stack.Screen name="inventory" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="owner-tools" />
      <Stack.Screen name="staff" />
      <Stack.Screen name="staff-salary" />
      <Stack.Screen name="attendance" />

    </Stack>
  );
}
