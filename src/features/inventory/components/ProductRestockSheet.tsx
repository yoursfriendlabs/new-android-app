import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { productsApi } from '@/src/api';
import { BottomSheet } from '@/src/shared/feedback/BottomSheet';
import { useToast } from '@/src/shared/feedback/ToastProvider';
import { FormField } from '@/src/shared/forms/FormField';
import { DatePickerField } from '@/src/shared/forms/DatePickerField';
import { SegmentedTabs } from '@/src/shared/ui/SegmentedTabs';
import { formatCurrency } from '@/src/shared/lib/format';
import { getCurrentStock, invalidateInventoryQueries } from '@/src/features/inventory/lib/inventory';
import { usePalette } from '@/src/stores/theme-store';
import { radius, spacing, typography } from '@/src/theme';
import type { AppPalette } from '@/src/theme/app-palette';
import { useThemedStyles } from '@/src/theme/use-themed-styles';
import type { Product } from '@/src/types/models';

type RestockAction = 'add' | 'remove';

interface ProductRestockSheetProps {
  visible: boolean;
  product?: Product | null;
  initialAction?: RestockAction;
  onClose: () => void;
}

export function ProductRestockSheet({ initialAction = 'add', onClose, product, visible }: ProductRestockSheetProps) {
  const colors = usePalette();
  const toast = useToast();
  const styles = useThemedStyles(createStyles);
  const queryClient = useQueryClient();
  const [action, setAction] = useState<RestockAction>(initialAction);
  const [quantity, setQuantity] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setAction(initialAction);
      setQuantity('');
      setExpiryDate('');
      setBatchNumber('');
      setNote('');
    }
  }, [visible, product?.id, initialAction]);

  const currentStock = getCurrentStock(product);
  const qty = Number(quantity || 0);
  const nextStock = action === 'remove' ? currentStock - qty : currentStock + qty;
  const unit = product?.primaryUnit || 'unit';

  async function handleSave() {
    if (!product?.id) return;
    if (qty <= 0) {
      toast.error('Enter how much stock to add or remove.');
      return;
    }
    if (action === 'remove' && qty > currentStock) {
      toast.error(`Only ${currentStock} ${unit} on hand.`);
      return;
    }

    setSaving(true);
    try {
      await productsApi.restock(product.id, {
        quantity: qty,
        action,
        unitType: 'primary',
        ...(action === 'add' && expiryDate.trim() ? { expiryDate: expiryDate.trim() } : {}),
        ...(action === 'add' && batchNumber.trim() ? { batchNumber: batchNumber.trim() } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      await invalidateInventoryQueries(queryClient);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet
      visible={visible}
      title={action === 'remove' ? 'Reduce stock' : 'Restock'}
      subtitle={product?.name || 'Add or remove quantity without creating a purchase bill.'}
      onClose={onClose}
      footer={
        <Pressable style={styles.saveButton} onPress={() => void handleSave()} disabled={saving || !product}>
          {saving ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={styles.saveLabel}>{action === 'remove' ? 'Remove stock' : 'Add stock'}</Text>
          )}
        </Pressable>
      }>
      <SegmentedTabs
        value={action}
        onChange={setAction}
        options={[
          { label: 'Add', value: 'add' },
          { label: 'Remove', value: 'remove' },
        ]}
      />

      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { backgroundColor: colors.backgroundAlt }]}>
          <Text style={styles.summaryLabel}>On hand</Text>
          <Text style={[styles.summaryValue, { color: colors.text }]}>
            {currentStock} {unit}
          </Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: nextStock < 0 ? colors.dangerSoft : colors.accentSoft }]}>
          <Text style={styles.summaryLabel}>After</Text>
          <Text style={[styles.summaryValue, { color: nextStock < 0 ? colors.danger : colors.primary }]}>
            {Number.isFinite(nextStock) ? nextStock : currentStock} {unit}
          </Text>
        </View>
      </View>

      <FormField
        label={action === 'remove' ? 'Quantity to remove' : 'Quantity to add'}
        value={quantity}
        onChangeText={setQuantity}
        keyboardType="numeric"
        placeholder="0"
      />
      {action === 'add' ? (
        <>
          <DatePickerField label="Expiry date" value={expiryDate} onChangeText={setExpiryDate} helperText="Optional — tracks this batch's expiry." />
          <FormField label="Batch number" value={batchNumber} onChangeText={setBatchNumber} placeholder="Optional" />
        </>
      ) : null}
      <FormField label="Notes / Remarks" value={note} onChangeText={setNote} placeholder="Optional note" />
      {product?.salePrice ? (
        <Text style={styles.helper}>Selling at {formatCurrency(product.salePrice)} per {unit}.</Text>
      ) : null}
    </BottomSheet>
  );
}

const createStyles = (colors: AppPalette) =>
  StyleSheet.create({
    summaryRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    summaryCard: {
      flex: 1,
      borderRadius: radius.md,
      padding: spacing.md,
      gap: 4,
    },
    summaryLabel: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: colors.textSoft,
    },
    summaryValue: {
      fontSize: typography.subheading,
      fontWeight: '800',
    },
    helper: {
      fontSize: typography.body,
      color: colors.textMuted,
    },
    saveButton: {
      minHeight: 52,
      borderRadius: radius.md,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveLabel: {
      color: colors.onPrimary,
      fontSize: typography.body,
      fontWeight: '800',
    },
  });
