import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import type { PropsWithChildren, ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandMark } from '@/src/shared/ui/BrandMark';
import { usePalette } from '@/src/stores/theme-store';
import { layout, spacing, typography } from '@/src/theme';

interface AuthScreenProps extends PropsWithChildren {
  title: string;
  subtitle: string;
  footer?: ReactNode;
  backLabel?: string;
  onBack?: () => void;
  centered?: boolean;
}

export function AuthScreen({
  backLabel,
  centered = false,
  children,
  footer,
  onBack,
  subtitle,
  title,
}: AuthScreenProps) {
  const colors = usePalette();
  const { width } = useWindowDimensions();
  const showBack = Boolean(onBack || backLabel);
  const contentWidth = Math.min(width - layout.screenPadding * 2, layout.authMaxWidth);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'left', 'right', 'bottom']}>
      <View style={[styles.glow, { backgroundColor: colors.accentMuted }]} pointerEvents="none" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scroll, centered && styles.scrollCentered]}>
          <View style={[styles.frame, { width: contentWidth }]}>
            {showBack ? (
              <Pressable
                onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/(auth)/login')))}
                hitSlop={8}
                style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
                <MaterialCommunityIcons name="arrow-left" size={20} color={colors.text} />
                <Text style={[styles.backLabel, { color: colors.text }]}>{backLabel || 'Back'}</Text>
              </Pressable>
            ) : (
              <View style={styles.brandRow}>
                <BrandMark size={56} />
                <Text style={[styles.brand, { color: colors.text }]}>PasalManager</Text>
              </View>
            )}

            <View style={styles.hero}>
              <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text>
            </View>

            <View style={styles.body}>{children}</View>
            {footer ? <View style={styles.footer}>{footer}</View> : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  glow: {
    position: 'absolute',
    top: -80,
    right: -40,
    width: 220,
    height: 220,
    borderRadius: 110,
    opacity: 0.45,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxxl,
    alignItems: 'center',
  },
  scrollCentered: {
    justifyContent: 'center',
  },
  frame: {
    gap: spacing.xl,
    maxWidth: layout.authMaxWidth,
  },
  back: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  backLabel: {
    fontSize: typography.body,
    fontWeight: '600',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  brand: {
    fontSize: typography.subheading,
    fontWeight: '700',
  },
  hero: {
    gap: spacing.sm,
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: typography.body,
    lineHeight: 22,
  },
  body: {
    gap: spacing.md,
  },
  footer: {
    paddingTop: spacing.xs,
  },
  pressed: {
    opacity: 0.7,
  },
});
