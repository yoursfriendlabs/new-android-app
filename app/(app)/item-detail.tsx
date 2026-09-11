import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { productsApi, reportsApi } from '@/src/api';
import { extractListItems, normalizeStockLedgerEntry } from '@/src/api/normalize';
import { ActionSheet } from '@/src/shared/feedback/ActionSheet';
import { useConfirm } from '@/src/shared/feedback/ConfirmProvider';
import { useToast } from '@/src/shared/feedback/ToastProvider';
import { FormField } from '@/src/shared/forms/FormField';
import { DatePickerField } from '@/src/shared/forms/DatePickerField';
import { Avatar } from '@/src/shared/ui/Avatar';
import { Screen } from '@/src/shared/layout/Screen';
import { SegmentedTabs } from '@/src/shared/ui/SegmentedTabs';
import { StickyActionBar } from '@/src/shared/ui/StickyActionBar';
import { ProductRestockSheet } from '@/src/features/inventory/components/ProductRestockSheet';
import { formatCurrency, prettyDate } from '@/src/shared/lib/format';
import {
  canManageExpiryBatch,
  expiryRemainingLabel,
  getCurrentStock,
  getExpiryLevel,
  getExpiryLevelMeta,
  getStockStatus,
  getStockStatusMeta,
  invalidateInventoryQueries,
  productBrand,
} from '@/src/features/inventory/lib/inventory';
import { useProductById } from '@/src/shared/hooks/useAppQueries';
import { useAuthStore } from '@/src/stores/auth-store';
import { usePalette } from '@/src/stores/theme-store';
import { radius, shadows, spacing, typography } from '@/src/theme';
import type { AppPalette } from '@/src/theme/app-palette';
import { useThemedStyles } from '@/src/theme/use-themed-styles';
import type { InventoryBatch, StockLedgerEntry } from '@/src/types/models';

type DetailTab = 'activity' | 'details';

function readNum(source: Record<string, unknown> | null | undefined, keys: string[]): number {
  if (!source) return 0;
  for (const key of keys) {
    const value = Number(source[key]);
    if (Number.isFinite(value) && value !== 0) return value;
  }
  return 0;
}

export default function ItemDetailScreen() {
  const { id, tab: tabParam } = useLocalSearchParams<{ id?: string; tab?: string }>();
  const colors = usePalette();
  const toast = useToast();
  const confirm = useConfirm();
  const styles = useThemedStyles(createStyles);
  const queryClient = useQueryClient();
  const currency = useAuthStore((state) => state.businessProfile?.currencyCode) || 'NPR';

  const [tab, setTab] = useState<DetailTab>(tabParam === 'details' ? 'details' : 'activity');
  const [menuVisible, setMenuVisible] = useState(false);
  const [restockAction, setRestockAction] = useState<'add' | 'remove' | null>(null);

  const [editLot, setEditLot] = useState<InventoryBatch | null>(null);
  const [editExpiry, setEditExpiry] = useState('');
  const [editBatchNumber, setEditBatchNumber] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const [exchangeLot, setExchangeLot] = useState<InventoryBatch | null>(null);
  const [exchangeBatchNumber, setExchangeBatchNumber] = useState('');
  const [exchangeExpiry, setExchangeExpiry] = useState('');
  const [exchangeQuantity, setExchangeQuantity] = useState('');
  const [exchangeNote, setExchangeNote] = useState('');
  const [savingExchange, setSavingExchange] = useState(false);

  const { data: product, isLoading } = useProductById(id);

  const historyQuery = useQuery({
    queryKey: ['stock-ledger', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const response = await reportsApi.stockLedger({ productId: id ?? undefined, limit: 40 });
      return extractListItems<StockLedgerEntry>(response).map(normalizeStockLedgerEntry).filter((item) => item.id);
    },
  });

  const status = getStockStatus(product);
  const statusMeta = getStockStatusMeta(status, colors);
  const batches = product?.batches ?? [];
  const unit = product?.primaryUnit || 'unit';
  const totalStock = getCurrentStock(product);
  const expiredQty = Number(product?.expiredQuantity ?? 0);
  const sellableQty = Number(product?.sellableQuantity ?? Math.max(0, totalStock - expiredQty));
  const hasExpired = Boolean(product?.hasExpiredStock) || expiredQty > 0;

  const record = product as Record<string, unknown> | null;
  const salesTotal = readNum(record, ['salesTotal', 'totalSales', 'salesValue', 'soldValue']);
  const purchaseTotal = readNum(record, ['purchaseTotal', 'totalPurchases', 'purchaseValue']);
  const stockValue =
    readNum(record, ['stockValue', 'totalStockValue']) ||
    totalStock * Number(product?.purchasePrice || product?.salePrice || 0);

  async function handleDelete() {
    if (!product) return;
    const confirmed = await confirm({
      title: 'Delete this item?',
      message: `"${product.name}" will be removed from the catalog.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!confirmed || !id) return;
    try {
      await productsApi.remove(id);
      await invalidateInventoryQueries(queryClient);
      toast.success(`${product.name} deleted`);
      router.back();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not delete this item.');
    }
  }

  async function saveLotEdit() {
    if (!id || !editLot?.id) return;
    setSavingEdit(true);
    try {
      await productsApi.updateBatch(id, editLot.id, {
        expiryDate: editExpiry.trim() || null,
        batchNumber: editBatchNumber.trim() || null,
      });
      await invalidateInventoryQueries(queryClient);
      setEditLot(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSavingEdit(false);
    }
  }

  async function saveLotExchange() {
    if (!id || !exchangeLot?.id) return;
    const batchNumber = exchangeBatchNumber.trim();
    const expiry = exchangeExpiry.trim();
    if (!batchNumber || !expiry) {
      toast.error('Enter a new batch number and a future expiry date.');
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    if (expiry < today) {
      toast.error('Replacement expiry must be today or in the future.');
      return;
    }
    setSavingExchange(true);
    try {
      await productsApi.exchangeBatch(id, exchangeLot.id, {
        batchNumber,
        expiryDate: expiry,
        quantity: exchangeQuantity.trim() ? Number(exchangeQuantity) : undefined,
        note: exchangeNote.trim() || undefined,
      });
      await invalidateInventoryQueries(queryClient);
      setExchangeLot(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSavingExchange(false);
    }
  }

  async function confirmDestroyLot(batch: InventoryBatch) {
    const confirmed = await confirm({
      title: 'Write off this lot?',
      message: `Write off ${batch.quantityOnHand} ${unit} from batch "${batch.batchNumber || 'Unassigned'}". Stock on hand drops for good.`,
      confirmLabel: 'Write off',
      destructive: true,
    });
    if (!confirmed || !id) return;
    try {
      await productsApi.destroyBatch(id, batch.id, {
        quantity: batch.quantityOnHand,
        note: 'Destroyed expired lot from mobile',
      });
      await invalidateInventoryQueries(queryClient);
      toast.success('Expired lot written off');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not destroy this lot.');
    }
  }

  return (
    <Screen
      scrollable
      topBarTitle=" "
      topBarRight={
        product ? (
          <Pressable onPress={() => setMenuVisible(true)} hitSlop={8} style={styles.kebab}>
            <MaterialCommunityIcons name="dots-vertical" size={22} color={colors.text} />
          </Pressable>
        ) : undefined
      }
      footer={
        product ? (
          <StickyActionBar
            secondary={{ label: 'Reduce Stock', tone: 'danger', onPress: () => setRestockAction('remove') }}
            primary={{ label: 'Add Stock', tone: 'primary', onPress: () => setRestockAction('add') }}
          />
        ) : undefined
      }>
      {isLoading && !product ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      ) : null}

      {product ? (
        <>
          {/* HEADER */}
          <View style={styles.header}>
            <Avatar
              uri={product.imageUrl}
              name={product.name}
              size={54}
              shape="rounded"
              backgroundColor={colors.accentSoft}
              textColor={colors.primary}
            />
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                {product.name}
              </Text>
              <Text style={[styles.qty, { color: colors.textMuted }]}>
                Qty: <Text style={{ color: colors.text, fontWeight: '800' }}>{sellableQty} {unit}</Text>
                {hasExpired ? <Text style={{ color: colors.danger }}>  ·  {expiredQty} expired</Text> : null}
              </Text>
            </View>
            <View style={[styles.categoryChip, { backgroundColor: colors.backgroundAlt }]}>
              <Text style={[styles.categoryChipText, { color: colors.textSoft }]} numberOfLines={1}>
                {product.categoryName || 'General'}
              </Text>
            </View>
          </View>

          <View style={[styles.statusPill, { backgroundColor: statusMeta.backgroundColor, alignSelf: 'flex-start' }]}>
            <Text style={[styles.statusText, { color: statusMeta.color }]}>{statusMeta.label}</Text>
          </View>

          {/* TILES */}
          <View style={styles.tilesRow}>
            <Tile label="Sales" value={formatCurrency(salesTotal, currency)} styles={styles} />
            <Tile label="Purchase" value={formatCurrency(purchaseTotal, currency)} styles={styles} />
            <Tile label="Stock Value" value={formatCurrency(stockValue, currency)} styles={styles} />
          </View>

          <SegmentedTabs
            value={tab}
            onChange={setTab}
            options={[
              { label: 'Item Activity', value: 'activity' },
              { label: 'Item Details', value: 'details' },
            ]}
          />

          {/* ITEM ACTIVITY */}
          {tab === 'activity' ? (
            <View style={styles.section}>
              {historyQuery.isLoading ? <ActivityIndicator color={colors.primary} /> : null}
              {(historyQuery.data ?? []).map((entry) => {
                const qty = Number(entry.quantityChange || 0);
                const add = qty > 0;
                const stockAfter = readNum(entry as Record<string, unknown>, [
                  'balanceAfter',
                  'stockAfter',
                  'runningStock',
                  'balance',
                  'stockOnHand',
                ]);
                return (
                  <View key={entry.id} style={[styles.activityCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={{ flex: 1, gap: 3 }}>
                      <Text style={[styles.activityTitle, { color: colors.text }]}>
                        {String(entry.refType || 'adjustment').replace(/_/g, ' ')}
                      </Text>
                      <Text style={[styles.activityMeta, { color: colors.textMuted }]}>
                        {entry.createdAt ? prettyDate(entry.createdAt) : ''}
                        {entry.note ? `  ·  ${entry.note}` : ''}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <Text style={[styles.activityQty, { color: add ? colors.success : colors.danger }]}>
                        {add ? '+ ' : '- '}
                        {Math.abs(qty)} {unit}
                      </Text>
                      {stockAfter ? (
                        <View style={[styles.stockBadge, { backgroundColor: colors.successSoft }]}>
                          <Text style={[styles.stockBadgeText, { color: colors.success }]}>
                            Stock: {stockAfter} {unit}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                );
              })}
              {!historyQuery.isLoading && !(historyQuery.data ?? []).length ? (
                <EmptyBlock icon="history" copy="No stock movements recorded for this item yet." styles={styles} colors={colors} />
              ) : null}
            </View>
          ) : null}

          {/* ITEM DETAILS */}
          {tab === 'details' ? (
            <View style={styles.section}>
              <DetailRow label="Sale price" value={formatCurrency(product.salePrice, currency)} />
              {product.purchasePrice != null ? (
                <DetailRow label="Purchase price" value={formatCurrency(product.purchasePrice, currency)} />
              ) : null}
              {product.mrpPrice ? <DetailRow label="MRP" value={formatCurrency(product.mrpPrice, currency)} /> : null}
              {product.wholesalePrice ? (
                <DetailRow label="Wholesale price" value={formatCurrency(product.wholesalePrice, currency)} />
              ) : null}
              {product.secondaryUnit ? (
                <DetailRow
                  label="Units"
                  value={`${product.primaryUnit} / ${product.secondaryUnit}${
                    product.secondaryConversionRate
                      ? ` (1 ${product.secondaryUnit} = ${product.secondaryConversionRate} ${product.primaryUnit})`
                      : ''
                  }`}
                />
              ) : (
                <DetailRow label="Unit" value={product.primaryUnit} />
              )}
              {product.taxRate != null ? <DetailRow label="Tax rate" value={`${product.taxRate}%`} /> : null}
              {productBrand(product) ? <DetailRow label="Brand" value={productBrand(product)} /> : null}
              {product.metalType ? (
                <DetailRow label="Metal / Purity" value={[product.metalType, product.purity].filter(Boolean).join(' · ')} />
              ) : null}
              {product.sku ? <DetailRow label="Item code" value={product.sku} /> : null}
              {product.barcode ? <DetailRow label="Barcode" value={product.barcode} /> : null}

              {/* LOTS */}
              <Text style={styles.sectionLabel}>Stock lots ({batches.length})</Text>
              {batches.length ? (
                batches.map((batch) => {
                  const level = getExpiryLevel(batch.expiryDate, batch.isExpired);
                  const meta = getExpiryLevelMeta(level, colors);
                  const manageable = canManageExpiryBatch(batch);
                  return (
                    <View key={batch.id} style={[styles.lotCard, { borderColor: meta.borderColor, backgroundColor: meta.backgroundColor }]}>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={[styles.lotTitle, { color: colors.text }]}>
                          {batch.batchNumber ? `Batch ${batch.batchNumber}` : 'Unnumbered lot'}
                        </Text>
                        <Text
                          style={[
                            styles.lotMeta,
                            {
                              color: level === 'none' ? colors.textMuted : meta.color,
                              fontWeight: level === 'none' ? '500' : '700',
                            },
                          ]}>
                          {batch.expiryDate ? prettyDate(batch.expiryDate) : 'No expiry'}
                          {batch.expiryDate ? ` · ${expiryRemainingLabel(batch.expiryDate)}` : ''}
                        </Text>
                      </View>
                      <Text style={[styles.lotQty, { color: level === 'danger' || level === 'expired' ? colors.danger : colors.text }]}>
                        {batch.quantityOnHand} {unit}
                      </Text>
                      <Pressable
                        style={[styles.iconBtn, { backgroundColor: colors.surface }]}
                        onPress={() => {
                          setExchangeLot(null);
                          setEditLot(batch);
                          setEditExpiry(String(batch.expiryDate || '').slice(0, 10));
                          setEditBatchNumber(String(batch.batchNumber || ''));
                        }}>
                        <MaterialCommunityIcons color={colors.text} name="pencil-outline" size={18} />
                      </Pressable>
                      {manageable ? (
                        <>
                          <Pressable
                            style={[styles.iconBtn, { backgroundColor: colors.surface }]}
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
                          <Pressable style={[styles.iconBtn, { backgroundColor: colors.surface }]} onPress={() => void confirmDestroyLot(batch)}>
                            <MaterialCommunityIcons color={colors.danger} name="trash-can-outline" size={18} />
                          </Pressable>
                        </>
                      ) : null}
                    </View>
                  );
                })
              ) : (
                <EmptyBlock icon="layers-outline" copy="No open stock lots. Add stock with an expiry or batch to track lots." styles={styles} colors={colors} />
              )}

              {editLot ? (
                <View style={[styles.actionBox, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
                  <Text style={styles.actionBoxTitle}>Edit batch details</Text>
                  <FormField label="Batch / Lot number" value={editBatchNumber} onChangeText={setEditBatchNumber} placeholder="e.g. LOT-B2" />
                  <DatePickerField label="Expiry date" value={editExpiry} onChangeText={setEditExpiry} />
                  <View style={styles.footerRow}>
                    <Pressable style={styles.secondaryButton} onPress={() => setEditLot(null)}>
                      <Text style={styles.secondaryLabel}>Cancel</Text>
                    </Pressable>
                    <Pressable style={styles.primaryButton} onPress={() => void saveLotEdit()} disabled={savingEdit}>
                      {savingEdit ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={styles.primaryLabel}>Save lot</Text>}
                    </Pressable>
                  </View>
                </View>
              ) : null}

              {exchangeLot ? (
                <View style={[styles.actionBox, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
                  <Text style={styles.actionBoxTitle}>Exchange lot</Text>
                  <Text style={styles.actionBoxSubtitle}>
                    Replace {exchangeLot.batchNumber ? `batch "${exchangeLot.batchNumber}"` : 'this lot'} with a supplier-replaced batch and a valid future expiry.
                  </Text>
                  <FormField label="New batch number *" value={exchangeBatchNumber} onChangeText={setExchangeBatchNumber} placeholder="e.g. NEW-LOT-1" />
                  <DatePickerField label="New expiry date *" value={exchangeExpiry} onChangeText={setExchangeExpiry} />
                  <FormField
                    label="Exchange quantity"
                    value={exchangeQuantity}
                    onChangeText={setExchangeQuantity}
                    keyboardType="numeric"
                    placeholder={String(exchangeLot.quantityOnHand)}
                  />
                  <FormField label="Note" value={exchangeNote} onChangeText={setExchangeNote} placeholder="Optional exchange remarks" />
                  <View style={styles.footerRow}>
                    <Pressable style={styles.secondaryButton} onPress={() => setExchangeLot(null)}>
                      <Text style={styles.secondaryLabel}>Cancel</Text>
                    </Pressable>
                    <Pressable style={styles.primaryButton} onPress={() => void saveLotExchange()} disabled={savingExchange}>
                      {savingExchange ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={styles.primaryLabel}>Complete exchange</Text>}
                    </Pressable>
                  </View>
                </View>
              ) : null}
            </View>
          ) : null}
        </>
      ) : null}

      <ActionSheet
        visible={menuVisible}
        title={product?.name}
        subtitle="Item actions"
        onClose={() => setMenuVisible(false)}
        actions={[
          {
            id: 'edit',
            label: 'Edit item',
            icon: 'pencil-outline',
            onPress: () => router.push({ pathname: '/(app)/item-form' as any, params: { id: id ?? '' } }),
          },
          {
            id: 'delete',
            label: 'Delete item',
            icon: 'trash-can-outline',
            tone: 'danger',
            onPress: () => void handleDelete(),
          },
        ]}
      />

      <ProductRestockSheet
        visible={Boolean(restockAction)}
        product={product}
        initialAction={restockAction ?? 'add'}
        onClose={() => setRestockAction(null)}
      />
    </Screen>
  );
}

function Tile({ label, value, styles }: { label: string; value: string; styles: ReturnType<typeof createStyles> }) {
  const colors = usePalette();
  return (
    <View style={styles.tile}>
      <Text style={[styles.tileLabel, { color: colors.textSoft }]}>{label}</Text>
      <Text style={[styles.tileValue, { color: colors.text }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
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
      <Text style={{ color: colors.text, fontSize: typography.body, fontWeight: '700', flexShrink: 1, textAlign: 'right' }}>
        {value}
      </Text>
    </View>
  );
}

function EmptyBlock({
  icon,
  copy,
  styles,
  colors,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  copy: string;
  styles: ReturnType<typeof createStyles>;
  colors: AppPalette;
}) {
  return (
    <View style={styles.emptyCard}>
      <MaterialCommunityIcons name={icon} size={32} color={colors.textMuted} />
      <Text style={[styles.emptyCopy, { color: colors.textMuted }]}>{copy}</Text>
    </View>
  );
}

const createStyles = (colors: AppPalette) =>
  StyleSheet.create({
    kebab: {
      width: 34,
      height: 34,
      alignItems: 'center',
      justifyContent: 'center',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    name: {
      fontSize: typography.subheading,
      fontWeight: '800',
    },
    qty: {
      fontSize: typography.body,
    },
    categoryChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      borderRadius: radius.md,
      maxWidth: 120,
    },
    categoryChipText: {
      fontSize: typography.label,
      fontWeight: '700',
    },
    statusPill: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radius.pill,
    },
    statusText: {
      fontSize: 11,
      fontWeight: '800',
    },
    tilesRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    tile: {
      flex: 1,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: spacing.md,
      gap: 4,
    },
    tileLabel: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.4,
      textTransform: 'uppercase',
    },
    tileValue: {
      fontSize: typography.body,
      fontWeight: '800',
    },
    section: {
      gap: spacing.sm,
      paddingBottom: spacing.lg,
    },
    sectionLabel: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: colors.textSoft,
      marginTop: spacing.md,
    },
    activityCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderRadius: radius.md,
      borderWidth: 1,
      padding: spacing.md,
      ...shadows.card,
    },
    activityTitle: {
      fontSize: typography.body,
      fontWeight: '700',
      textTransform: 'capitalize',
    },
    activityMeta: {
      fontSize: typography.caption,
    },
    activityQty: {
      fontSize: typography.body,
      fontWeight: '800',
    },
    stockBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radius.sm,
    },
    stockBadgeText: {
      fontSize: 11,
      fontWeight: '700',
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
    },
    lotMeta: {
      fontSize: typography.caption,
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
    emptyCard: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.xl,
      gap: spacing.xs,
    },
    emptyCopy: {
      fontSize: typography.body,
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
      color: colors.onPrimary,
      fontWeight: '800',
    },
  });
