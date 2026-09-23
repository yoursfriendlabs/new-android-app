import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { haptics } from '@/src/shared/lib/haptics';

import { formatCurrency, pluralize } from '@/src/shared/lib/format';
import { usePalette } from '@/src/stores/theme-store';
import { useTranslation } from '@/src/i18n';
import { radius, shadows, spacing, typography } from '@/src/theme';

interface BillSummaryBarProps {
  itemCount: number;
  total: number;
  onPress: () => void;
  /** Cafes keep the order open instead of charging straight away. */
  secondaryLabel?: string;
  onSecondaryPress?: () => void;
  secondaryBusy?: boolean;
}

export function BillSummaryBar({
  itemCount,
  onPress,
  onSecondaryPress,
  secondaryBusy = false,
  secondaryLabel,
  total,
}: BillSummaryBarProps) {
  const colors = usePalette();
  const { t, isNepali } = useTranslation();
  const hasItems = itemCount > 0;

  const itemText = isNepali
    ? `${itemCount} ${t('pos.itemCount')}`
    : `${itemCount} ${pluralize('item', itemCount)}`;

  return (
    <LinearGradient
      colors={[colors.primary, colors.primaryPressed]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.wrap}>
      <View style={styles.meta}>
        <Text style={[styles.kicker, { color: colors.onPrimary }]}>
          {hasItems ? itemText : t('pos.cartEmpty')}
        </Text>
        <Text style={[styles.total, { color: colors.onPrimary }]}>{formatCurrency(total)}</Text>
      </View>
      {secondaryLabel && onSecondaryPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={secondaryLabel}
          accessibilityState={{ disabled: !hasItems || secondaryBusy }}
          style={[styles.secondaryButton, { borderColor: colors.onPrimary }]}
          onPress={() => {
            haptics.tapLight();
            onSecondaryPress();
          }}
          disabled={!hasItems || secondaryBusy}>
          <Text
            numberOfLines={1}
            style={[styles.buttonLabel, { color: colors.onPrimary, opacity: hasItems && !secondaryBusy ? 1 : 0.55 }]}>
            {secondaryBusy ? '…' : secondaryLabel}
          </Text>
        </Pressable>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t('pos.payNow')}, ${formatCurrency(total)}`}
        accessibilityState={{ disabled: !hasItems }}
        style={[styles.button, { backgroundColor: colors.surface }]}
        onPress={() => {
          haptics.tapMedium();
          onPress();
        }}
        disabled={!hasItems}>
        <Text style={[styles.buttonLabel, { color: hasItems ? colors.text : colors.textSoft }]}>
          {hasItems ? t('pos.payNow') : t('pos.cartEmpty')}
        </Text>
      </Pressable>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    margin: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    ...shadows.floating,
  },
  meta: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xxs,
  },
  kicker: {
    fontSize: typography.caption,
    opacity: 0.78,
    fontWeight: '700',
  },
  total: {
    fontSize: typography.heading,
    fontWeight: '800',
  },
  secondaryButton: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  button: {
    minWidth: 104,
    minHeight: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  buttonLabel: {
    fontSize: typography.body,
    fontWeight: '800',
  },
});
