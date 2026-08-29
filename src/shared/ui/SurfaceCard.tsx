import type { PropsWithChildren, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { usePalette } from '@/src/stores/theme-store';
import { radius, shadows, spacing, typography } from '@/src/theme';

interface SurfaceCardProps extends PropsWithChildren {
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function SurfaceCard({ children, onPress, right, subtitle, title, style }: SurfaceCardProps) {
  const colors = usePalette();
  const cardStyle = [
    styles.card,
    {
      backgroundColor: colors.surface,
      borderColor: colors.border,
    },
    style,
  ];

  const header = (title || subtitle || right) && (
    <View style={styles.header}>
      <View style={styles.headerText}>
        {title ? <Text style={[styles.title, { color: colors.text }]}>{title}</Text> : null}
        {subtitle ? <Text style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );

  if (onPress) {
    return (
      <Pressable style={({ pressed }) => [cardStyle, pressed && styles.cardPressed]} onPress={onPress}>
        {header}
        {children}
      </Pressable>
    );
  }

  return (
    <View style={cardStyle}>
      {header}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    ...shadows.card,
  },
  cardPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.995 }],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  headerText: {
    flex: 1,
    gap: spacing.xxs,
  },
  title: {
    fontSize: typography.subheading,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: typography.label,
  },
});
