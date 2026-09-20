import { Redirect, Stack, useSegments } from 'expo-router';

import { useOnboardingStore } from '@/src/features/onboarding/lib/onboarding';
import { canAccessSegment, isGeneralStaffUser } from '@/src/shared/lib/business';
import { useAuthStore } from '@/src/stores/auth-store';

export default function AppLayout() {
  const status = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);
  const session = useAuthStore((state) => state.session);
  const accessControl = useAuthStore((state) => state.accessControl);
  const businessProfile = useAuthStore((state) => state.businessProfile);
  const segments = useSegments();
  const onboardingStatus = useOnboardingStore((state) => state.status);

  if (status === 'signed-out') {
    return <Redirect href="/(auth)/login" />;
  }

  const currentLeafSegment = segments[segments.length - 1];

  // First run: the tour is the only screen until it is finished. This is done with
  // Stack.Protected rather than a <Redirect>, because swapping the stack out for a
  // redirect while login is also navigating looped into "Maximum update depth exceeded".
  const showTour = onboardingStatus === 'pending';

  const accessContext = {
    role: session?.role ?? user?.role ?? null,
    permissions: accessControl?.permissions ?? user?.permissions,
    accessControl,
    enabledModules: businessProfile?.enabledModules,
    businessType: String(businessProfile?.businessType ?? businessProfile?.type ?? ''),
  };

  const isGeneralStaff = isGeneralStaffUser(accessContext);

  if (!showTour && isGeneralStaff && (currentLeafSegment === 'home' || currentLeafSegment === '(tabs)' || (currentLeafSegment as string) === 'index' || !currentLeafSegment)) {
    const membershipId = accessControl?.membershipId || '';
    const name = user?.name || '';
    return <Redirect href={`/(app)/staff-salary?membershipId=${membershipId}&name=${encodeURIComponent(name)}` as any} />;
  }

  if (!showTour && typeof currentLeafSegment === 'string' && !canAccessSegment(accessContext, currentLeafSegment)) {
    if (isGeneralStaff) {
      const membershipId = accessControl?.membershipId || '';
      const name = user?.name || '';
      return <Redirect href={`/(app)/staff-salary?membershipId=${membershipId}&name=${encodeURIComponent(name)}` as any} />;
    }
    return <Redirect href="/(app)/(tabs)/home" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!showTour}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="service-create" options={{ presentation: 'modal' }} />
        <Stack.Screen name="purchase-create" options={{ presentation: 'modal' }} />
        <Stack.Screen name="invoice" options={{ presentation: 'modal' }} />
        <Stack.Screen name="print-preview" options={{ presentation: 'modal' }} />
        <Stack.Screen name="change-password" options={{ presentation: 'modal' }} />
        <Stack.Screen name="delete-account" />
        <Stack.Screen name="expense-categories" options={{ presentation: 'modal' }} />
        <Stack.Screen name="units" />
        <Stack.Screen name="notes" />
        <Stack.Screen name="attributes" />
        <Stack.Screen name="tasks/inbox" />
        <Stack.Screen name="tasks/detail" />
        <Stack.Screen name="tasks/form" options={{ presentation: 'modal' }} />
        <Stack.Screen name="tasks/notifications" />
        <Stack.Screen name="coins" />
        <Stack.Screen name="purchases" />
        <Stack.Screen name="sales" />
        <Stack.Screen name="parties" />
        <Stack.Screen name="banks" />
        <Stack.Screen name="ledger" />
        <Stack.Screen name="inventory" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="workspaces" />
        <Stack.Screen name="owner-tools" />
        <Stack.Screen name="staff" />
        <Stack.Screen name="staff-salary" />
        <Stack.Screen name="attendance" />
        <Stack.Screen name="budgets" />
        <Stack.Screen name="money-insights" />
        <Stack.Screen name="cashier" />
        <Stack.Screen name="tables" />
        <Stack.Screen name="item-form" options={{ presentation: 'modal' }} />
        <Stack.Screen name="item-detail" />
      </Stack.Protected>
      <Stack.Protected guard={showTour}>
        <Stack.Screen name="welcome" options={{ gestureEnabled: false }} />
      </Stack.Protected>
    </Stack>
  );
}
