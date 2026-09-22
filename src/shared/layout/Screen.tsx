import type { PropsWithChildren, ReactNode } from 'react';
import { useSegments } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { KeyboardAvoidingView, KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { TopAppBar } from '@/src/shared/layout/TopAppBar';
import { usePalette } from '@/src/stores/theme-store';
import { layout, spacing } from '@/src/theme';

/** Space kept between the field being typed in and the top of the keyboard. */
export const KEYBOARD_GAP = 24;

interface ScreenProps extends PropsWithChildren {
  header?: ReactNode;
  footer?: ReactNode;
  scrollable?: boolean;
  padded?: boolean;
  showTopBar?: boolean;
  topBarRight?: ReactNode;
  topBarTitle?: string;
  topBarLeading?: 'auto' | 'brand' | 'back' | 'none';
}

export function Screen({
  children,
  footer,
  header,
  padded = true,
  scrollable = true,
  showTopBar = true,
  topBarLeading = 'auto',
  topBarRight,
  topBarTitle,
}: ScreenProps) {
  const colors = usePalette();
  const insets = useSafeAreaInsets();
  const segments = useSegments() as string[];
  const isAppRoute = segments[0] === '(app)';
  const isRootTabScreen = segments[1] === '(tabs)' && segments.length === 3;
  const currentLeafSegment = segments[segments.length - 1];

  const content = (
    <View style={[styles.content, padded && styles.padded]}>
      {header}
      {children}
    </View>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      {isAppRoute && showTopBar ? (
        <TopAppBar
          currentSegment={typeof currentLeafSegment === 'string' ? currentLeafSegment : undefined}
          showBack={!isRootTabScreen}
          titleOverride={topBarTitle}
          leadingMode={topBarLeading}
          right={topBarRight}
        />
      ) : null}
      {/*
        Android draws edge-to-edge, so the window no longer shrinks for the keyboard.
        Shrink the content ourselves and keep the focused field in view, on both platforms.
      */}
      <KeyboardAvoidingView style={styles.keyboard} behavior="padding">
        {scrollable ? (
          <KeyboardAwareScrollView
            bottomOffset={KEYBOARD_GAP}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.scrollContent,
              // Clear the tab bar, and on gesture-navigation phones the home
              // indicator too, instead of trusting one fixed number.
              { paddingBottom: Math.max(layout.stickyBarOffset, spacing.xxl + insets.bottom) },
            ]}>
            {content}
          </KeyboardAwareScrollView>
        ) : (
          content
        )}
        {footer}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  keyboard: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    flexGrow: 1,
  },
  padded: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
});
