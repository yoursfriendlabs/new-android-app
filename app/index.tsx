import { Redirect } from 'expo-router';

import { useAuthStore } from '@/src/stores/auth-store';

export default function Index() {
  const status = useAuthStore((state) => state.status);

  if (status === 'signed-in') {
    return <Redirect href="/(app)/(tabs)/home" />;
  }

  return <Redirect href="/(auth)/login" />;
}
