import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { productsApi } from '@/src/api';
import { BottomSheet } from '@/src/shared/feedback/BottomSheet';
import { FormField } from '@/src/shared/forms/FormField';
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
  onClose: () => void;
}

export function ProductRestockSheet({ onClose, product, visible }: ProductRestockSheetProps) {
  const colors = usePalette();
  const styles = useThemedStyles(createStyles);
  const queryClient = useQueryClient();
  const [action, setAction] = useState<RestockAction>('add');
  const [quantity, setQuantity] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setAction('add');
      setQuantity('');
      setExpiryDate('');
      setBatchNumber('');
    }
  }, [visible, product?.id]);

  const currentStock = getCurrentStock(product);
  const qty = Number(quantity || 0);
  const nextStock = action === 'remove' ? currentStock - qty : currentStock + qty;
  const unit = product?.primaryUnit || 'unit';

  async function handleSave() {
    if (!product?.id) return;
    if (qty <= 0) {
      Alert.alert('Quantity required', 'Enter how much stock to add or remove.');
      return;
    }
    if (action === 'remove' && qty > currentStock) {
      Alert.alert('Not enough stock', `Only ${currentStock} ${unit} on hand.`);
      return;
    }

    setSaving(true);
    try {
      await productsApi.restock(product.id, {
        quantity: qty,
        action,
        unitType: 'primary',
        ...(action === 'add' && expiryDate ? { expiryDate } : {}),
        ...(action === 'add' && batchNumber.trim() ? { batchNumber: batchNumber.trim() } : {}),
      });
      await invalidateInventoryQueries(queryClient);
      onClose();
    } catch (error) {
      Alert.alert('Unable to update stock', error instanceof Error ? error.message : 'Please try again.');
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
            <ActivityIndicator color={colors.white} />
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
          <FormField label="Expiry date" value={expiryDate} onChangeText={setExpiryDate} placeholder="YYYY-MM-DD" />
          <FormField label="Batch number" value={batchNumber} onChangeText={setBatchNumber} placeholder="Optional" />
        </>
      ) : null}
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
      color: colors.white,
      fontSize: typography.body,
      fontWeight: '800',
    },
  });
