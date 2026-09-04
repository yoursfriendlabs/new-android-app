import { router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { PersonalHomeScreen } from '@/src/features/home/components/PersonalHomeScreen';
import { ShopHomeScreen } from '@/src/features/home/components/ShopHomeScreen';
import { Screen } from '@/src/shared/layout/Screen';
import { isGeneralStaffUser, isPersonalWorkspace } from '@/src/shared/lib/business';
import { useAuthStore } from '@/src/stores/auth-store';
import { usePalette } from '@/src/stores/theme-store';

export default function HomeScreen() {
  const colors = usePalette();
  const user = useAuthStore((state) => state.user);
  const session = useAuthStore((state) => state.session);
  const accessControl = useAuthStore((state) => state.accessControl);
  const businessProfile = useAuthStore((state) => state.businessProfile);
  const accessContext = {
    role: session?.role ?? user?.role ?? undefined,
    permissions: accessControl?.permissions ?? user?.permissions,
    accessControl,
    enabledModules: businessProfile?.enabledModules,
    businessType: String(businessProfile?.businessType ?? businessProfile?.type ?? ''),
  };

  const isGeneralStaff = isGeneralStaffUser(accessContext);
  const isPersonal = isPersonalWorkspace(accessContext);

  useEffect(() => {
    if (isGeneralStaff) {
      router.replace('/(app)/attendance');
    }
  }, [isGeneralStaff]);

  if (isGeneralStaff) {
    return (
      <Screen scrollable={false} padded={false}>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Screen>
    );
  }

  if (isPersonal) {
    return <PersonalHomeScreen />;
  }

  return <ShopHomeScreen />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
