import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/src/components/feedback/BottomSheet';
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
  const [search, setSearch] = useState('');
  const [selectedProductDetail, setSelectedProductDetail] = useState<Product | null>(null);
  const debouncedSearch = useDebouncedValue(search);
  const { data: products } = useProducts(debouncedSearch);
  const { data: inventorySummary } = useInventorySummary();
  const { data: lowStockProducts } = useLowStockProducts();

  const lowStockPreview = (lowStockProducts ?? []).slice(0, 4);

  return (
    <Screen>
      <PageHeading
        title="Inventory"
        subtitle="Browse your product catalog, check live stock counts, and view pricing on the go."
      />

      <View style={styles.summaryGrid}>
        <SurfaceCard>
          <Text style={styles.summaryLabel}>Products</Text>
          <Text style={styles.summaryValue}>{String(inventorySummary?.totalProducts ?? products?.length ?? 0)}</Text>
        </SurfaceCard>
        <SurfaceCard>
          <Text style={styles.summaryLabel}>Low stock</Text>
          <Text style={styles.summaryValue}>{String(inventorySummary?.lowStockCount ?? lowStockProducts?.length ?? 0)}</Text>
        </SurfaceCard>
        <SurfaceCard>
          <Text style={styles.summaryLabel}>Out of stock</Text>
          <Text style={styles.summaryValue}>{String(inventorySummary?.outOfStockCount ?? 0)}</Text>
        </SurfaceCard>
        <SurfaceCard>
          <Text style={styles.summaryLabel}>Stock value</Text>
          <Text style={styles.summaryValue}>{formatCurrency(Number(inventorySummary?.totalStockValue ?? 0))}</Text>
        </SurfaceCard>
      </View>

      {lowStockPreview.length ? (
        <SurfaceCard title="Low stock" subtitle="Items currently below minimum threshold limits.">
          <View style={styles.list}>
            {lowStockPreview.map((product) => (
              <View key={product.id} style={styles.row}>
                <View style={styles.copy}>
                  <Text style={styles.title}>{product.name}</Text>
                  <Text style={styles.meta}>{[product.categoryName, product.primaryUnit].filter(Boolean).join('  •  ')}</Text>
                </View>
                <Text style={styles.lowStockCount}>Stock {String(product.stockOnHand ?? 0)}</Text>
              </View>
            ))}
          </View>
        </SurfaceCard>
      ) : null}

      <SearchField placeholder="Search product, barcode, or category" value={search} onChangeText={setSearch} />
      <View style={styles.list}>
        {(products ?? []).map((product) => (
          <SurfaceCard key={product.id} onPress={() => setSelectedProductDetail(product)}>
            <View style={styles.row}>
              <View style={styles.copy}>
                <Text style={styles.title}>{product.name}</Text>
                <Text style={styles.meta}>
                  {[product.categoryName, product.primaryUnit, `Stock ${product.stockOnHand ?? 0}`]
                    .filter(Boolean)
                    .join('  •  ')}
                </Text>
                {product.secondaryUnit ? (
                  <Text style={styles.meta}>
                    Secondary {product.secondaryUnit}  •  Rate {String(product.secondaryConversionRate ?? 0)}
                  </Text>
                ) : null}
              </View>
              <View style={styles.side}>
                <Text style={styles.amount}>{formatCurrency(product.salePrice)}</Text>
              </View>
            </View>
          </SurfaceCard>
        ))}
      </View>

      <BottomSheet
        visible={Boolean(selectedProductDetail)}
        title="Product Details"
        subtitle="Read-only catalog details for this item."
        onClose={() => setSelectedProductDetail(null)}
        fullHeight>
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
                    <Text style={styles.sheetValue}>{String(selectedProductDetail.secondaryConversionRate ?? 0)}</Text>
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
  summaryGrid: {
    gap: spacing.sm,
  },
  summaryLabel: {
    fontSize: typography.label,
    color: palette.textMuted,
  },
  summaryValue: {
    fontSize: typography.subheading,
    fontWeight: '800',
    color: palette.text,
  },
  list: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderRadius: radius.md,
    backgroundColor: palette.surfaceMuted,
    padding: spacing.md,
  },
  copy: {
    flex: 1,
    gap: spacing.xxs,
  },
  title: {
    fontSize: typography.body,
    fontWeight: '700',
    color: palette.text,
  },
  meta: {
    fontSize: typography.label,
    color: palette.textMuted,
  },
  side: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  amount: {
    fontSize: typography.body,
    fontWeight: '800',
    color: palette.primary,
  },
  lowStockCount: {
    fontSize: typography.label,
    color: palette.warning,
    fontWeight: '700',
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
    minHeight: 50,
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

