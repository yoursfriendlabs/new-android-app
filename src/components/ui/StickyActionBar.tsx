import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { palette, radius, shadows, spacing, typography } from '@/src/theme';

interface ActionProps {
  label: string;
  onPress: () => void;
  tone?: 'primary' | 'secondary' | 'ghost';
}

interface StickyActionBarProps {
  leading?: ReactNode;
  primary: ActionProps;
  secondary?: ActionProps;
}

function ActionButton({ label, onPress, tone = 'secondary' }: ActionProps) {
  const isPrimary = tone === 'primary';

  return (
    <Pressable style={[styles.button, isPrimary ? styles.primaryButton : styles.secondaryButton]} onPress={onPress}>
      <Text style={[styles.buttonLabel, isPrimary ? styles.primaryLabel : styles.secondaryLabel]}>{label}</Text>
    </Pressable>
  );
}

export function StickyActionBar({ leading, primary, secondary }: StickyActionBarProps) {
  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <View style={styles.container}>
        {leading ? <View style={styles.leading}>{leading}</View> : null}
        <View style={styles.actions}>
          {secondary ? <ActionButton {...secondary} /> : null}
          <ActionButton {...primary} tone="primary" />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: 'transparent',
  },
  container: {
    margin: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    ...shadows.floating,
    gap: spacing.sm,
  },
  leading: {
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  button: {
    flex: 1,
    minHeight: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: palette.primary,
  },
  secondaryButton: {
    backgroundColor: palette.backgroundAlt,
  },
  buttonLabel: {
    fontSize: typography.body,
    fontWeight: '700',
  },
  primaryLabel: {
    color: palette.white,
  },
  secondaryLabel: {
    color: palette.text,
  },
});
