import type { PropsWithChildren, ReactNode } from 'react';
import { useSegments } from 'expo-router';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TopAppBar } from '@/src/components/layout/TopAppBar';
import { layout, palette, spacing } from '@/src/theme';

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
  const segments = useSegments();
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
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      {isAppRoute && showTopBar ? (
        <TopAppBar
          currentSegment={typeof currentLeafSegment === 'string' ? currentLeafSegment : undefined}
          showBack={!isRootTabScreen}
          titleOverride={topBarTitle}
          leadingMode={topBarLeading}
          right={topBarRight}
        />
      ) : null}
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {scrollable ? (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}>
            {content}
          </ScrollView>
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
    backgroundColor: palette.background,
  },
  keyboard: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: layout.stickyBarOffset,
  },
  content: {
    flexGrow: 1,
  },
  padded: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
});
