import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

import { AppProviders } from '@/src/providers/AppProviders';
import { useAuthStore } from '@/src/stores/auth-store';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#f7f3ee' } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(app)" />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    ...MaterialCommunityIcons.font,
  });
  const status = useAuthStore((state) => state.status);

  useEffect(() => {
    if (fontsLoaded && status !== 'booting') {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, status]);

  return <AppProviders>{fontsLoaded && status !== 'booting' ? <RootNavigator /> : null}</AppProviders>;
}
