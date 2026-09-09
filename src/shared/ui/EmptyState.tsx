import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { haptics } from '@/src/shared/lib/haptics';
import { Text } from '@/src/shared/ui/Text';
import { usePalette } from '@/src/stores/theme-store';
import { radius, spacing } from '@/src/theme';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

interface EmptyStateProps {
  title: string;
  message: string;
  /** Draws a soft circle with this icon above the title. */
  icon?: IconName;
  /** Shows a primary button under the message. */
  actionLabel?: string;
  onAction?: () => void;
  /** `screen` centres and pads for a whole empty page; `inline` sits inside a card. */
  variant?: 'inline' | 'screen';
}

export function EmptyState({
  actionLabel,
  icon,
  message,
  onAction,
  title,
  variant = 'inline',
}: EmptyStateProps) {
  const colors = usePalette();
  const centered = variant === 'screen';

  return (
    <View style={[styles.wrap, centered && styles.wrapScreen]}>
      {icon ? (
        <View style={[styles.iconWrap, { backgroundColor: colors.accentSoft }]}>
          <MaterialCommunityIcons name={icon} size={26} color={colors.primary} />
        </View>
      ) : null}

      <Text variant="subheading" align={centered ? 'center' : 'auto'}>
        {title}
      </Text>
      <Text variant="body" tone="muted" align={centered ? 'center' : 'auto'}>
        {message}
      </Text>

      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            haptics.tapMedium();
            onAction();
          }}
          style={({ pressed }) => [
            styles.action,
            { backgroundColor: colors.primary },
            pressed && { opacity: 0.85 },
          ]}>
          <Text variant="bodyStrong" tone="onPrimary">
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: spacing.xl,
    gap: spacing.xs,
  },
  wrapScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.lg,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  action: {
    marginTop: spacing.md,
    minHeight: 46,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.input,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
