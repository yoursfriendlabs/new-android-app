import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { RefreshControl, StyleSheet, View } from 'react-native';

import { ProductCard } from '@/src/features/pos/components/ProductCard';
import { ProductFilters } from '@/src/features/pos/components/ProductFilters';
import { EmptyState } from '@/src/shared/ui/EmptyState';
import { SkeletonCardGrid } from '@/src/shared/ui/Skeleton';
import { usePalette } from '@/src/stores/theme-store';
import { spacing } from '@/src/theme';
import type { Product } from '@/src/types/models';
import type { PosDraft } from '@/src/types/forms';

interface PosProductGridProps {
  products: Product[];
  cartItems: PosDraft['items'];
  loading: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onAdd: (productId: string) => void;
  onSubtract: (productId: string) => void;
  search: string;
  setSearch: (value: string) => void;
  category: string;
  setCategory: (value: string) => void;
  categoryOptions: string[];
  isTablet: boolean;
  /** True when a search or category is narrowing the list. */
  filtered: boolean;
}

/** The tappable product grid, with its filters, loading and empty states. */
export function PosProductGrid({
  cartItems,
  category,
  categoryOptions,
  filtered,
  isTablet,
  loading,
  onAdd,
  onRefresh,
  onSubtract,
  products,
  refreshing,
  search,
  setCategory,
  setSearch,
}: PosProductGridProps) {
  const colors = usePalette();
  const columns = isTablet ? 3 : 2;

  const filters = (
    <ProductFilters
      search={search}
      setSearch={setSearch}
      category={category}
      setCategory={setCategory}
      categoryOptions={categoryOptions}
    />
  );

  if (loading) {
    return (
      <View style={styles.pane}>
        {filters}
        <View style={styles.stateWrap}>
          <SkeletonCardGrid columns={columns} count={columns * 3} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.pane}>
      {isTablet ? filters : null}
      <FlashList
        data={products}
        key={isTablet ? 'tablet-grid' : 'phone-grid'}
        numColumns={columns}
        style={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={isTablet ? null : filters}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          filtered ? (
            <EmptyState
              variant="screen"
              icon="magnify"
              title="No products match"
              message="Try a different search, or clear the category filter."
              actionLabel="Clear filters"
              onAction={() => {
                setSearch('');
                setCategory(categoryOptions[0] ?? 'All');
              }}
            />
          ) : (
            <EmptyState
              variant="screen"
              icon="package-variant-closed"
              title="No products yet"
              message="Add your first product and it will show up here, ready to sell."
              actionLabel="Add product"
              onAction={() => router.push('/(app)/inventory')}
            />
          )
        }
        renderItem={({ item }) => {
          const quantity = cartItems.find((cartItem) => cartItem.productId === item.id)?.quantity ?? 0;
          return (
            <View style={styles.gridItem}>
              <ProductCard
                product={item}
                quantity={quantity}
                onAdd={() => onAdd(item.id)}
                onSubtract={() => onSubtract(item.id)}
              />
            </View>
          );
        }}
        keyExtractor={(item) => item.id}
        contentContainerStyle={isTablet ? styles.contentTablet : styles.contentPhone}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  pane: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
  stateWrap: {
    padding: spacing.sm,
  },
  gridItem: {
    flex: 1,
    padding: spacing.xxs,
  },
  contentPhone: {
    paddingHorizontal: spacing.xs,
    paddingBottom: spacing.xxxl,
  },
  contentTablet: {
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.xl,
  },
});
