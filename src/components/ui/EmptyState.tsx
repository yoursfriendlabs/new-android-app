import { StyleSheet, Text, View } from 'react-native';

import { palette, spacing, typography } from '@/src/theme';

interface EmptyStateProps {
  title: string;
  message: string;
}

export function EmptyState({ message, title }: EmptyStateProps) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
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
    color: palette.text,
  },
  message: {
    fontSize: typography.body,
    lineHeight: 22,
    color: palette.textMuted,
  },
});
