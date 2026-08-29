import { StyleSheet, Text, View } from 'react-native';

import { usePalette } from '@/src/stores/theme-store';
import { spacing, typography } from '@/src/theme';

interface EmptyStateProps {
  title: string;
  message: string;
}

export function EmptyState({ message, title }: EmptyStateProps) {
  const colors = usePalette();
  return (
    <View style={styles.wrap}>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.message, { color: colors.textMuted }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: spacing.xl,
    gap: spacing.xs,
  },
  title: {
    fontSize: typography.subheading,
    fontWeight: '700',
  },
  message: {
    fontSize: typography.body,
    lineHeight: 22,
  },
});
