import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type PropsWithChildren,
} from 'react';
import { Animated, Modal, Pressable, StyleSheet, View } from 'react-native';

import { haptics } from '@/src/shared/lib/haptics';
import { Text } from '@/src/shared/ui/Text';
import { usePalette } from '@/src/stores/theme-store';
import { motion, radius, shadows, spacing } from '@/src/theme';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red confirm button — use for deletes and anything that loses data. */
  destructive?: boolean;
  icon?: IconName;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

interface PendingConfirm {
  options: ConfirmOptions;
  resolve: (value: boolean) => void;
}

export function ConfirmProvider({ children }: PropsWithChildren) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  const confirm = useCallback<ConfirmFn>((options) => {
    haptics.warning();
    return new Promise<boolean>((resolve) => {
      setPending({ options, resolve });
    });
  }, []);

  const settle = useCallback(
    (value: boolean) => {
      if (value) haptics.tapMedium();
      pending?.resolve(value);
      setPending(null);
    },
    [pending],
  );

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ConfirmDialog
        visible={Boolean(pending)}
        options={pending?.options}
        onCancel={() => settle(false)}
        onConfirm={() => settle(true)}
      />
    </ConfirmContext.Provider>
  );
}

/**
 * Themed replacement for `Alert.alert` two-button confirms.
 * `const ok = await confirm({ title: 'Delete this expense?', destructive: true })`
 */
export function useConfirm(): ConfirmFn {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used inside <ConfirmProvider>');
  }
  return context;
}

interface ConfirmDialogProps {
  visible: boolean;
  options?: ConfirmOptions;
  onCancel: () => void;
  onConfirm: () => void;
}

function ConfirmDialog({ onCancel, onConfirm, options, visible }: ConfirmDialogProps) {
  const colors = usePalette();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      progress.setValue(0);
      return;
    }
    Animated.spring(progress, {
      damping: motion.spring.snappy.damping,
      mass: motion.spring.snappy.mass,
      stiffness: motion.spring.snappy.stiffness,
      toValue: 1,
      useNativeDriver: true,
    }).start();
  }, [progress, visible]);

  if (!visible || !options) return null;

  const destructive = Boolean(options.destructive);
  const accent = destructive ? colors.danger : colors.primary;
  const accentSoft = destructive ? colors.dangerSoft : colors.accentSoft;
  const icon = options.icon ?? (destructive ? 'trash-can-outline' : 'help-circle-outline');

  return (
    <Modal visible transparent statusBarTranslucent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} accessibilityLabel="Dismiss" />
        <Animated.View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              opacity: progress,
              transform: [
                {
                  scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }),
                },
              ],
            },
          ]}>
          <View style={[styles.iconWrap, { backgroundColor: accentSoft }]}>
            <MaterialCommunityIcons name={icon} size={24} color={accent} />
          </View>

          <Text variant="heading" align="center">
            {options.title}
          </Text>
          {options.message ? (
            <Text variant="body" tone="muted" align="center">
              {options.message}
            </Text>
          ) : null}

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              onPress={onCancel}
              style={({ pressed }) => [
                styles.button,
                { backgroundColor: colors.backgroundAlt },
                pressed && { opacity: 0.85 },
              ]}>
              <Text variant="bodyStrong">{options.cancelLabel ?? 'Cancel'}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={onConfirm}
              style={({ pressed }) => [
                styles.button,
                { backgroundColor: accent },
                pressed && { opacity: 0.85 },
              ]}>
              <Text variant="bodyStrong" color={destructive ? colors.onDanger : colors.onPrimary}>
                {options.confirmLabel ?? (destructive ? 'Delete' : 'Confirm')}
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: 'rgba(21, 16, 12, 0.42)',
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
    ...shadows.sheet,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    alignSelf: 'stretch',
  },
  button: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.input,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
});
