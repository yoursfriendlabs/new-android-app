import type { PropsWithChildren, ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import { usePalette } from '@/src/stores/theme-store';
import { radius, spacing, typography } from '@/src/theme';

interface BottomSheetProps extends PropsWithChildren {
  visible: boolean;
  title?: string;
  subtitle?: string;
  onClose: () => void;
  footer?: ReactNode;
  fullHeight?: boolean;
  compact?: boolean;
}

export function BottomSheet({
  children,
  compact = false,
  footer,
  fullHeight = false,
  onClose,
  subtitle,
  title,
  visible,
}: BottomSheetProps) {
  const colors = usePalette();
  const { height: windowHeight } = useWindowDimensions();
  const tall = !compact;
  const sheetHeight = compact
    ? undefined
    : fullHeight
      ? windowHeight
      : Math.round(windowHeight * 0.92);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            { backgroundColor: colors.surface, height: sheetHeight },
            compact && styles.sheetCompact,
            fullHeight && styles.sheetFull,
          ]}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          <View style={styles.headerContainer}>
            <View style={styles.headerTextWrap}>
              {title ? <Text style={[styles.title, { color: colors.text }]}>{title}</Text> : null}
              {subtitle ? <Text style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text> : null}
            </View>
            <Pressable style={[styles.closeBtn, { backgroundColor: colors.background }]} onPress={onClose}>
              <MaterialCommunityIcons name="close" size={20} color={colors.textSoft} />
            </Pressable>
          </View>

          <KeyboardAvoidingView
            style={tall ? styles.body : undefined}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView
              bounces={false}
              keyboardShouldPersistTaps="handled"
              automaticallyAdjustKeyboardInsets={true}
              keyboardDismissMode="interactive"
              style={tall ? styles.contentFill : undefined}
              contentContainerStyle={styles.contentGrow}>
              <View style={styles.contentInner}>{children}</View>
            </ScrollView>
            {footer ? (
              <SafeAreaView edges={['bottom']} style={[styles.footerSafeArea, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
                <View style={styles.footer}>{footer}</View>
              </SafeAreaView>
            ) : null}
          </KeyboardAvoidingView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(21, 16, 12, 0.32)',
  },
  sheet: {
    width: '100%',
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingTop: spacing.sm,
    overflow: 'hidden',
  },
  sheetCompact: {
    maxHeight: '78%',
  },
  sheetFull: {
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
  handle: {
    width: 48,
    height: 4,
    borderRadius: radius.pill,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  headerTextWrap: {
    flex: 1,
    gap: spacing.xs,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  title: {
    fontSize: typography.heading,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: typography.body,
  },
  body: {
    flex: 1,
    minHeight: 0,
  },
  contentFill: {
    flex: 1,
  },
  contentGrow: {
    flexGrow: 1,
  },
  contentInner: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  footerSafeArea: {
    borderTopWidth: 1,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
});
