import type { PropsWithChildren, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { palette, radius, shadows, spacing, typography } from '@/src/theme';

interface SurfaceCardProps extends PropsWithChildren {
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function SurfaceCard({ children, onPress, right, subtitle, title, style }: SurfaceCardProps) {
  if (onPress) {
    return (
      <Pressable style={({ pressed }) => [styles.card, style, pressed && styles.cardPressed]} onPress={onPress}>
        {(title || subtitle || right) && (
          <View style={styles.header}>
            <View style={styles.headerText}>
              {title ? <Text style={styles.title}>{title}</Text> : null}
              {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            </View>
            {right}
          </View>
        )}
        {children}
      </Pressable>
    );
  }

  return (
    <View style={[styles.card, style]}>
      {(title || subtitle || right) && (
        <View style={styles.header}>
          <View style={styles.headerText}>
            {title ? <Text style={styles.title}>{title}</Text> : null}
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          {right}
        </View>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: palette.border,
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
    color: palette.text,
  },
  subtitle: {
    fontSize: typography.label,
    color: palette.textMuted,
  },
});
