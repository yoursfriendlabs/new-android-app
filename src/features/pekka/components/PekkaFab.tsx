import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuthStore } from '@/src/stores/auth-store';
import { usePalette } from '@/src/stores/theme-store';
import { radius, shadows } from '@/src/theme';

import { usePekkaNudges } from '../hooks/usePekkaNudges';
import { nudgeSignature } from '../lib/nudges';
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
  const nudgesSeen = usePekkaStore((state) => state.nudgesSeen);
  const seenReady = usePekkaStore((state) => state.schedulesReady);

  const appear = useRef(new Animated.Value(0)).current;
  const signedIn = status === 'signed-in';
  const { nudges } = usePekkaNudges(signedIn);
  const signature = nudgeSignature(nudges);
  const hasNewTips = seenReady && Boolean(signature) && signature !== nudgesSeen;

  // Opening Pekka counts as seeing today's tips; the chip inside still lists them.
  useEffect(() => {
    if (open && signature) usePekkaStore.getState().markNudgesSeen(signature);
  }, [open, signature]);

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
            accessibilityLabel={hasNewTips ? 'Pekka assistant, new tips' : 'Pekka assistant'}
            onPress={handlePress}
            style={[styles.button, shadows.floating, { backgroundColor: colors.primary }]}>
            <MaterialCommunityIcons name="robot-happy" size={26} color={colors.onPrimary} />
            {hasNewTips ? (
              <Animated.View style={[styles.dot, { backgroundColor: colors.danger, borderColor: colors.surface }]} />
            ) : null}
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
  dot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
  },
  button: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
