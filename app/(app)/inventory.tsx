import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { productsApi } from '@/src/api';
import { ActionSheet, type ActionSheetItem } from '@/src/shared/feedback/ActionSheet';
import { ProductDetailSheet } from '@/src/features/inventory/components/ProductDetailSheet';
import { ProductFormSheet } from '@/src/features/inventory/components/ProductFormSheet';
import { ProductRestockSheet } from '@/src/features/inventory/components/ProductRestockSheet';
import { Screen } from '@/src/shared/layout/Screen';
import { SearchField } from '@/src/shared/ui/SearchField';
import { SegmentedTabs } from '@/src/shared/ui/SegmentedTabs';
import { StickyActionBar } from '@/src/shared/ui/StickyActionBar';
import { formatCurrency } from '@/src/shared/lib/format';
import {
  getCurrentStock,
  getStockStatus,
  getStockStatusMeta,
  invalidateInventoryQueries,
  isNearExpiryProduct,
  isRestockableProduct,
  itemTypeLabel,
  productBrand,
  productInitials,
} from '@/src/features/inventory/lib/inventory';
import { useDebouncedValue } from '@/src/shared/hooks/useDebouncedValue';
import { useInventorySummary, useLowStockProducts, useProducts } from '@/src/shared/hooks/useAppQueries';
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
  const summaryQuery = useInventorySummary();
  const lowStockQuery = useLowStockProducts();
  const products = productsQuery.data ?? [];
  const summary = summaryQuery.data;

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
  const expiringCount = products.filter(isNearExpiryProduct).length;
  const expiredCount = products.filter((product) => getStockStatus(product) === 'expired' || product.hasExpiredStock).length;

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
    await Promise.all([productsQuery.refetch(), summaryQuery.refetch(), lowStockQuery.refetch()]);
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
            Products, stock alerts, restock, lots, and history — the same catalog actions as on web.
          </Text>
        </View>

        <View style={styles.summaryRow}>
          <Pressable
            onPress={() => setStockFilter('all')}
            style={[styles.summaryCard, { backgroundColor: colors.accentSoft, borderColor: colors.border }]}>
            <Text style={[styles.summaryLabel, { color: colors.primary }]}>Products</Text>
            <Text style={[styles.summaryValue, { color: colors.primary }]}>
              {String(summary?.totalProducts ?? products.length)}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setStockFilter('low')}
            style={[styles.summaryCard, { backgroundColor: colors.warningSoft, borderColor: colors.border }]}>
            <Text style={[styles.summaryLabel, { color: colors.warning }]}>Low</Text>
            <Text style={[styles.summaryValue, { color: colors.warning }]}>
              {String(summary?.lowStockCount ?? lowStockQuery.data?.length ?? 0)}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setStockFilter('out')}
            style={[styles.summaryCard, { backgroundColor: colors.dangerSoft, borderColor: colors.border }]}>
            <Text style={[styles.summaryLabel, { color: colors.danger }]}>Out</Text>
            <Text style={[styles.summaryValue, { color: colors.danger }]}>{String(summary?.outOfStockCount ?? 0)}</Text>
          </Pressable>
        </View>
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.summaryLabel, { color: colors.textSoft }]}>Stock value</Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>
              {formatCurrency(Number(summary?.totalStockValue ?? 0), currency)}
            </Text>
          </View>
          <Pressable
            onPress={() => setStockFilter('expiring')}
            style={[styles.summaryCard, { backgroundColor: colors.infoSoft, borderColor: colors.border }]}>
            <Text style={[styles.summaryLabel, { color: colors.info }]}>Expiring</Text>
            <Text style={[styles.summaryValue, { color: colors.info }]}>
              {String(summary?.nearExpiryCount ?? expiringCount)}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setStockFilter('expired')}
            style={[styles.summaryCard, { backgroundColor: colors.dangerSoft, borderColor: colors.border }]}>
            <Text style={[styles.summaryLabel, { color: colors.danger }]}>Expired</Text>
            <Text style={[styles.summaryValue, { color: colors.danger }]}>{String(expiredCount)}</Text>
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
                : 'Add your first item with price, unit, and opening stock.'}
            </Text>
          </View>
        ) : null}

        <View style={styles.list}>
          {visibleProducts.map((product) => {
            const status = getStockStatus(product);
            const meta = getStockStatusMeta(status, colors);
            const brand = productBrand(product);
            const restockable = isRestockableProduct(product);
            return (
              <View key={product.id} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Pressable
                  onPress={() => openDetail(product)}
                  onLongPress={() => setMenuProduct(product)}
                  style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
                  <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                    <Text style={[styles.avatarText, { color: colors.white }]}>{productInitials(product.name)}</Text>
                  </View>
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
                  </View>
                  <View style={styles.amountWrap}>
                    <Text style={[styles.amount, { color: colors.text }]}>{formatCurrency(product.salePrice, currency)}</Text>
                    <Text style={[styles.rowMeta, { color: status === 'ok' ? colors.textSoft : meta.color }]}>
                      {getCurrentStock(product)} {product.primaryUnit}
                    </Text>
                  </View>
                </Pressable>
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

      <ProductFormSheet visible={createVisible} onClose={() => setCreateVisible(false)} />
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
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      fontSize: 13,
      fontWeight: '800',
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
