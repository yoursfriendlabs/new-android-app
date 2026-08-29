import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { usePalette } from '@/src/stores/theme-store';
import { radius, shadows, spacing, typography } from '@/src/theme';

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
  const colors = usePalette();
  const isPrimary = tone === 'primary';

  return (
    <Pressable
      style={[
        styles.button,
        { backgroundColor: isPrimary ? colors.primary : colors.backgroundAlt },
      ]}
      onPress={onPress}>
      <Text style={[styles.buttonLabel, { color: isPrimary ? colors.onPrimary : colors.text }]}>{label}</Text>
    </Pressable>
  );
}

export function StickyActionBar({ leading, primary, secondary }: StickyActionBarProps) {
  const colors = usePalette();

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <View
        style={[
          styles.container,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}>
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
    borderWidth: 1,
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
  buttonLabel: {
    fontSize: typography.body,
    fontWeight: '700',
  },
});
