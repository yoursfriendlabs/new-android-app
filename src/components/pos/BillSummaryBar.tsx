import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatCurrency, pluralize } from '@/src/lib/format';
import { palette, radius, shadows, spacing, typography } from '@/src/theme';

interface BillSummaryBarProps {
  itemCount: number;
  total: number;
  onPress: () => void;
}

export function BillSummaryBar({ itemCount, onPress, total }: BillSummaryBarProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.meta}>
        <Text style={styles.kicker}>{itemCount > 0 ? `${itemCount} ${pluralize('item', itemCount)} in cart` : 'Cart is empty'}</Text>
        <Text style={styles.total}>{formatCurrency(total)}</Text>
      </View>
      <Pressable style={styles.button} onPress={onPress}>
        <Text style={styles.buttonLabel}>{itemCount > 0 ? 'Open cart' : 'Start bill'}</Text>
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
    backgroundColor: palette.text,
    ...shadows.floating,
  },
  meta: {
    flex: 1,
    gap: spacing.xxs,
  },
  kicker: {
    fontSize: typography.caption,
    color: 'rgba(255,255,255,0.76)',
    fontWeight: '700',
  },
  total: {
    fontSize: typography.heading,
    fontWeight: '800',
    color: palette.white,
  },
  button: {
    minWidth: 118,
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  buttonLabel: {
    fontSize: typography.body,
    fontWeight: '700',
    color: palette.white,
  },
});
