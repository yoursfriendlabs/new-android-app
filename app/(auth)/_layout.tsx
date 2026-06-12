import { Redirect, Stack } from 'expo-router';

import { useAuthStore } from '@/src/stores/auth-store';

export default function AuthLayout() {
  const status = useAuthStore((state) => state.status);

  if (status === 'signed-in') {
    return <Redirect href="/(app)/(tabs)/home" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
