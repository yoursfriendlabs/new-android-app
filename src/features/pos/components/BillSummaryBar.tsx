import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatCurrency, pluralize } from '@/src/shared/lib/format';
import { usePalette } from '@/src/stores/theme-store';
import { useTranslation } from '@/src/i18n';
import { radius, shadows, spacing, typography } from '@/src/theme';

interface BillSummaryBarProps {
  itemCount: number;
  total: number;
  onPress: () => void;
}

export function BillSummaryBar({ itemCount, onPress, total }: BillSummaryBarProps) {
  const colors = usePalette();
  const { t, isNepali } = useTranslation();
  const hasItems = itemCount > 0;

  const itemText = isNepali
    ? `${itemCount} ${t('pos.itemCount')}`
    : `${itemCount} ${pluralize('item', itemCount)}`;

  return (
    <View style={[styles.wrap, { backgroundColor: colors.primary }]}>
      <View style={styles.meta}>
        <Text style={[styles.kicker, { color: colors.onPrimary }]}>
          {hasItems ? itemText : t('pos.cartEmpty')}
        </Text>
        <Text style={[styles.total, { color: colors.onPrimary }]}>{formatCurrency(total)}</Text>
      </View>
      <Pressable
        style={[styles.button, { backgroundColor: colors.white }]}
        onPress={onPress}
        disabled={!hasItems}>
        <Text style={[styles.buttonLabel, { color: hasItems ? colors.text : colors.textSoft }]}>
          {hasItems ? t('pos.payNow') : t('pos.cartEmpty')}
        </Text>
      </Pressable>
    </View>
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
  button: {
    minWidth: 118,
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
