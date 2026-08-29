import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { productsApi, reportsApi } from '@/src/api';
import { extractListItems, normalizeStockLedgerEntry } from '@/src/api/normalize';
import { BottomSheet } from '@/src/shared/feedback/BottomSheet';
import { FormField } from '@/src/shared/forms/FormField';
import { SegmentedTabs } from '@/src/shared/ui/SegmentedTabs';
import { formatCurrency, prettyDate } from '@/src/shared/lib/format';
import {
  expiryRemainingLabel,
  getCurrentStock,
  getStockStatus,
  getStockStatusMeta,
  invalidateInventoryQueries,
  itemTypeLabel,
  productBrand,
} from '@/src/features/inventory/lib/inventory';
import { useProductById } from '@/src/shared/hooks/useAppQueries';
import { usePalette } from '@/src/stores/theme-store';
import { radius, spacing, typography } from '@/src/theme';
import type { AppPalette } from '@/src/theme/app-palette';
import { useThemedStyles } from '@/src/theme/use-themed-styles';
import type { InventoryBatch, Product, StockLedgerEntry } from '@/src/types/models';

type DetailTab = 'overview' | 'lots' | 'history';

interface ProductDetailSheetProps {
  visible: boolean;
  productId?: string | null;
  productHint?: Product | null;
  initialTab?: DetailTab;
  onClose: () => void;
  onEdit?: (product: Product) => void;
  onRestock?: (product: Product) => void;
}

export function ProductDetailSheet({
  initialTab = 'overview',
  onClose,
  onEdit,
  onRestock,
  productHint,
  productId,
  visible,
}: ProductDetailSheetProps) {
  const colors = usePalette();
  const styles = useThemedStyles(createStyles);
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<DetailTab>(initialTab);
  const [editLot, setEditLot] = useState<InventoryBatch | null>(null);
  const [editExpiry, setEditExpiry] = useState('');
  const [exchangeLot, setExchangeLot] = useState<InventoryBatch | null>(null);
  const [exchangeBatchNumber, setExchangeBatchNumber] = useState('');
  const [exchangeExpiry, setExchangeExpiry] = useState('');
  const { data: detail, isLoading } = useProductById(visible ? productId ?? undefined : undefined);
  const product = detail ?? productHint ?? null;
  const historyQuery = useQuery({
    queryKey: ['stock-ledger', productId],
    enabled: visible && tab === 'history' && Boolean(productId),
    queryFn: async () => {
      const response = await reportsApi.stockLedger({ productId: productId ?? undefined, limit: 40 });
      return extractListItems<StockLedgerEntry>(response).map(normalizeStockLedgerEntry).filter((item) => item.id);
    },
  });

  useEffect(() => {
    if (visible) {
      setTab(initialTab);
      setEditLot(null);
      setExchangeLot(null);
    }
  }, [initialTab, productId, visible]);

  const status = getStockStatus(product);
  const statusMeta = getStockStatusMeta(status, colors);
  const batches = product?.batches ?? [];
  const unit = product?.primaryUnit || 'unit';

  async function saveLotExpiry() {
    if (!productId || !editLot?.id) return;
    try {
      await productsApi.updateBatch(productId, editLot.id, { expiryDate: editExpiry || null });
      await invalidateInventoryQueries(queryClient);
      setEditLot(null);
    } catch (error) {
      Alert.alert('Unable to update lot', error instanceof Error ? error.message : 'Please try again.');
    }
  }

  async function saveLotExchange() {
    if (!productId || !exchangeLot?.id) return;
    const batchNumber = exchangeBatchNumber.trim();
    if (!batchNumber || !exchangeExpiry) {
      Alert.alert('Exchange details required', 'Enter a new batch number and a future expiry date.');
      return;
    }
    try {
      await productsApi.exchangeBatch(productId, exchangeLot.id, { batchNumber, expiryDate: exchangeExpiry });
      await invalidateInventoryQueries(queryClient);
      setExchangeLot(null);
    } catch (error) {
      Alert.alert('Unable to exchange lot', error instanceof Error ? error.message : 'Please try again.');
    }
  }

  function confirmDestroyLot(batch: InventoryBatch) {
    Alert.alert('Destroy this lot?', 'Expired or unused stock will be written off.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Destroy',
        style: 'destructive',
        onPress: async () => {
          if (!productId) return;
          try {
            await productsApi.destroyBatch(productId, batch.id);
            await invalidateInventoryQueries(queryClient);
          } catch (error) {
            Alert.alert('Unable to destroy lot', error instanceof Error ? error.message : 'Please try again.');
          }
        },
      },
    ]);
  }

  return (
    <BottomSheet
      visible={visible}
      title={product?.name || 'Product'}
      subtitle={[productBrand(product), product?.sku, itemTypeLabel(product?.itemType)].filter(Boolean).join(' · ') || 'Catalog details, lots, and stock history.'}
      onClose={onClose}
      fullHeight
      footer={
        product ? (
          <View style={styles.footerRow}>
            {onRestock && String(product.itemType || '').toLowerCase() !== 'service' ? (
              <Pressable style={styles.secondaryButton} onPress={() => onRestock(product)}>
                <Text style={styles.secondaryLabel}>Restock</Text>
              </Pressable>
            ) : null}
            {onEdit ? (
              <Pressable style={styles.primaryButton} onPress={() => onEdit(product)}>
                <Text style={styles.primaryLabel}>Edit</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null
      }>
      <SegmentedTabs
        value={tab}
        onChange={setTab}
        options={[
          { label: 'Details', value: 'overview' },
          { label: 'Lots', value: 'lots' },
          { label: 'History', value: 'history' },
        ]}
      />

      {isLoading && !product ? <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} /> : null}

      {tab === 'overview' && product ? (
        <View style={styles.section}>
          <View style={[styles.statusPill, { backgroundColor: statusMeta.backgroundColor }]}>
            <Text style={[styles.statusText, { color: statusMeta.color }]}>{statusMeta.label}</Text>
          </View>
          <DetailRow label="Stock" value={`${getCurrentStock(product)} ${unit}`} />
          {product.hasExpiredStock ? (
            <DetailRow label="Expired qty" value={String(product.expiredQuantity ?? 0)} />
          ) : null}
          <DetailRow label="Sale price" value={formatCurrency(product.salePrice)} />
          {product.purchasePrice ? <DetailRow label="Purchase price" value={formatCurrency(product.purchasePrice)} /> : null}
          {product.mrpPrice ? <DetailRow label="MRP" value={formatCurrency(product.mrpPrice)} /> : null}
          {product.wholesalePrice ? <DetailRow label="Wholesale" value={formatCurrency(product.wholesalePrice)} /> : null}
          {product.secondarySalePrice && product.secondaryUnit ? (
            <DetailRow label={`${product.secondaryUnit} price`} value={formatCurrency(product.secondarySalePrice)} />
          ) : null}
          {product.minWholesaleQuantity ? <DetailRow label="Min wholesale qty" value={String(product.minWholesaleQuantity)} /> : null}
          <DetailRow label="Category" value={product.categoryName || 'General'} />
          {product.secondaryUnit ? (
            <DetailRow
              label="Units"
              value={`${product.primaryUnit} / ${product.secondaryUnit}${product.secondaryConversionRate ? ` (${product.secondaryConversionRate})` : ''}`}
            />
          ) : (
            <DetailRow label="Unit" value={product.primaryUnit} />
          )}
          {product.taxRate != null ? <DetailRow label="Tax" value={`${product.taxRate}%`} /> : null}
          {product.metalType ? <DetailRow label="Metal" value={[product.metalType, product.purity].filter(Boolean).join(' · ')} /> : null}
          {product.expiryDate ? <DetailRow label="Nearest expiry" value={prettyDate(product.expiryDate)} /> : null}
        </View>
      ) : null}

      {tab === 'lots' ? (
        <View style={styles.section}>
          {batches.length ? (
            batches.map((batch) => (
              <View
                key={batch.id}
                style={[
                  styles.lotCard,
                  { borderColor: batch.isExpired ? colors.danger : colors.border, backgroundColor: batch.isExpired ? colors.dangerSoft : colors.backgroundAlt },
                ]}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[styles.lotTitle, { color: colors.text }]}>
                    {batch.batchNumber ? `Batch ${batch.batchNumber}` : 'No batch no.'}
                  </Text>
                  <Text style={[styles.lotMeta, { color: batch.isExpired ? colors.danger : colors.textMuted }]}>
                    {batch.expiryDate ? prettyDate(batch.expiryDate) : 'No expiry'}
                    {expiryRemainingLabel(batch.expiryDate) ? ` · ${expiryRemainingLabel(batch.expiryDate)}` : ''}
                  </Text>
                </View>
                <Text style={[styles.lotQty, { color: colors.text }]}>
                  {batch.quantityOnHand} {unit}
                </Text>
                <Pressable
                  style={styles.iconBtn}
                  onPress={() => {
                    setExchangeLot(null);
                    setEditLot(batch);
                    setEditExpiry(String(batch.expiryDate || '').slice(0, 10));
                  }}>
                  <MaterialCommunityIcons color={colors.textMuted} name="pencil-outline" size={18} />
                </Pressable>
                {batch.isExpired ? (
                  <>
                    <Pressable
                      style={styles.iconBtn}
                      onPress={() => {
                        setEditLot(null);
                        setExchangeLot(batch);
                        setExchangeBatchNumber('');
                        setExchangeExpiry('');
                      }}>
                      <MaterialCommunityIcons color={colors.primary} name="swap-horizontal" size={18} />
                    </Pressable>
                    <Pressable style={styles.iconBtn} onPress={() => confirmDestroyLot(batch)}>
                      <MaterialCommunityIcons color={colors.danger} name="trash-can-outline" size={18} />
                    </Pressable>
                  </>
                ) : null}
              </View>
            ))
          ) : (
            <Text style={styles.emptyCopy}>No stock lots yet. Restock with an expiry or batch to start tracking lots.</Text>
          )}
          {editLot ? (
            <View style={styles.editLotBox}>
              <FormField label="Lot expiry" value={editExpiry} onChangeText={setEditExpiry} placeholder="YYYY-MM-DD" />
              <View style={styles.footerRow}>
                <Pressable style={styles.secondaryButton} onPress={() => setEditLot(null)}>
                  <Text style={styles.secondaryLabel}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.primaryButton} onPress={() => void saveLotExpiry()}>
                  <Text style={styles.primaryLabel}>Save expiry</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
          {exchangeLot ? (
            <View style={styles.editLotBox}>
              <Text style={[styles.lotTitle, { color: colors.text }]}>Exchange expired lot</Text>
              <Text style={[styles.lotMeta, { color: colors.textMuted }]}>
                Replace {exchangeLot.batchNumber ? `batch ${exchangeLot.batchNumber}` : 'this lot'} with a new batch and future expiry.
              </Text>
              <FormField label="New batch number" value={exchangeBatchNumber} onChangeText={setExchangeBatchNumber} placeholder="Required" />
              <FormField label="New expiry" value={exchangeExpiry} onChangeText={setExchangeExpiry} placeholder="YYYY-MM-DD" />
              <View style={styles.footerRow}>
                <Pressable style={styles.secondaryButton} onPress={() => setExchangeLot(null)}>
                  <Text style={styles.secondaryLabel}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.primaryButton} onPress={() => void saveLotExchange()}>
                  <Text style={styles.primaryLabel}>Exchange lot</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>
      ) : null}

      {tab === 'history' ? (
        <View style={styles.section}>
          {historyQuery.isLoading ? <ActivityIndicator color={colors.primary} /> : null}
          {(historyQuery.data ?? []).map((entry) => {
            const qty = Number(entry.quantityChange || 0);
            const add = qty > 0;
            return (
              <View key={entry.id} style={[styles.historyRow, { backgroundColor: colors.backgroundAlt }]}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[styles.lotTitle, { color: colors.text }]}>
                    {String(entry.refType || 'adjustment').replace(/_/g, ' ')}
                  </Text>
                  <Text style={[styles.lotMeta, { color: colors.textMuted }]}>
                    {entry.createdAt ? prettyDate(entry.createdAt) : ''}
                    {entry.note ? `  ·  ${entry.note}` : ''}
                  </Text>
                </View>
                <Text style={[styles.lotQty, { color: add ? colors.success : colors.danger }]}>
                  {add ? '+' : ''}
                  {qty}
                </Text>
              </View>
            );
          })}
          {!historyQuery.isLoading && !(historyQuery.data ?? []).length ? (
            <Text style={styles.emptyCopy}>No stock movements recorded for this product yet.</Text>
          ) : null}
        </View>
      ) : null}
    </BottomSheet>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  const colors = usePalette();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }}>
      <Text style={{ color: colors.textSoft, fontSize: typography.body }}>{label}</Text>
      <Text style={{ color: colors.text, fontSize: typography.body, fontWeight: '700', flexShrink: 1, textAlign: 'right' }}>{value}</Text>
    </View>
  );
}

const createStyles = (colors: AppPalette) =>
  StyleSheet.create({
    section: {
      gap: spacing.sm,
      paddingBottom: spacing.lg,
    },
    statusPill: {
      alignSelf: 'flex-start',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radius.pill,
    },
    statusText: {
      fontSize: 11,
      fontWeight: '800',
    },
    lotCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderWidth: 1,
      borderRadius: radius.md,
      padding: spacing.md,
    },
    lotTitle: {
      fontSize: typography.body,
      fontWeight: '700',
      textTransform: 'capitalize',
    },
    lotMeta: {
      fontSize: typography.caption,
    },
    lotQty: {
      fontSize: typography.body,
      fontWeight: '800',
    },
    iconBtn: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    editLotBox: {
      gap: spacing.sm,
      paddingTop: spacing.sm,
    },
    historyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderRadius: radius.md,
      padding: spacing.md,
    },
    emptyCopy: {
      fontSize: typography.body,
      color: colors.textMuted,
      lineHeight: 22,
      textAlign: 'center',
      paddingVertical: spacing.lg,
    },
    footerRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    secondaryButton: {
      flex: 1,
      minHeight: 50,
      borderRadius: radius.md,
      backgroundColor: colors.backgroundAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondaryLabel: {
      color: colors.text,
      fontWeight: '800',
    },
    primaryButton: {
      flex: 1,
      minHeight: 50,
      borderRadius: radius.md,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryLabel: {
      color: colors.white,
      fontWeight: '800',
    },
  });
