import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { productsApi, reportsApi } from '@/src/api';
import { extractListItems, normalizeStockLedgerEntry } from '@/src/api/normalize';
import { BottomSheet } from '@/src/shared/feedback/BottomSheet';
import { FormField } from '@/src/shared/forms/FormField';
import { SegmentedTabs } from '@/src/shared/ui/SegmentedTabs';
import { formatCurrency, prettyDate } from '@/src/shared/lib/format';
import {
  daysUntilExpiry,
  expiryRemainingLabel,
  getCurrentStock,
  getStockStatus,
  getStockStatusMeta,
  invalidateInventoryQueries,
  itemTypeLabel,
  productBrand,
  productInitials,
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
  const [imageError, setImageError] = useState(false);

  // Lot edit state
  const [editLot, setEditLot] = useState<InventoryBatch | null>(null);
  const [editExpiry, setEditExpiry] = useState('');
  const [editBatchNumber, setEditBatchNumber] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Lot exchange state
  const [exchangeLot, setExchangeLot] = useState<InventoryBatch | null>(null);
  const [exchangeBatchNumber, setExchangeBatchNumber] = useState('');
  const [exchangeExpiry, setExchangeExpiry] = useState('');
  const [exchangeQuantity, setExchangeQuantity] = useState('');
  const [exchangeNote, setExchangeNote] = useState('');
  const [savingExchange, setSavingExchange] = useState(false);

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
      setImageError(false);
    }
  }, [initialTab, productId, visible]);

  const status = getStockStatus(product);
  const statusMeta = getStockStatusMeta(status, colors);
  const batches = product?.batches ?? [];
  const unit = product?.primaryUnit || 'unit';
  const totalStock = getCurrentStock(product);
  const expiredQty = Number(product?.expiredQuantity ?? 0);
  const sellableQty = Number(product?.sellableQuantity ?? Math.max(0, totalStock - expiredQty));
  const hasExpired = Boolean(product?.hasExpiredStock) || expiredQty > 0;

  async function saveLotEdit() {
    if (!productId || !editLot?.id) return;
    setSavingEdit(true);
    try {
      await productsApi.updateBatch(productId, editLot.id, {
        expiryDate: editExpiry.trim() || null,
        batchNumber: editBatchNumber.trim() || null,
      });
      await invalidateInventoryQueries(queryClient);
      setEditLot(null);
    } catch (error) {
      Alert.alert('Unable to update lot', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSavingEdit(false);
    }
  }

  async function saveLotExchange() {
    if (!productId || !exchangeLot?.id) return;
    const batchNumber = exchangeBatchNumber.trim();
    const expiry = exchangeExpiry.trim();
    if (!batchNumber || !expiry) {
      Alert.alert('Exchange details required', 'Enter a new batch number and a future expiry date.');
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    if (expiry < today) {
      Alert.alert('Invalid expiry date', 'Replacement expiry must be today or in the future.');
      return;
    }

    setSavingExchange(true);
    try {
      await productsApi.exchangeBatch(productId, exchangeLot.id, {
        batchNumber,
        expiryDate: expiry,
        quantity: exchangeQuantity.trim() ? Number(exchangeQuantity) : undefined,
        note: exchangeNote.trim() || undefined,
      });
      await invalidateInventoryQueries(queryClient);
      setExchangeLot(null);
    } catch (error) {
      Alert.alert('Unable to exchange lot', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSavingExchange(false);
    }
  }

  function confirmDestroyLot(batch: InventoryBatch) {
    Alert.alert(
      'Destroy expired lot?',
      `Write off ${batch.quantityOnHand} ${unit} from batch "${batch.batchNumber || 'Unassigned'}". This will permanently reduce stock on hand.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Destroy lot',
          style: 'destructive',
          onPress: async () => {
            if (!productId) return;
            try {
              await productsApi.destroyBatch(productId, batch.id, {
                quantity: batch.quantityOnHand,
                note: 'Destroyed expired lot from mobile',
              });
              await invalidateInventoryQueries(queryClient);
            } catch (error) {
              Alert.alert('Unable to destroy lot', error instanceof Error ? error.message : 'Please try again.');
            }
          },
        },
      ],
    );
  }

  return (
    <BottomSheet
      visible={visible}
      title={product?.name || 'Product'}
      subtitle={
        [productBrand(product), product?.sku, itemTypeLabel(product?.itemType)].filter(Boolean).join(' · ') ||
        'Catalog details, lots, and stock history.'
      }
      onClose={onClose}
      fullHeight
      footer={
        product ? (
          <View style={styles.footerRow}>
            {onRestock && String(product.itemType || '').toLowerCase() !== 'service' ? (
              <Pressable style={styles.secondaryButton} onPress={() => onRestock(product)}>
                <MaterialCommunityIcons name="plus-box-outline" size={18} color={colors.primary} />
                <Text style={styles.secondaryLabel}>Restock</Text>
              </Pressable>
            ) : null}
            {onEdit ? (
              <Pressable style={styles.primaryButton} onPress={() => onEdit(product)}>
                <MaterialCommunityIcons name="pencil-outline" size={18} color={colors.white} />
                <Text style={styles.primaryLabel}>Edit product</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null
      }>
      {/* Product Image Header */}
      <View style={styles.headerHero}>
        {product?.imageUrl && !imageError ? (
          <Image
            source={{ uri: product.imageUrl.trim() }}
            style={styles.heroImage}
            resizeMode="cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <View style={[styles.heroPlaceholder, { backgroundColor: colors.accentSoft }]}>
            <Text style={[styles.heroInitials, { color: colors.primary }]}>{productInitials(product?.name)}</Text>
          </View>
        )}
      </View>

      <SegmentedTabs
        value={tab}
        onChange={setTab}
        options={[
          { label: 'Overview', value: 'overview' },
          { label: `Lots (${batches.length})`, value: 'lots' },
          { label: 'History', value: 'history' },
        ]}
      />

      {isLoading && !product ? <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} /> : null}

      {/* OVERVIEW TAB */}
      {tab === 'overview' && product ? (
        <View style={styles.section}>
          <View style={styles.statusRow}>
            <View style={[styles.statusPill, { backgroundColor: statusMeta.backgroundColor }]}>
              <Text style={[styles.statusText, { color: statusMeta.color }]}>{statusMeta.label}</Text>
            </View>
            {hasExpired ? (
              <View style={[styles.statusPill, { backgroundColor: colors.dangerSoft }]}>
                <Text style={[styles.statusText, { color: colors.danger }]}>Has expired stock</Text>
              </View>
            ) : null}
          </View>

          {/* Sellable vs Expired Quantity Card */}
          <View style={[styles.stockCard, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
            <View style={styles.stockCardCol}>
              <Text style={styles.stockCardLabel}>Sellable stock</Text>
              <Text style={[styles.stockCardValue, { color: colors.primary }]}>
                {sellableQty} {unit}
              </Text>
            </View>
            {hasExpired ? (
              <View style={styles.stockCardCol}>
                <Text style={[styles.stockCardLabel, { color: colors.danger }]}>Expired stock</Text>
                <Text style={[styles.stockCardValue, { color: colors.danger }]}>
                  {expiredQty} {unit}
                </Text>
              </View>
            ) : (
              <View style={styles.stockCardCol}>
                <Text style={styles.stockCardLabel}>Total on hand</Text>
                <Text style={[styles.stockCardValue, { color: colors.text }]}>
                  {totalStock} {unit}
                </Text>
              </View>
            )}
          </View>

          <DetailRow label="Sale price" value={formatCurrency(product.salePrice)} />
          {product.purchasePrice != null ? (
            <DetailRow label="Purchase price" value={formatCurrency(product.purchasePrice)} />
          ) : null}
          {product.mrpPrice ? <DetailRow label="MRP" value={formatCurrency(product.mrpPrice)} /> : null}
          {product.wholesalePrice ? (
            <DetailRow label="Wholesale price" value={formatCurrency(product.wholesalePrice)} />
          ) : null}
          {product.minWholesaleQuantity ? (
            <DetailRow label="Min wholesale qty" value={String(product.minWholesaleQuantity)} />
          ) : null}
          {product.secondarySalePrice && product.secondaryUnit ? (
            <DetailRow label={`${product.secondaryUnit} price`} value={formatCurrency(product.secondarySalePrice)} />
          ) : null}
          <DetailRow label="Category" value={product.categoryName || 'General'} />
          {product.secondaryUnit ? (
            <DetailRow
              label="Units"
              value={`${product.primaryUnit} / ${product.secondaryUnit}${
                product.secondaryConversionRate ? ` (1 ${product.secondaryUnit} = ${product.secondaryConversionRate} ${product.primaryUnit})` : ''
              }`}
            />
          ) : (
            <DetailRow label="Unit" value={product.primaryUnit} />
          )}
          {product.taxRate != null ? <DetailRow label="Tax rate" value={`${product.taxRate}%`} /> : null}
          {product.metalType ? (
            <DetailRow label="Metal / Purity" value={[product.metalType, product.purity].filter(Boolean).join(' · ')} />
          ) : null}
          {product.expiryDate ? (
            <DetailRow
              label="Nearest expiry"
              value={`${prettyDate(product.expiryDate)} (${expiryRemainingLabel(product.expiryDate)})`}
            />
          ) : null}
          {product.sku ? <DetailRow label="SKU / Item code" value={product.sku} /> : null}
        </View>
      ) : null}

      {/* LOTS TAB */}
      {tab === 'lots' ? (
        <View style={styles.section}>
          {batches.length ? (
            batches.map((batch) => {
              const daysLeft = daysUntilExpiry(batch.expiryDate);
              const isNear = !batch.isExpired && daysLeft != null && daysLeft >= 0 && daysLeft <= 20;
              const cardBorder = batch.isExpired
                ? colors.danger
                : isNear
                  ? colors.info
                  : colors.border;
              const cardBg = batch.isExpired
                ? colors.dangerSoft
                : isNear
                  ? colors.infoSoft
                  : colors.backgroundAlt;

              return (
                <View key={batch.id} style={[styles.lotCard, { borderColor: cardBorder, backgroundColor: cardBg }]}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[styles.lotTitle, { color: colors.text }]}>
                      {batch.batchNumber ? `Batch ${batch.batchNumber}` : 'Unnumbered lot'}
                    </Text>
                    <Text
                      style={[
                        styles.lotMeta,
                        {
                          color: batch.isExpired ? colors.danger : isNear ? colors.info : colors.textMuted,
                          fontWeight: batch.isExpired || isNear ? '700' : '500',
                        },
                      ]}>
                      {batch.expiryDate ? prettyDate(batch.expiryDate) : 'No expiry'}
                      {batch.expiryDate ? ` · ${expiryRemainingLabel(batch.expiryDate)}` : ''}
                    </Text>
                    {batch.note ? <Text style={[styles.lotNote, { color: colors.textMuted }]}>{batch.note}</Text> : null}
                  </View>

                  <Text style={[styles.lotQty, { color: batch.isExpired ? colors.danger : colors.text }]}>
                    {batch.quantityOnHand} {unit}
                  </Text>

                  {/* Actions */}
                  <Pressable
                    style={styles.iconBtn}
                    onPress={() => {
                      setExchangeLot(null);
                      setEditLot(batch);
                      setEditExpiry(String(batch.expiryDate || '').slice(0, 10));
                      setEditBatchNumber(String(batch.batchNumber || ''));
                    }}>
                    <MaterialCommunityIcons color={colors.text} name="pencil-outline" size={18} />
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
                          setExchangeQuantity(String(batch.quantityOnHand));
                          setExchangeNote('');
                        }}>
                        <MaterialCommunityIcons color={colors.primary} name="swap-horizontal" size={20} />
                      </Pressable>
                      <Pressable style={styles.iconBtn} onPress={() => confirmDestroyLot(batch)}>
                        <MaterialCommunityIcons color={colors.danger} name="trash-can-outline" size={18} />
                      </Pressable>
                    </>
                  ) : null}
                </View>
              );
            })
          ) : (
            <View style={styles.emptyCard}>
              <MaterialCommunityIcons name="layers-outline" size={32} color={colors.textMuted} />
              <Text style={styles.emptyCopy}>No open stock lots. Restock with an expiry or batch to track lots.</Text>
            </View>
          )}

          {/* Edit Lot Box */}
          {editLot ? (
            <View style={[styles.actionBox, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
              <Text style={styles.actionBoxTitle}>Edit batch details</Text>
              <FormField
                label="Batch / Lot number"
                value={editBatchNumber}
                onChangeText={setEditBatchNumber}
                placeholder="e.g. LOT-B2"
              />
              <FormField
                label="Expiry date"
                value={editExpiry}
                onChangeText={setEditExpiry}
                placeholder="YYYY-MM-DD"
              />
              <View style={styles.footerRow}>
                <Pressable style={styles.secondaryButton} onPress={() => setEditLot(null)}>
                  <Text style={styles.secondaryLabel}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={styles.primaryButton}
                  onPress={() => void saveLotEdit()}
                  disabled={savingEdit}>
                  {savingEdit ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <Text style={styles.primaryLabel}>Save lot</Text>
                  )}
                </Pressable>
              </View>
            </View>
          ) : null}

          {/* Exchange Lot Box */}
          {exchangeLot ? (
            <View style={[styles.actionBox, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
              <Text style={styles.actionBoxTitle}>Exchange expired lot</Text>
              <Text style={styles.actionBoxSubtitle}>
                Replace expired {exchangeLot.batchNumber ? `batch "${exchangeLot.batchNumber}"` : 'lot'} with a supplier-replaced batch and valid future expiry.
              </Text>
              <FormField
                label="New batch number *"
                value={exchangeBatchNumber}
                onChangeText={setExchangeBatchNumber}
                placeholder="e.g. NEW-LOT-1"
              />
              <FormField
                label="New expiry date * (YYYY-MM-DD)"
                value={exchangeExpiry}
                onChangeText={setExchangeExpiry}
                placeholder="YYYY-MM-DD"
              />
              <FormField
                label="Exchange quantity"
                value={exchangeQuantity}
                onChangeText={setExchangeQuantity}
                keyboardType="numeric"
                placeholder={String(exchangeLot.quantityOnHand)}
              />
              <FormField
                label="Note"
                value={exchangeNote}
                onChangeText={setExchangeNote}
                placeholder="Optional exchange remarks"
              />
              <View style={styles.footerRow}>
                <Pressable style={styles.secondaryButton} onPress={() => setExchangeLot(null)}>
                  <Text style={styles.secondaryLabel}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={styles.primaryButton}
                  onPress={() => void saveLotExchange()}
                  disabled={savingExchange}>
                  {savingExchange ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <Text style={styles.primaryLabel}>Complete exchange</Text>
                  )}
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* HISTORY TAB */}
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
            <View style={styles.emptyCard}>
              <MaterialCommunityIcons name="history" size={32} color={colors.textMuted} />
              <Text style={styles.emptyCopy}>No stock movements recorded for this product yet.</Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </BottomSheet>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  const colors = usePalette();
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 12,
        paddingVertical: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.border,
      }}>
      <Text style={{ color: colors.textSoft, fontSize: typography.body }}>{label}</Text>
      <Text
        style={{
          color: colors.text,
          fontSize: typography.body,
          fontWeight: '700',
          flexShrink: 1,
          textAlign: 'right',
        }}>
        {value}
      </Text>
    </View>
  );
}

const createStyles = (colors: AppPalette) =>
  StyleSheet.create({
    headerHero: {
      alignItems: 'center',
      justifyContent: 'center',
      marginVertical: spacing.sm,
    },
    heroImage: {
      width: 100,
      height: 100,
      borderRadius: radius.lg,
    },
    heroPlaceholder: {
      width: 100,
      height: 100,
      borderRadius: radius.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroInitials: {
      fontSize: 28,
      fontWeight: '800',
    },
    section: {
      gap: spacing.sm,
      paddingBottom: spacing.lg,
    },
    statusRow: {
      flexDirection: 'row',
      gap: spacing.xs,
      flexWrap: 'wrap',
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
    stockCard: {
      flexDirection: 'row',
      borderRadius: radius.md,
      borderWidth: 1,
      padding: spacing.md,
      gap: spacing.md,
      marginVertical: spacing.xs,
    },
    stockCardCol: {
      flex: 1,
      gap: 2,
    },
    stockCardLabel: {
      fontSize: 11,
      fontWeight: '800',
      textTransform: 'uppercase',
      color: colors.textSoft,
    },
    stockCardValue: {
      fontSize: typography.subheading,
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
    lotNote: {
      fontSize: 11,
      fontStyle: 'italic',
    },
    lotQty: {
      fontSize: typography.body,
      fontWeight: '800',
    },
    iconBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    actionBox: {
      borderWidth: 1,
      borderRadius: radius.lg,
      padding: spacing.md,
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    actionBoxTitle: {
      fontSize: typography.body,
      fontWeight: '800',
      color: colors.text,
    },
    actionBoxSubtitle: {
      fontSize: typography.caption,
      color: colors.textMuted,
      lineHeight: 18,
    },
    historyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderRadius: radius.md,
      padding: spacing.md,
    },
    emptyCard: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.xl,
      gap: spacing.xs,
    },
    emptyCopy: {
      fontSize: typography.body,
      color: colors.textMuted,
      lineHeight: 22,
      textAlign: 'center',
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
      flexDirection: 'row',
      gap: 6,
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
      flexDirection: 'row',
      gap: 6,
    },
    primaryLabel: {
      color: colors.white,
      fontWeight: '800',
    },
  });
