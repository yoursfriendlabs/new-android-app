import { StyleSheet, Text, View } from 'react-native';

import { formatCurrency } from '@/src/shared/lib/format';
import { usePalette } from '@/src/stores/theme-store';
import { spacing, typography } from '@/src/theme';

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
  const colors = usePalette();
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
          <Text style={[styles.label, { color: colors.textMuted }, row.strong && { color: colors.text, fontSize: typography.subheading }]}>
            {row.label}
          </Text>
          <Text style={[styles.value, { color: colors.text }, row.strong && { fontSize: typography.subheading }]}>
            {formatCurrency(row.value)}
          </Text>
        </View>
      ))}
      {amountReceived > 0 ? (
        <>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.row}>
            <Text style={[styles.label, { color: colors.textMuted }]}>Received</Text>
            <Text style={[styles.value, { color: colors.text }]}>{formatCurrency(amountReceived)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={[styles.label, { color: colors.textMuted }]}>Due</Text>
            <Text style={[styles.value, { color: colors.warning }]}>
              {formatCurrency(Math.max(grandTotal - amountReceived, 0))}
            </Text>
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
  },
  value: {
    fontSize: typography.body,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    marginVertical: spacing.xs,
  },
});
