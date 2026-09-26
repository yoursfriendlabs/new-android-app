import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SurfaceCard } from '@/src/shared/ui/SurfaceCard';
import { formatCurrency } from '@/src/shared/lib/format';
import {
  lineLabel,
  lineTotalOf,
  type EditableServiceLine,
  type ServiceTotals,
} from '@/src/features/services/lib/service-items';
import { usePalette } from '@/src/stores/theme-store';
import { radius, spacing, typography } from '@/src/theme';
import type { AppPalette } from '@/src/theme/app-palette';
import { useThemedStyles } from '@/src/theme/use-themed-styles';

interface ServiceItemsCardProps {
  lines: EditableServiceLine[];
  totals: ServiceTotals;
  currency: string;
  /** A locked tax invoice can be read but not re-priced. */
  locked?: boolean;
  onAdd: (itemType: 'labor' | 'part') => void;
  onEdit: (line: EditableServiceLine) => void;
  onRemove: (line: EditableServiceLine) => void;
}

/** The bill of a job: every service and product on it, and what it adds up to. */
export function ServiceItemsCard({
  currency,
  lines,
  locked = false,
  onAdd,
  onEdit,
  onRemove,
  totals,
}: ServiceItemsCardProps) {
  const colors = usePalette();
  const styles = useThemedStyles(createStyles);

  return (
    <SurfaceCard
      title="Services & products"
      subtitle={
        locked
          ? 'This bill is filed as a tax invoice, so its lines cannot change.'
          : lines.length
            ? `${lines.length} ${lines.length === 1 ? 'line' : 'lines'} on this bill`
            : 'Add what was done and what was used.'
      }>
      {!locked ? (
        <View style={styles.addRow}>
          <Pressable style={styles.addBtn} onPress={() => onAdd('labor')}>
            <MaterialCommunityIcons name="wrench-outline" size={18} color={colors.primary} />
            <Text style={styles.addBtnLabel}>Add service</Text>
          </Pressable>
          <Pressable style={styles.addBtn} onPress={() => onAdd('part')}>
            <MaterialCommunityIcons name="package-variant-closed" size={18} color={colors.primary} />
            <Text style={styles.addBtnLabel}>Add product</Text>
          </Pressable>
        </View>
      ) : null}

      {lines.length ? (
        <View style={styles.lines}>
          {lines.map((line) => {
            const isPart = line.itemType === 'part';
            return (
              <Pressable
                key={line.key}
                style={styles.lineRow}
                disabled={locked}
                onPress={() => onEdit(line)}>
                <View
                  style={[
                    styles.lineIcon,
                    { backgroundColor: isPart ? colors.successSoft : colors.accentSoft },
                  ]}>
                  <MaterialCommunityIcons
                    name={isPart ? 'package-variant-closed' : 'wrench-outline'}
                    size={18}
                    color={isPart ? colors.success : colors.accent}
                  />
                </View>
                <View style={styles.lineBody}>
                  <View style={styles.lineTopRow}>
                    <Text numberOfLines={1} style={styles.lineTitle}>
                      {lineLabel(line)}
                    </Text>
                    <Text style={styles.lineTotal}>{formatCurrency(lineTotalOf(line), currency)}</Text>
                  </View>
                  <View style={styles.lineBottomRow}>
                    <Text style={styles.lineMeta} numberOfLines={1}>
                      {line.quantity} × {formatCurrency(line.unitPrice, currency)}
                      {line.taxRate > 0 ? ` · ${line.taxRate}% tax` : ''}
                    </Text>
                    {!locked ? (
                      <View style={styles.lineActions}>
                        <Pressable style={styles.iconBtn} onPress={() => onEdit(line)} hitSlop={6}>
                          <MaterialCommunityIcons name="pencil-outline" size={16} color={colors.primary} />
                        </Pressable>
                        <Pressable style={styles.iconBtn} onPress={() => onRemove(line)} hitSlop={6}>
                          <MaterialCommunityIcons name="delete-outline" size={16} color={colors.danger} />
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <View style={styles.empty}>
          <MaterialCommunityIcons name="clipboard-text-outline" size={32} color={colors.textSoft} />
          <Text style={styles.emptyCopy}>
            {locked
              ? 'No lines were recorded on this bill.'
              : 'Nothing on this bill yet. Add a service charge or a product from stock.'}
          </Text>
        </View>
      )}

      {lines.length ? (
        <View style={styles.totals}>
          <TotalRow label="Services" value={formatCurrency(totals.laborTotal, currency)} />
          <TotalRow label="Products" value={formatCurrency(totals.partsTotal, currency)} />
          {totals.taxTotal > 0 ? <TotalRow label="Tax" value={formatCurrency(totals.taxTotal, currency)} /> : null}
          {totals.discountTotal > 0 ? (
            <TotalRow label="Discount" value={`− ${formatCurrency(totals.discountTotal, currency)}`} />
          ) : null}
          <TotalRow label="Bill total" value={formatCurrency(totals.grandTotal, currency)} strong />
        </View>
      ) : null}
    </SurfaceCard>
  );
}

function TotalRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  const colors = usePalette();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }}>
      <Text style={{ color: strong ? colors.text : colors.textMuted, fontSize: typography.body, fontWeight: strong ? '800' : '500' }}>
        {label}
      </Text>
      <Text style={{ color: strong ? colors.text : colors.textSoft, fontSize: typography.body, fontWeight: strong ? '800' : '700' }}>
        {value}
      </Text>
    </View>
  );
}

const createStyles = (colors: AppPalette) =>
  StyleSheet.create({
    addRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    addBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      minHeight: 46,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.backgroundAlt,
    },
    addBtnLabel: {
      fontSize: typography.body,
      fontWeight: '700',
      color: colors.primary,
    },
    lines: {
      gap: spacing.xs,
      marginTop: spacing.sm,
    },
    lineRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.backgroundAlt,
      borderRadius: radius.md,
      padding: spacing.sm,
    },
    lineIcon: {
      width: 34,
      height: 34,
      borderRadius: radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    lineBody: {
      flex: 1,
      gap: 2,
    },
    lineTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    lineTitle: {
      flex: 1,
      fontSize: typography.body,
      fontWeight: '700',
      color: colors.text,
    },
    lineTotal: {
      fontSize: typography.body,
      fontWeight: '800',
      color: colors.text,
    },
    lineBottomRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    lineMeta: {
      flex: 1,
      fontSize: typography.caption,
      color: colors.textMuted,
    },
    lineActions: {
      flexDirection: 'row',
      gap: spacing.xs,
    },
    iconBtn: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    empty: {
      alignItems: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.lg,
    },
    emptyCopy: {
      fontSize: typography.body,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: 20,
    },
    totals: {
      gap: spacing.xs,
      marginTop: spacing.md,
      paddingTop: spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
  });
