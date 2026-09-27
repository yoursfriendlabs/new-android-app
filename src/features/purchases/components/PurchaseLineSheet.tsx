import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  applyUnitTypeToLine,
  lineTotalOf,
  lineUnitLabel,
} from '@/src/features/purchases/lib/purchase-draft';
import { BottomSheet } from '@/src/shared/feedback/BottomSheet';
import { FormField } from '@/src/shared/forms/FormField';
import { formatCurrency } from '@/src/shared/lib/format';
import { SegmentedTabs } from '@/src/shared/ui/SegmentedTabs';
import { Text } from '@/src/shared/ui/Text';
import { usePalette } from '@/src/stores/theme-store';
import { radius, spacing } from '@/src/theme';
import type { AppPalette } from '@/src/theme/app-palette';
import { useThemedStyles } from '@/src/theme/use-themed-styles';
import type { DraftPurchaseLine } from '@/src/types/forms';

interface PurchaseLineSheetProps {
  visible: boolean;
  line: DraftPurchaseLine | null;
  isNew: boolean;
  currency: string;
  onChange: (line: DraftPurchaseLine) => void;
  onPickProduct: () => void;
  onRemove?: () => void;
  onClose: () => void;
  onSave: () => void;
}

/** Add or change one line of a purchase bill: what came in, how much, at what cost. */
export function PurchaseLineSheet({
  currency,
  isNew,
  line,
  onChange,
  onClose,
  onPickProduct,
  onRemove,
  onSave,
  visible,
}: PurchaseLineSheetProps) {
  const colors = usePalette();
  const styles = useThemedStyles(createStyles);
  const [batchOpen, setBatchOpen] = useState(false);
  const product = line?.product ?? null;
  const hasBatchDetails = Boolean(line?.expiryDate?.trim() || line?.batchNumber?.trim());

  return (
    <BottomSheet
      visible={visible}
      title={isNew ? 'Add item' : 'Bill line'}
      subtitle="Pick the product, then set how many came in and what each one cost."
      onClose={onClose}
      compact
      footer={
        <View style={styles.footer}>
          <View style={styles.footerTotal}>
            <Text variant="caption" tone="muted">
              Line total
            </Text>
            <Text variant="numeric">{formatCurrency(line ? lineTotalOf(line) : 0, currency)}</Text>
          </View>
          <View style={styles.footerActions}>
            {onRemove ? (
              <Pressable style={[styles.footerBtn, { backgroundColor: colors.dangerSoft }]} onPress={onRemove}>
                <Text variant="bodyStrong" tone="danger">
                  Remove
                </Text>
              </Pressable>
            ) : (
              <Pressable style={[styles.footerBtn, { backgroundColor: colors.backgroundAlt }]} onPress={onClose}>
                <Text variant="bodyStrong">Cancel</Text>
              </Pressable>
            )}
            <Pressable style={[styles.footerBtn, styles.footerPrimary, { backgroundColor: colors.primary }]} onPress={onSave}>
              <Text variant="bodyStrong" tone="onPrimary">
                {isNew ? 'Add to bill' : 'Done'}
              </Text>
            </Pressable>
          </View>
        </View>
      }>
      {line ? (
        <View style={styles.body}>
          <Pressable style={styles.selector} onPress={onPickProduct}>
            <View style={styles.selectorCopy}>
              <Text variant="bodyStrong" numberOfLines={1}>
                {product?.name ?? 'Pick a product from stock'}
              </Text>
              <Text variant="caption" tone="muted" numberOfLines={2}>
                {product
                  ? `In stock ${product.stockOnHand ?? 0} ${product.primaryUnit} · last cost ${formatCurrency(
                      Number(product.purchasePrice ?? product.salePrice),
                      currency,
                    )} · tap to change`
                  : 'Search by name, brand or code — or leave it out for a one-off item'}
              </Text>
            </View>
            <MaterialCommunityIcons color={colors.textMuted} name="chevron-right" size={22} />
          </Pressable>

          {product?.secondaryUnit ? (
            <SegmentedTabs
              value={line.unitType === 'secondary' ? 'secondary' : 'primary'}
              onChange={(unitType) => onChange(applyUnitTypeToLine(line, unitType, product))}
              options={[
                { label: product.primaryUnit, value: 'primary' },
                { label: product.secondaryUnit, value: 'secondary' },
              ]}
            />
          ) : null}

          <FormField
            label="Description"
            value={line.description}
            onChangeText={(description) => onChange({ ...line, description })}
            placeholder={product ? 'Anything to note about this line' : 'e.g. Packing charge, sacks'}
          />

          <View style={styles.row}>
            <View style={styles.col}>
              <FormField
                label={`Quantity (${lineUnitLabel(line)})`}
                value={String(line.quantity)}
                onChangeText={(value) => onChange({ ...line, quantity: Number(value || 0) })}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={styles.col}>
              <FormField
                label="Unit cost"
                value={String(line.unitPrice)}
                onChangeText={(value) => onChange({ ...line, unitPrice: Number(value || 0) })}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          <FormField
            label="Tax rate (%)"
            value={String(line.taxRate)}
            onChangeText={(value) => onChange({ ...line, taxRate: Number(value || 0) })}
            keyboardType="decimal-pad"
            helperText="Leave at 0 if this item carries no VAT."
          />

          {batchOpen || hasBatchDetails ? (
            <View style={styles.row}>
              <View style={styles.col}>
                <FormField
                  label="Expiry date"
                  value={line.expiryDate ?? ''}
                  onChangeText={(expiryDate) => onChange({ ...line, expiryDate })}
                  placeholder="YYYY-MM-DD"
                />
              </View>
              <View style={styles.col}>
                <FormField
                  label="Batch / lot"
                  value={line.batchNumber ?? ''}
                  onChangeText={(batchNumber) => onChange({ ...line, batchNumber })}
                  placeholder="Optional"
                />
              </View>
            </View>
          ) : (
            <Pressable style={styles.moreToggle} onPress={() => setBatchOpen(true)}>
              <MaterialCommunityIcons color={colors.primary} name="plus-circle-outline" size={18} />
              <Text variant="label" tone="primary">
                Add expiry or batch number
              </Text>
            </Pressable>
          )}
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
    selector: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceMuted,
      padding: spacing.md,
    },
    selectorCopy: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    row: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    col: {
      flex: 1,
      minWidth: 0,
    },
    moreToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.xs,
    },
    footer: {
      gap: spacing.sm,
    },
    footerTotal: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    footerActions: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    footerBtn: {
      flex: 1,
      minHeight: 48,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    footerPrimary: {
      flex: 2,
    },
  });
