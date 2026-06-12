import type { PropsWithChildren, ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import { palette, radius, spacing, typography } from '@/src/theme';

interface BottomSheetProps extends PropsWithChildren {
  visible: boolean;
  title?: string;
  subtitle?: string;
  onClose: () => void;
  footer?: ReactNode;
  fullHeight?: boolean;
}

export function BottomSheet({
  children,
  footer,
  fullHeight = false,
  onClose,
  subtitle,
  title,
  visible,
}: BottomSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.scrim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, fullHeight && styles.fullHeight]}>
          <View style={styles.handle} />
          
          <View style={styles.headerContainer}>
            <View style={styles.headerTextWrap}>
              {title ? <Text style={styles.title}>{title}</Text> : null}
              {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            </View>
            <Pressable style={styles.closeBtn} onPress={onClose}>
              <MaterialCommunityIcons name="close" size={20} color={palette.textSoft} />
            </Pressable>
          </View>

          <ScrollView bounces={false} style={[styles.content, fullHeight || Boolean(footer) ? styles.contentFill : undefined]}>
            <View style={styles.contentInner}>{children}</View>
          </ScrollView>
          {footer ? (
            <SafeAreaView edges={['bottom']} style={styles.footerSafeArea}>
              <View style={styles.footer}>{footer}</View>
            </SafeAreaView>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(21, 16, 12, 0.32)',
  },
  sheet: {
    backgroundColor: palette.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingTop: spacing.sm,
    maxHeight: '92%',
    minHeight: '40%',
    overflow: 'hidden',
  },
  fullHeight: {
    height: '86%',
  },
  handle: {
    width: 48,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: palette.border,
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
    backgroundColor: palette.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  title: {
    fontSize: typography.heading,
    fontWeight: '800',
    color: palette.text,
  },
  subtitle: {
    fontSize: typography.body,
    color: palette.textMuted,
  },
  content: {
    maxHeight: '100%',
  },
  contentInner: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  contentFill: {
    flex: 1,
  },
  footerSafeArea: {
    backgroundColor: palette.surface,
    borderTopWidth: 1,
    borderTopColor: palette.border,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
});
