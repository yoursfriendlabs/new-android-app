import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/src/shared/feedback/BottomSheet';
import { FormField } from '@/src/shared/forms/FormField';
import { SegmentedTabs } from '@/src/shared/ui/SegmentedTabs';
import { formatCurrency } from '@/src/shared/lib/format';
import {
  applyUnitTypeToLine,
  lineTotalOf,
  type EditableServiceLine,
} from '@/src/features/services/lib/service-items';
import { usePalette } from '@/src/stores/theme-store';
import { radius, spacing, typography } from '@/src/theme';
import type { AppPalette } from '@/src/theme/app-palette';
import { useThemedStyles } from '@/src/theme/use-themed-styles';
import type { Product } from '@/src/types/models';

interface ServiceLineSheetProps {
  visible: boolean;
  line: EditableServiceLine | null;
  /** The product behind this line, when it is in the catalog we hold. */
  product?: Product | null;
  currency: string;
  isNew: boolean;
  onChange: (line: EditableServiceLine) => void;
  onPickProduct: () => void;
  onRemove?: () => void;
  onClose: () => void;
  onSave: () => void;
}

/** Add or change one line of a job's bill: a service charge or a product. */
export function ServiceLineSheet({
  currency,
  isNew,
  line,
  onChange,
  onClose,
  onPickProduct,
  onRemove,
  onSave,
  product,
  visible,
}: ServiceLineSheetProps) {
  const colors = usePalette();
  const styles = useThemedStyles(createStyles);
  const isPart = line?.itemType === 'part';

  return (
    <BottomSheet
      visible={visible}
      title={isPart ? (isNew ? 'Add product' : 'Product line') : isNew ? 'Add service' : 'Service line'}
      subtitle={isPart ? 'Pick from stock, then set quantity and rate.' : 'What was done, and what it costs.'}
      onClose={onClose}
      compact
      footer={
        <View style={styles.footerRow}>
          {onRemove ? (
            <Pressable style={[styles.footerBtn, { backgroundColor: colors.dangerSoft }]} onPress={onRemove}>
              <Text style={[styles.footerBtnLabel, { color: colors.danger }]}>Remove</Text>
            </Pressable>
          ) : (
            <Pressable style={[styles.footerBtn, { backgroundColor: colors.backgroundAlt }]} onPress={onClose}>
              <Text style={[styles.footerBtnLabel, { color: colors.text }]}>Cancel</Text>
            </Pressable>
          )}
          <Pressable style={[styles.footerBtn, { backgroundColor: colors.primary }]} onPress={onSave}>
            <Text style={[styles.footerBtnLabel, { color: colors.onPrimary }]}>
              {isNew ? 'Add to bill' : 'Done'}
            </Text>
          </Pressable>
        </View>
      }>
      {line ? (
        <View style={styles.body}>
          {isPart ? (
            <View style={styles.pickerWrap}>
              <Pressable style={styles.selector} onPress={onPickProduct}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.selectorTitle}>
                    {line.productName || product?.name || 'Select a product from stock'}
                  </Text>
                  <Text style={styles.selectorSubtitle}>
                    {line.productId
                      ? `${formatCurrency(line.unitPrice, currency)} each${
                          product ? ` · Stock ${product.stockOnHand ?? 0} ${product.primaryUnit}` : ''
                        } · Tap to change`
                      : 'Search your stock by name, brand or code'}
                  </Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textMuted} />
              </Pressable>
              {product?.secondaryUnit ? (
                <SegmentedTabs
                  value={line.unitType === 'secondary' ? 'secondary' : 'primary'}
                  onChange={(unitType) =>
                    onChange(applyUnitTypeToLine(line, unitType as 'primary' | 'secondary', product))
                  }
                  options={[
                    { label: product.primaryUnit, value: 'primary' },
                    { label: product.secondaryUnit, value: 'secondary' },
                  ]}
                />
              ) : null}
            </View>
          ) : null}

          <FormField
            label={isPart ? 'Description' : 'What was done'}
            value={line.description}
            onChangeText={(description) => onChange({ ...line, description })}
            placeholder={isPart ? 'e.g. Spare screen, engine oil' : 'e.g. Screen replacement, servicing'}
          />

          <View style={styles.row}>
            <View style={styles.col}>
              <FormField
                label="Quantity"
                value={String(line.quantity)}
                onChangeText={(value) => onChange({ ...line, quantity: Number(value || 0) })}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.col}>
              <FormField
                label={`Rate (${currency === 'NPR' ? 'रू' : currency})`}
                value={String(line.unitPrice)}
                onChangeText={(value) => onChange({ ...line, unitPrice: Number(value || 0) })}
                keyboardType="numeric"
              />
            </View>
          </View>

          <FormField
            label="Tax rate (%)"
            value={String(line.taxRate)}
            onChangeText={(value) => onChange({ ...line, taxRate: Number(value || 0) })}
            keyboardType="numeric"
            helperText="Leave at 0 if you do not charge VAT on this line."
          />

          <View style={styles.totalBox}>
            <Text style={styles.totalLabel}>Line total</Text>
            <Text style={styles.totalValue}>{formatCurrency(lineTotalOf(line), currency)}</Text>
          </View>
        </View>
      ) : null}
    </BottomSheet>
  );
}

const createStyles = (colors: AppPalette) =>
  StyleSheet.create({
    body: {
      gap: spacing.md,
    },
    pickerWrap: {
      gap: spacing.sm,
    },
    selector: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      backgroundColor: colors.backgroundAlt,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
    },
    selectorTitle: {
      fontSize: typography.body,
      fontWeight: '700',
      color: colors.text,
    },
    selectorSubtitle: {
      fontSize: typography.caption,
      color: colors.textMuted,
    },
    row: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    col: {
      flex: 1,
    },
    totalBox: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceMuted,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
    },
    totalLabel: {
      fontSize: typography.label,
      fontWeight: '700',
      color: colors.textMuted,
    },
    totalValue: {
      fontSize: typography.subheading,
      fontWeight: '800',
      color: colors.primary,
    },
    footerRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    footerBtn: {
      flex: 1,
      minHeight: 50,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    footerBtnLabel: {
      fontSize: typography.body,
      fontWeight: '800',
    },
  });
