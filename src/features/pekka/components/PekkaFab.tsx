import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuthStore } from '@/src/stores/auth-store';
import { usePalette } from '@/src/stores/theme-store';
import { radius, shadows } from '@/src/theme';

import { usePekkaStore } from '../stores/pekka-store';
import { PekkaChatSheet } from './PekkaChatSheet';

/**
 * The floating Pekka button. Mounted once globally in AppProviders so it
 * overlays every screen. Hidden until the user is signed in.
 */
export function PekkaFab() {
  const colors = usePalette();
  const insets = useSafeAreaInsets();
  const status = useAuthStore((state) => state.status);
  const workspaceKey = useAuthStore((state) => `${state.user?.id}:${state.session?.businessId}`);
  const open = usePekkaStore((state) => state.open);
  const setOpen = usePekkaStore((state) => state.setOpen);
  const lift = usePekkaStore((state) => state.lift);

  const appear = useRef(new Animated.Value(0)).current;
  const signedIn = status === 'signed-in';

  useEffect(() => {
    Animated.timing(appear, {
      toValue: signedIn ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.back(1.6)),
      useNativeDriver: true,
    }).start();
  }, [appear, signedIn]);

  if (!signedIn) {
    return null;
  }

  const handlePress = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setOpen(true);
  };

  return (
    <>
      {!open ? (
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.wrap,
            {
              bottom: insets.bottom + 74 + lift,
              opacity: appear,
              transform: [{ scale: appear }],
            },
          ]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Pekka assistant"
            onPress={handlePress}
            style={[styles.button, shadows.floating, { backgroundColor: colors.primary }]}>
            <MaterialCommunityIcons name="robot-happy" size={26} color={colors.onPrimary} />
          </Pressable>
        </Animated.View>
      ) : null}
      <PekkaChatSheet key={workspaceKey} />
    </>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: 16,
    zIndex: 50,
  },
  button: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
