import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';

import { AppProviders } from '@/src/providers/AppProviders';
import { useAuthStore } from '@/src/stores/auth-store';
import { usePalette, useThemeStore } from '@/src/stores/theme-store';

export { ErrorBoundary } from 'expo-router';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

function RootNavigator() {
  const colors = usePalette();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
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
  const themeStatus = useThemeStore((state) => state.status);
  const [timedOut, setTimedOut] = useState(false);
  const ready = fontsLoaded && (timedOut || (status !== 'booting' && themeStatus !== 'booting'));

  useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), 4000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (ready) {
      void SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [ready]);

  return <AppProviders>{ready ? <RootNavigator /> : null}</AppProviders>;
}
