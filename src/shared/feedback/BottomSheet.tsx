import type { PropsWithChildren, ReactNode } from 'react';
import { useRef } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { KeyboardAvoidingView, useKeyboardState } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import { usePalette } from '@/src/stores/theme-store';
import { radius, spacing, typography } from '@/src/theme';

/** Breathing room kept between the top of the sheet and the status bar. */
const TOP_GAP = spacing.sm;

interface BottomSheetProps extends PropsWithChildren {
  visible: boolean;
  title?: string;
  subtitle?: string;
  onClose: () => void;
  footer?: ReactNode;
  fullHeight?: boolean;
  compact?: boolean;
  heightRatio?: number;
  /** Chat-style sheets: keep the newest message in view as the list grows. */
  stickToBottom?: boolean;
  /**
   * Off when the body renders its own list (FlashList, FlatList). A virtualised
   * list inside a ScrollView loses its height and draws nothing.
   */
  scrollable?: boolean;
}

export function BottomSheet({
  children,
  compact = false,
  footer,
  fullHeight = false,
  heightRatio,
  onClose,
  scrollable = true,
  stickToBottom = false,
  subtitle,
  title,
  visible,
}: BottomSheetProps) {
  const colors = usePalette();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const keyboardVisible = useKeyboardState((state) => state.isVisible);
  const scroller = useRef<ScrollView>(null);

  // How tall the sheet would like to be with no keyboard in the way. It is a
  // wish, not a rule: `flexShrink` below lets the layout cut it down to
  // whatever room KeyboardAvoidingView leaves, so nothing has to be measured
  // or added up by hand.
  const preferredHeight = heightRatio
    ? Math.round(windowHeight * Math.min(Math.max(heightRatio, 0.35), 0.96))
    : compact
      ? Math.min(Math.round(windowHeight * 0.68), 580)
      : fullHeight
        ? Math.round(windowHeight * 0.94)
        : Math.round(windowHeight * 0.9);

  const body = (
    <View style={[styles.contentInner, !scrollable && styles.contentFill]}>{children}</View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      // Both flags must match KeyboardProvider's, or the keyboard height comes
      // back measured against a different window and every offset is wrong.
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        {/*
          The one thing in a sheet that moves for the keyboard. It pads from the
          native keyboard animation, frame for frame, so the sheet rides up with
          the keys instead of jumping once they have finished. `automaticOffset`
          tells it where it sits inside this modal window.
        */}
        <KeyboardAvoidingView
          behavior="padding"
          automaticOffset
          style={[styles.avoider, { paddingTop: insets.top + TOP_GAP }]}>
          <View
            style={[
              styles.sheet,
              { backgroundColor: colors.surface, height: preferredHeight },
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

            <View style={styles.body}>
              {scrollable ? (
                <ScrollView
                  ref={scroller}
                  bounces={false}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                  onContentSizeChange={
                    stickToBottom ? () => scroller.current?.scrollToEnd({ animated: true }) : undefined
                  }
                  style={styles.contentFill}
                  contentContainerStyle={styles.contentGrow}>
                  {body}
                </ScrollView>
              ) : (
                body
              )}
              {footer ? (
                <View
                  style={[
                    styles.footer,
                    {
                      backgroundColor: colors.surface,
                      borderTopColor: colors.border,
                      // The keyboard covers the navigation bar, so that strip of
                      // safe area is only needed while the keys are down.
                      paddingBottom: (keyboardVisible ? 0 : insets.bottom) + spacing.sm,
                    },
                  ]}>
                  {footer}
                </View>
              ) : null}
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'rgba(21, 16, 12, 0.32)',
  },
  avoider: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    width: '100%',
    // The sheet gives up height before it ever overflows the room left above
    // the keyboard, so its top can never slide off the screen.
    flexShrink: 1,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingTop: spacing.sm,
    overflow: 'hidden',
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
  footer: {
    borderTopWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
});
