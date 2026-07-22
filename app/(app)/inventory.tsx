import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import { productsApi } from '@/src/api';
import { BottomSheet } from '@/src/components/feedback/BottomSheet';
import { FormField } from '@/src/components/forms/FormField';
import { Screen } from '@/src/components/layout/Screen';
import { PageHeading } from '@/src/components/ui/PageHeading';
import { SearchField } from '@/src/components/ui/SearchField';
import { SurfaceCard } from '@/src/components/ui/SurfaceCard';
import { formatCurrency } from '@/src/lib/format';
import { useDebouncedValue } from '@/src/hooks/useDebouncedValue';
import {
  useInventorySummary,
  useLowStockProducts,
  useProducts,
} from '@/src/hooks/useAppQueries';
import { palette, radius, spacing, typography } from '@/src/theme';
import type { Product } from '@/src/types/models';

export default function InventoryScreen() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedProductDetail, setSelectedProductDetail] = useState<Product | null>(null);
  
  // Creation Form state
  const [createSheetVisible, setCreateSheetVisible] = useState(false);
  const [name, setName] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [primaryUnit, setPrimaryUnit] = useState('pcs');
  const [secondaryUnit, setSecondaryUnit] = useState('');
  const [conversionRate, setConversionRate] = useState('');
  const [taxRate, setTaxRate] = useState('0');
  const [submitting, setSubmitting] = useState(false);

  const debouncedSearch = useDebouncedValue(search);
  const { data: products = [], isLoading: loadingProducts } = useProducts(debouncedSearch);
  const { data: inventorySummary } = useInventorySummary();
  const { data: lowStockProducts } = useLowStockProducts();

  const lowStockPreview = (lowStockProducts ?? []).slice(0, 4);

  const resetForm = () => {
    setName('');
    setSalePrice('');
    setPurchasePrice('');
    setPrimaryUnit('pcs');
    setSecondaryUnit('');
    setConversionRate('');
    setTaxRate('0');
  };

  const handleOpenCreate = () => {
    resetForm();
    setCreateSheetVisible(true);
  };

  const handleCreateProduct = async () => {
    if (!name.trim()) {
      Alert.alert('Required field', 'Product Name is required.');
      return;
    }
    if (!salePrice.trim()) {
      Alert.alert('Required field', 'Sale Price is required.');
      return;
    }
    if (!primaryUnit.trim()) {
      Alert.alert('Required field', 'Primary Unit is required.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        salePrice: Number(salePrice),
        purchasePrice: purchasePrice.trim() ? Number(purchasePrice) : undefined,
        primaryUnit: primaryUnit.trim(),
        secondaryUnit: secondaryUnit.trim() || undefined,
        secondaryConversionRate: conversionRate.trim() ? Number(conversionRate) : undefined,
        taxRate: taxRate.trim() ? Number(taxRate) : undefined,
        itemType: 'product',
      };

      await productsApi.create(payload as any);
      Alert.alert('Success', 'Product created successfully.');
      await queryClient.invalidateQueries({ queryKey: ['products'] });
      await queryClient.invalidateQueries({ queryKey: ['inventory-summary'] });
      setCreateSheetVisible(false);
      resetForm();
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Create product failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const topBarRight = (
    <Pressable style={styles.topBarBtn} onPress={handleOpenCreate}>
      <MaterialCommunityIcons color={palette.primary} name="plus" size={24} />
    </Pressable>
  );

  return (
    <Screen topBarTitle="Inventory Catalog" topBarLeading="back" topBarRight={topBarRight}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <PageHeading
          title="Inventory Catalog"
          subtitle="Browse your product catalog, check live stock counts, and manage pricing."
        />

        {/* 2x2 Modern Summary Grid */}
        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>
              {String(inventorySummary?.totalProducts ?? products.length)}
            </Text>
            <Text style={styles.summaryLabel}>Products</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryValue, { color: '#f59e0b' }]}>
              {String(inventorySummary?.lowStockCount ?? lowStockProducts?.length ?? 0)}
            </Text>
            <Text style={styles.summaryLabel}>Low Stock</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryValue, { color: palette.danger }]}>
              {String(inventorySummary?.outOfStockCount ?? 0)}
            </Text>
            <Text style={styles.summaryLabel}>Out of Stock</Text>
          </View>
          <View style={[styles.summaryCard, { flexBasis: '100%' }]}>
            <Text style={[styles.summaryValue, { color: palette.primary }]}>
              {formatCurrency(Number(inventorySummary?.totalStockValue ?? 0))}
            </Text>
            <Text style={styles.summaryLabel}>Total Stock Value</Text>
          </View>
        </View>

        {/* Low Stock Preview Box */}
        {lowStockPreview.length ? (
          <SurfaceCard title="Low Stock Alerts" subtitle="Items currently below minimum threshold limits.">
            <View style={styles.lowStockList}>
              {lowStockPreview.map((product) => (
                <View key={product.id} style={styles.lowStockRow}>
                  <View style={styles.lowStockInfo}>
                    <Text style={styles.lowStockTitle}>{product.name}</Text>
                    <Text style={styles.lowStockMeta}>
                      {[product.categoryName, product.primaryUnit].filter(Boolean).join('  •  ')}
                    </Text>
                  </View>
                  <Text style={styles.lowStockBadge}>Stock {String(product.stockOnHand ?? 0)}</Text>
                </View>
              ))}
            </View>
          </SurfaceCard>
        ) : null}

        {/* Search Bar & Table List */}
        <SearchField
          placeholder="Search product, barcode, or category..."
          value={search}
          onChangeText={setSearch}
        />

        <SurfaceCard title="Products Directory" subtitle="Active catalog items list.">
          {loadingProducts ? (
            <ActivityIndicator color={palette.primary} size="large" style={styles.loader} />
          ) : (
            <View style={styles.table}>
              {/* Table Header */}
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Item</Text>
                <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'right' }]}>Stock</Text>
                <Text style={[styles.tableHeaderCell, { flex: 1.2, textAlign: 'right' }]}>Price</Text>
              </View>

              {/* Table Rows */}
              {products.map((product) => {
                const isLow = Number(product.stockOnHand ?? 0) <= Number(product.minStockLevel ?? 0);
                return (
                  <Pressable
                    key={product.id}
                    style={styles.tableRow}
                    onPress={() => setSelectedProductDetail(product)}
                  >
                    <View style={{ flex: 2, gap: 2 }}>
                      <Text style={styles.cellItemName} numberOfLines={1}>{product.name}</Text>
                      <Text style={styles.cellItemCategory} numberOfLines={1}>
                        {product.categoryName || 'General'}
                      </Text>
                    </View>
                    <View style={{ flex: 1, alignItems: 'flex-end' }}>
                      <Text style={[styles.cellStock, isLow && styles.lowStockAlertText]}>
                        {String(product.stockOnHand ?? 0)} {product.primaryUnit}
                      </Text>
                    </View>
                    <View style={{ flex: 1.2, alignItems: 'flex-end' }}>
                      <Text style={styles.cellPrice}>{formatCurrency(product.salePrice)}</Text>
                    </View>
                  </Pressable>
                );
              })}

              {products.length === 0 ? (
                <View style={styles.empty}>
                  <MaterialCommunityIcons color={palette.textSoft} name="package-variant" size={32} />
                  <Text style={styles.emptyText}>No catalog items found.</Text>
                </View>
              ) : null}
            </View>
          )}
        </SurfaceCard>
      </ScrollView>

      {/* Create Product Sheet */}
      <BottomSheet
        visible={createSheetVisible}
        title="Add New Catalog Item"
        subtitle="Specify product name, primary stock unit, pricing, and tax details."
        onClose={() => setCreateSheetVisible(false)}
        fullHeight
        footer={
          <Pressable style={styles.primaryButton} onPress={() => void handleCreateProduct()} disabled={submitting}>
            {submitting ? (
              <ActivityIndicator color={palette.white} />
            ) : (
              <Text style={styles.primaryButtonLabel}>Create Item</Text>
            )}
          </Pressable>
        }
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.formScroll}>
          <FormField
            label="Product Name *"
            value={name}
            placeholder="e.g. Coca-Cola 250ml, Whey Protein"
            onChangeText={setName}
          />
          <FormField
            label="Primary Unit (pcs, kg, box) *"
            value={primaryUnit}
            placeholder="pcs"
            onChangeText={setPrimaryUnit}
          />

          <View style={styles.formRow}>
            <View style={{ flex: 1 }}>
              <FormField
                label="Sale Price (रू) *"
                value={salePrice}
                placeholder="0.00"
                keyboardType="numeric"
                onChangeText={setSalePrice}
              />
            </View>
            <View style={{ width: spacing.md }} />
            <View style={{ flex: 1 }}>
              <FormField
                label="Purchase Price (रू)"
                value={purchasePrice}
                placeholder="0.00"
                keyboardType="numeric"
                onChangeText={setPurchasePrice}
              />
            </View>
          </View>

          <FormField
            label="Tax Rate (%)"
            value={taxRate}
            placeholder="0"
            keyboardType="numeric"
            onChangeText={setTaxRate}
          />

          <Text style={styles.sheetSectionTitle}>Secondary Unit Settings (Optional)</Text>
          <FormField
            label="Secondary Unit (e.g. box, pack)"
            value={secondaryUnit}
            placeholder="e.g. pack"
            onChangeText={setSecondaryUnit}
          />
          <FormField
            label="Conversion Rate (Primary inside Secondary)"
            value={conversionRate}
            placeholder="e.g. 12"
            keyboardType="numeric"
            onChangeText={setConversionRate}
          />
        </ScrollView>
      </BottomSheet>

      {/* Details Sheet */}
      <BottomSheet
        visible={Boolean(selectedProductDetail)}
        title="Product Details"
        subtitle="Catalog configurations and details for this product item."
        onClose={() => setSelectedProductDetail(null)}
        fullHeight
      >
        {selectedProductDetail ? (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetContent}>
            <View style={styles.sheetBody}>
              <View style={styles.sheetRow}>
                <Text style={styles.sheetLabel}>Name</Text>
                <Text style={styles.sheetValue}>{selectedProductDetail.name}</Text>
              </View>
              {selectedProductDetail.sku ? (
                <View style={styles.sheetRow}>
                  <Text style={styles.sheetLabel}>SKU</Text>
                  <Text style={styles.sheetValue}>{selectedProductDetail.sku}</Text>
                </View>
              ) : null}
              {selectedProductDetail.categoryName ? (
                <View style={styles.sheetRow}>
                  <Text style={styles.sheetLabel}>Category</Text>
                  <Text style={styles.sheetValue}>{selectedProductDetail.categoryName}</Text>
                </View>
              ) : null}
              <View style={styles.sheetRow}>
                <Text style={styles.sheetLabel}>Sale Price</Text>
                <Text style={styles.sheetValue}>{formatCurrency(selectedProductDetail.salePrice)}</Text>
              </View>
              {selectedProductDetail.purchasePrice !== undefined ? (
                <View style={styles.sheetRow}>
                  <Text style={styles.sheetLabel}>Purchase Price</Text>
                  <Text style={styles.sheetValue}>{formatCurrency(selectedProductDetail.purchasePrice)}</Text>
                </View>
              ) : null}
              <View style={styles.sheetRow}>
                <Text style={styles.sheetLabel}>Stock On Hand</Text>
                <Text style={styles.sheetValue}>{String(selectedProductDetail.stockOnHand ?? 0)}</Text>
              </View>
              <View style={styles.sheetRow}>
                <Text style={styles.sheetLabel}>Primary Unit</Text>
                <Text style={styles.sheetValue}>{selectedProductDetail.primaryUnit}</Text>
              </View>
              {selectedProductDetail.secondaryUnit ? (
                <>
                  <View style={styles.sheetRow}>
                    <Text style={styles.sheetLabel}>Secondary Unit</Text>
                    <Text style={styles.sheetValue}>{selectedProductDetail.secondaryUnit}</Text>
                  </View>
                  <View style={styles.sheetRow}>
                    <Text style={styles.sheetLabel}>Conversion Rate</Text>
                    <Text style={styles.sheetValue}>
                      {String(selectedProductDetail.secondaryConversionRate ?? 0)}
                    </Text>
                  </View>
                </>
              ) : null}
              {selectedProductDetail.taxRate !== undefined ? (
                <View style={styles.sheetRow}>
                  <Text style={styles.sheetLabel}>Tax Rate</Text>
                  <Text style={styles.sheetValue}>{selectedProductDetail.taxRate}%</Text>
                </View>
              ) : null}
            </View>
          </ScrollView>
        ) : null}
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  topBarBtn: {
    padding: spacing.xs,
  },
  loader: {
    paddingVertical: spacing.xl,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  summaryCard: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: '#ffffff',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: palette.textMuted,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '800',
    color: palette.text,
  },
  lowStockList: {
    gap: spacing.xs,
  },
  lowStockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  lowStockInfo: {
    flex: 1,
  },
  lowStockTitle: {
    fontSize: typography.body,
    fontWeight: '700',
    color: palette.text,
  },
  lowStockMeta: {
    fontSize: typography.caption,
    color: palette.textMuted,
  },
  lowStockBadge: {
    fontSize: typography.caption,
    fontWeight: '700',
    color: palette.danger,
    backgroundColor: palette.dangerSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  table: {
    gap: 4,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1.5,
    borderBottomColor: palette.border,
    paddingBottom: spacing.xs,
    marginBottom: spacing.xs,
  },
  tableHeaderCell: {
    fontSize: typography.label,
    fontWeight: '800',
    color: palette.textSoft,
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  cellItemName: {
    fontSize: typography.body,
    fontWeight: '800',
    color: palette.text,
  },
  cellItemCategory: {
    fontSize: typography.caption,
    color: palette.textMuted,
  },
  cellStock: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.textSoft,
  },
  lowStockAlertText: {
    color: palette.danger,
    fontWeight: '800',
  },
  cellPrice: {
    fontSize: 14,
    fontWeight: '800',
    color: palette.primary,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.xs,
  },
  emptyText: {
    fontSize: typography.body,
    color: palette.textMuted,
  },
  formScroll: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  formRow: {
    flexDirection: 'row',
  },
  sheetSectionTitle: {
    fontSize: typography.label,
    fontWeight: '800',
    color: palette.textSoft,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.md,
    marginBottom: spacing.xxs,
  },
  sheetContent: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  sheetBody: {
    gap: spacing.md,
    paddingBottom: spacing.md,
  },
  sheetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    paddingVertical: spacing.sm,
  },
  sheetLabel: {
    color: palette.textSoft,
    fontSize: typography.body,
  },
  sheetValue: {
    color: palette.text,
    fontSize: typography.body,
    fontWeight: '700',
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonLabel: {
    color: palette.white,
    fontSize: typography.body,
    fontWeight: '800',
  },
});
