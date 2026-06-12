import { StyleSheet, Text, View } from 'react-native';

import { formatCurrency } from '@/src/lib/format';
import { palette, spacing, typography } from '@/src/theme';

interface TotalsCardProps {
  subTotal: number;
  taxTotal: number;
  discountTotal: number;
  grandTotal: number;
  amountReceived?: number;
}

export function TotalsCard({
  amountReceived = 0,
  discountTotal,
  grandTotal,
  subTotal,
  taxTotal,
}: TotalsCardProps) {
  const rows = [
    { label: 'Subtotal', value: subTotal },
    { label: 'Tax', value: taxTotal },
    { label: 'Discount', value: discountTotal },
    { label: 'Grand total', value: grandTotal, strong: true },
  ];

  return (
    <View style={styles.wrap}>
      {rows.map((row) => (
        <View key={row.label} style={styles.row}>
          <Text style={[styles.label, row.strong && styles.strong]}>{row.label}</Text>
          <Text style={[styles.value, row.strong && styles.strong]}>{formatCurrency(row.value)}</Text>
        </View>
      ))}
      {amountReceived > 0 ? (
        <>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.label}>Received</Text>
            <Text style={styles.value}>{formatCurrency(amountReceived)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Due</Text>
            <Text style={[styles.value, styles.dueValue]}>{formatCurrency(Math.max(grandTotal - amountReceived, 0))}</Text>
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: typography.body,
    color: palette.textMuted,
  },
  value: {
    fontSize: typography.body,
    fontWeight: '700',
    color: palette.text,
  },
  strong: {
    fontSize: typography.subheading,
    color: palette.text,
  },
  divider: {
    height: 1,
    backgroundColor: palette.border,
    marginVertical: spacing.xs,
  },
  dueValue: {
    color: palette.warning,
  },
});
