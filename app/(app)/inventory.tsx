import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { productsApi } from '@/src/api';
import { ActionSheet, type ActionSheetItem } from '@/src/shared/feedback/ActionSheet';
import { ProductDetailSheet } from '@/src/features/inventory/components/ProductDetailSheet';
import { ProductFormSheet } from '@/src/features/inventory/components/ProductFormSheet';
import { ProductRestockSheet } from '@/src/features/inventory/components/ProductRestockSheet';
import { Screen } from '@/src/shared/layout/Screen';
import { SearchField } from '@/src/shared/ui/SearchField';
import { SegmentedTabs } from '@/src/shared/ui/SegmentedTabs';
import { StickyActionBar } from '@/src/shared/ui/StickyActionBar';
import { Avatar } from '@/src/shared/ui/Avatar';
import { formatCurrency, prettyDate } from '@/src/shared/lib/format';
import {
  daysUntilExpiry,
  expiryRemainingLabel,
  getCurrentStock,
  getStockStatus,
  getStockStatusMeta,
  invalidateInventoryQueries,
  isNearExpiryProduct,
  isRestockableProduct,
  itemTypeLabel,
  productBrand,
} from '@/src/features/inventory/lib/inventory';
import { useDebouncedValue } from '@/src/shared/hooks/useDebouncedValue';
import {
  useInventorySummary,
  useLowStockProducts,
  useProductStats,
  useProducts,
} from '@/src/shared/hooks/useAppQueries';
import { radius, shadows, spacing, typography } from '@/src/theme';
import type { Product } from '@/src/types/models';
import { useAuthStore } from '@/src/stores/auth-store';
import { usePalette } from '@/src/stores/theme-store';
import { useThemedStyles } from '@/src/theme/use-themed-styles';
import type { AppPalette } from '@/src/theme/app-palette';

type StockFilter = 'all' | 'low' | 'out' | 'expiring' | 'expired';
type DetailTab = 'overview' | 'lots' | 'history';

export default function InventoryScreen() {
  const colors = usePalette();
  const styles = useThemedStyles(createStyles);
  const queryClient = useQueryClient();
  const currency = useAuthStore((state) => state.businessProfile?.currencyCode) || 'NPR';
  const [search, setSearch] = useState('');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [category, setCategory] = useState('All');
  const [createVisible, setCreateVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [restockProduct, setRestockProduct] = useState<Product | null>(null);
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>('overview');
  const [menuProduct, setMenuProduct] = useState<Product | null>(null);
  const debouncedSearch = useDebouncedValue(search);
  const productsQuery = useProducts(debouncedSearch);
  const statsQuery = useProductStats();
  const summaryQuery = useInventorySummary();
  const lowStockQuery = useLowStockProducts();
  const products = productsQuery.data ?? [];
  const summary = summaryQuery.data;
  const stats = statsQuery.data;

  const categories = useMemo(() => {
    const names = Array.from(
      new Set(products.map((product) => product.categoryName?.trim()).filter(Boolean) as string[]),
    ).sort((a, b) => a.localeCompare(b));
    return ['All', ...names];
  }, [products]);

  const visibleProducts = useMemo(() => {
    return products.filter((product) => {
      const status = getStockStatus(product);
      if (stockFilter === 'low' && status !== 'low') return false;
      if (stockFilter === 'out' && status !== 'out') return false;
      if (stockFilter === 'expiring' && !isNearExpiryProduct(product)) return false;
      if (stockFilter === 'expired' && status !== 'expired' && !product.hasExpiredStock) return false;
      if (category !== 'All' && (product.categoryName || 'General') !== category) return false;
      return true;
    });
  }, [category, products, stockFilter]);

  const lowStockPreview = (lowStockQuery.data ?? []).slice(0, 3);
  const localExpiringCount = products.filter(isNearExpiryProduct).length;
  const localExpiredCount = products.filter((product) => getStockStatus(product) === 'expired' || product.hasExpiredStock).length;

  function openDetail(product: Product, tab: DetailTab = 'overview') {
    setDetailTab(tab);
    setDetailProduct(product);
  }

  function productActions(product: Product): ActionSheetItem[] {
    return [
      {
        id: 'view',
        label: 'View details',
        icon: 'eye-outline',
        onPress: () => openDetail(product, 'overview'),
      },
      ...(isRestockableProduct(product)
        ? [
            {
              id: 'restock',
              label: 'Restock',
              icon: 'plus-box-outline' as const,
              onPress: () => setRestockProduct(product),
            },
          ]
        : []),
      {
        id: 'edit',
        label: 'Edit',
        icon: 'pencil-outline',
        onPress: () => setEditingProduct(product),
      },
      {
        id: 'lots',
        label: 'Stock lots',
        icon: 'layers-outline',
        onPress: () => openDetail(product, 'lots'),
      },
      {
        id: 'history',
        label: 'History',
        icon: 'history',
        onPress: () => openDetail(product, 'history'),
      },
      {
        id: 'delete',
        label: 'Delete',
        icon: 'trash-can-outline',
        tone: 'danger',
        onPress: () => confirmDelete(product),
      },
    ];
  }

  function confirmDelete(product: Product) {
    Alert.alert('Delete this product?', `"${product.name}" will be removed from the catalog.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await productsApi.remove(product.id);
            await invalidateInventoryQueries(queryClient);
          } catch (error) {
            Alert.alert('Unable to delete', error instanceof Error ? error.message : 'Please try again.');
          }
        },
      },
    ]);
  }

  async function handleRefresh() {
    await Promise.all([
      productsQuery.refetch(),
      statsQuery.refetch(),
      summaryQuery.refetch(),
      lowStockQuery.refetch(),
    ]);
  }

  return (
    <Screen
      scrollable={false}
      padded={false}
      topBarTitle="Inventory"
      footer={<StickyActionBar primary={{ label: 'New product', onPress: () => setCreateVisible(true) }} />}>
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={productsQuery.isRefetching} onRefresh={() => void handleRefresh()} />}
        contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Products, stock alerts, restock, lots, and history — with live lot expiry tracking.
          </Text>
        </View>

        {/* STATS TOP ROW */}
        <View style={styles.summaryRow}>
          <Pressable
            onPress={() => setStockFilter('all')}
            style={[
              styles.summaryCard,
              { backgroundColor: stockFilter === 'all' ? colors.accentSoft : colors.surface, borderColor: stockFilter === 'all' ? colors.primary : colors.border },
            ]}>
            <Text style={[styles.summaryLabel, { color: colors.primary }]}>Products</Text>
            <Text style={[styles.summaryValue, { color: colors.primary }]}>
              {String(summary?.totalProducts ?? products.length)}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setStockFilter('low')}
            style={[
              styles.summaryCard,
              { backgroundColor: stockFilter === 'low' ? colors.warningSoft : colors.surface, borderColor: stockFilter === 'low' ? colors.warning : colors.border },
            ]}>
            <Text style={[styles.summaryLabel, { color: colors.warning }]}>Low</Text>
            <Text style={[styles.summaryValue, { color: colors.warning }]}>
              {String(stats?.lowStockCount ?? summary?.lowStockCount ?? lowStockQuery.data?.length ?? 0)}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setStockFilter('out')}
            style={[
              styles.summaryCard,
              { backgroundColor: stockFilter === 'out' ? colors.dangerSoft : colors.surface, borderColor: stockFilter === 'out' ? colors.danger : colors.border },
            ]}>
            <Text style={[styles.summaryLabel, { color: colors.danger }]}>Out</Text>
            <Text style={[styles.summaryValue, { color: colors.danger }]}>
              {String(summary?.outOfStockCount ?? 0)}
            </Text>
          </Pressable>
        </View>

        {/* STATS BOTTOM ROW */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.summaryLabel, { color: colors.textSoft }]}>Stock value</Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>
              {formatCurrency(Number(summary?.totalStockValue ?? 0), currency)}
            </Text>
          </View>
          <Pressable
            onPress={() => setStockFilter('expiring')}
            style={[
              styles.summaryCard,
              { backgroundColor: stockFilter === 'expiring' ? colors.infoSoft : colors.surface, borderColor: stockFilter === 'expiring' ? colors.info : colors.border },
            ]}>
            <Text style={[styles.summaryLabel, { color: colors.info }]}>Expiring</Text>
            <Text style={[styles.summaryValue, { color: colors.info }]}>
              {String(stats?.nearExpiryCount ?? summary?.nearExpiryCount ?? localExpiringCount)}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setStockFilter('expired')}
            style={[
              styles.summaryCard,
              { backgroundColor: stockFilter === 'expired' ? colors.dangerSoft : colors.surface, borderColor: stockFilter === 'expired' ? colors.danger : colors.border },
            ]}>
            <Text style={[styles.summaryLabel, { color: colors.danger }]}>Expired</Text>
            <Text style={[styles.summaryValue, { color: colors.danger }]}>
              {String(stats?.expiredCount ?? localExpiredCount)}
            </Text>
          </Pressable>
        </View>

        {lowStockPreview.length ? (
          <View style={[styles.alertCard, { backgroundColor: colors.warningSoft, borderColor: colors.border }]}>
            <Text style={[styles.alertTitle, { color: colors.warning }]}>Needs attention</Text>
            {lowStockPreview.map((product) => (
              <Pressable key={product.id} style={styles.alertRow} onPress={() => openDetail(product)}>
                <Text style={[styles.alertName, { color: colors.text }]} numberOfLines={1}>
                  {product.name}
                </Text>
                <Text style={[styles.alertStock, { color: colors.danger }]}>
                  {getCurrentStock(product)} {product.primaryUnit}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <SearchField placeholder="Search name, brand, SKU, or category" value={search} onChangeText={setSearch} />
        <SegmentedTabs
          value={stockFilter}
          onChange={setStockFilter}
          options={[
            { label: 'All', value: 'all' },
            { label: 'Low', value: 'low' },
            { label: 'Out', value: 'out' },
            { label: 'Expiring', value: 'expiring' },
            { label: 'Expired', value: 'expired' },
          ]}
        />
        {categories.length > 1 ? (
          <SegmentedTabs
            value={category}
            onChange={setCategory}
            options={categories.map((name) => ({ label: name, value: name }))}
          />
        ) : null}

        {/* LOADING INDICATOR */}
        {productsQuery.isLoading && !products.length ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading inventory...</Text>
          </View>
        ) : null}

        {/* EMPTY STATE */}
        {!productsQuery.isLoading && !visibleProducts.length ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.accentSoft }]}>
              <MaterialCommunityIcons name="package-variant-closed" size={28} color={colors.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {products.length ? 'No matching products' : 'No products yet'}
            </Text>
            <Text style={[styles.emptyCopy, { color: colors.textMuted }]}>
              {products.length
                ? 'Try a different search or stock filter.'
                : 'Add your first item with photo, unit, opening stock, and price.'}
            </Text>
          </View>
        ) : null}

        {/* PRODUCT LIST */}
        <View style={styles.list}>
          {visibleProducts.map((product) => {
            const status = getStockStatus(product);
            const meta = getStockStatusMeta(status, colors);
            const brand = productBrand(product);
            const restockable = isRestockableProduct(product);
            const currentStock = getCurrentStock(product);
            const expiredQty = Number(product.expiredQuantity ?? 0);
            const sellableQty = Number(product.sellableQuantity ?? Math.max(0, currentStock - expiredQty));
            const daysLeft = daysUntilExpiry(product.expiryDate);
            const isNear = !product.hasExpiredStock && daysLeft != null && daysLeft >= 0 && daysLeft <= 20;

            return (
              <View key={product.id} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Pressable
                  onPress={() => openDetail(product)}
                  onLongPress={() => setMenuProduct(product)}
                  style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
                  {/* Thumbnail */}
                  <Avatar
                    uri={product.imageUrl}
                    name={product.name}
                    size={46}
                    shape="rounded"
                    backgroundColor={colors.accentSoft}
                    textColor={colors.primary}
                  />

                  <View style={styles.rowCopy}>
                    <View style={styles.nameRow}>
                      <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
                        {product.name}
                      </Text>
                      <View style={[styles.badge, { backgroundColor: meta.backgroundColor }]}>
                        <Text style={[styles.badgeText, { color: meta.color }]}>{meta.label}</Text>
                      </View>
                    </View>

                    <Text style={[styles.rowMeta, { color: colors.textMuted }]} numberOfLines={1}>
                      {[brand || product.categoryName || 'General', itemTypeLabel(product.itemType), product.sku]
                        .filter(Boolean)
                        .join('  ·  ')}
                    </Text>

                    {/* Expiry badge if present */}
                    {product.expiryDate ? (
                      <View style={styles.expiryBadgeRow}>
                        <MaterialCommunityIcons
                          name="clock-outline"
                          size={12}
                          color={status === 'expired' ? colors.danger : isNear ? colors.info : colors.textMuted}
                        />
                        <Text
                          style={[
                            styles.expiryBadgeText,
                            {
                              color: status === 'expired' ? colors.danger : isNear ? colors.info : colors.textMuted,
                              fontWeight: status === 'expired' || isNear ? '700' : '500',
                            },
                          ]}>
                          {prettyDate(product.expiryDate)}
                          {expiryRemainingLabel(product.expiryDate) ? ` (${expiryRemainingLabel(product.expiryDate)})` : ''}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.amountWrap}>
                    <Text style={[styles.amount, { color: colors.text }]}>
                      {formatCurrency(product.salePrice, currency)}
                    </Text>
                    {product.hasExpiredStock ? (
                      <View style={{ alignItems: 'flex-end', gap: 1 }}>
                        <Text style={[styles.stockText, { color: colors.primary, fontWeight: '800' }]}>
                          {sellableQty} {product.primaryUnit}
                        </Text>
                        <Text style={[styles.stockSubText, { color: colors.danger }]}>
                          {expiredQty} expired
                        </Text>
                      </View>
                    ) : (
                      <Text style={[styles.stockText, { color: status === 'ok' ? colors.textSoft : meta.color }]}>
                        {currentStock} {product.primaryUnit}
                      </Text>
                    )}
                  </View>
                </Pressable>

                {/* Card Action Row */}
                <View style={[styles.actionRow, { borderTopColor: colors.border }]}>
                  <Pressable style={styles.actionBtn} onPress={() => openDetail(product, 'overview')}>
                    <MaterialCommunityIcons color={colors.text} name="eye-outline" size={16} />
                    <Text style={[styles.actionLabel, { color: colors.text }]}>View</Text>
                  </Pressable>
                  {restockable ? (
                    <Pressable style={styles.actionBtn} onPress={() => setRestockProduct(product)}>
                      <MaterialCommunityIcons color={colors.primary} name="plus-box-outline" size={16} />
                      <Text style={[styles.actionLabel, { color: colors.primary }]}>Restock</Text>
                    </Pressable>
                  ) : null}
                  <Pressable style={styles.actionBtn} onPress={() => setEditingProduct(product)}>
                    <MaterialCommunityIcons color={colors.text} name="pencil-outline" size={16} />
                    <Text style={[styles.actionLabel, { color: colors.text }]}>Edit</Text>
                  </Pressable>
                  <Pressable style={styles.actionBtn} onPress={() => setMenuProduct(product)}>
                    <MaterialCommunityIcons color={colors.textMuted} name="dots-horizontal" size={16} />
                    <Text style={[styles.actionLabel, { color: colors.textMuted }]}>More</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      <ActionSheet
        visible={Boolean(menuProduct)}
        title={menuProduct?.name}
        subtitle="Catalog actions"
        onClose={() => setMenuProduct(null)}
        actions={menuProduct ? productActions(menuProduct) : []}
      />

      <ProductFormSheet
        visible={createVisible}
        onClose={() => setCreateVisible(false)}
        onOpenDetail={(created) => openDetail(created)}
      />
      <ProductFormSheet
        visible={Boolean(editingProduct)}
        product={editingProduct}
        onClose={() => setEditingProduct(null)}
      />
      <ProductRestockSheet
        visible={Boolean(restockProduct)}
        product={restockProduct}
        onClose={() => setRestockProduct(null)}
      />
      <ProductDetailSheet
        visible={Boolean(detailProduct)}
        productId={detailProduct?.id}
        productHint={detailProduct}
        initialTab={detailTab}
        onClose={() => setDetailProduct(null)}
        onEdit={(product) => {
          setDetailProduct(null);
          setTimeout(() => setEditingProduct(product), 280);
        }}
        onRestock={(product) => {
          setDetailProduct(null);
          setTimeout(() => setRestockProduct(product), 280);
        }}
      />
    </Screen>
  );
}

const createStyles = (_colors: AppPalette) =>
  StyleSheet.create({
    scroll: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.xxl,
      gap: spacing.md,
    },
    hero: {
      gap: spacing.xs,
    },
    title: {
      fontSize: typography.hero,
      fontWeight: '800',
      letterSpacing: -0.4,
    },
    subtitle: {
      fontSize: typography.body,
      lineHeight: 22,
    },
    summaryRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    summaryCard: {
      flex: 1,
      borderRadius: radius.md,
      borderWidth: 1,
      padding: spacing.md,
      gap: 4,
    },
    summaryLabel: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    summaryValue: {
      fontSize: typography.subheading,
      fontWeight: '800',
    },
    alertCard: {
      borderRadius: radius.lg,
      borderWidth: 1,
      padding: spacing.md,
      gap: spacing.sm,
    },
    alertTitle: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    alertRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    alertName: {
      flex: 1,
      fontSize: typography.body,
      fontWeight: '700',
    },
    alertStock: {
      fontSize: typography.body,
      fontWeight: '800',
    },
    loadingWrap: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.xl,
      gap: spacing.sm,
    },
    loadingText: {
      fontSize: typography.caption,
      fontWeight: '600',
    },
    list: {
      gap: spacing.sm,
    },
    card: {
      borderRadius: radius.lg,
      borderWidth: 1,
      overflow: 'hidden',
      ...shadows.card,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      padding: spacing.md,
    },
    rowPressed: {
      opacity: 0.92,
    },
    rowCopy: {
      flex: 1,
      gap: 3,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    rowTitle: {
      flexShrink: 1,
      fontSize: typography.body,
      fontWeight: '700',
    },
    rowMeta: {
      fontSize: typography.label,
    },
    expiryBadgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 2,
    },
    expiryBadgeText: {
      fontSize: 11,
    },
    badge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radius.pill,
    },
    badgeText: {
      fontSize: 10,
      fontWeight: '800',
    },
    amountWrap: {
      alignItems: 'flex-end',
      gap: 2,
    },
    amount: {
      fontSize: typography.body,
      fontWeight: '800',
    },
    stockText: {
      fontSize: typography.label,
      fontWeight: '700',
    },
    stockSubText: {
      fontSize: 10,
      fontWeight: '700',
    },
    actionRow: {
      flexDirection: 'row',
      borderTopWidth: StyleSheet.hairlineWidth,
    },
    actionBtn: {
      flex: 1,
      minHeight: 42,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
    },
    actionLabel: {
      fontSize: 12,
      fontWeight: '800',
    },
    emptyCard: {
      alignItems: 'center',
      borderRadius: radius.lg,
      borderWidth: 1,
      padding: spacing.xl,
      gap: spacing.sm,
    },
    emptyIcon: {
      width: 56,
      height: 56,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyTitle: {
      fontSize: typography.subheading,
      fontWeight: '800',
    },
    emptyCopy: {
      fontSize: typography.body,
      textAlign: 'center',
      lineHeight: 22,
    },
  });
