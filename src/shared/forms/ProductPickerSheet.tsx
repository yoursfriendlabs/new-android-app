import { FlashList } from '@shopify/flash-list';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/src/shared/feedback/BottomSheet';
import { SearchField } from '@/src/shared/ui/SearchField';
import { formatCurrency } from '@/src/shared/lib/format';
import { usePalette } from '@/src/stores/theme-store';
import { spacing, typography } from '@/src/theme';
import type { Product } from '@/src/types/models';

interface ProductPickerSheetProps {
  visible: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  products: Product[];
  onPick: (product: Product) => void;
  onClose: () => void;
}

export function ProductPickerSheet({
  onClose,
  onPick,
  onSearchChange,
  products,
  search,
  visible,
}: ProductPickerSheetProps) {
  const colors = usePalette();

  return (
    <BottomSheet visible={visible} title="Select product" subtitle="Live search across your product list." onClose={onClose} fullHeight>
      <SearchField placeholder="Search product" value={search} onChangeText={onSearchChange} />
      <FlashList
        data={products}
        renderItem={({ item }) => (
          <Pressable style={[styles.row, { borderBottomColor: colors.border }]} onPress={() => onPick(item)}>
            <View style={styles.meta}>
              <Text style={[styles.name, { color: colors.text }]}>{item.name}</Text>
              <Text style={[styles.detail, { color: colors.textMuted }]}>
                {[item.categoryName, item.primaryUnit, `Stock ${item.stockOnHand ?? 0}`].filter(Boolean).join('  •  ')}
              </Text>
            </View>
            <Text style={[styles.price, { color: colors.primary }]}>{formatCurrency(item.salePrice)}</Text>
          </Pressable>
        )}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingBottom: spacing.xxl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  meta: {
    flex: 1,
    gap: spacing.xxs,
  },
  name: {
    fontSize: typography.body,
    fontWeight: '700',
  },
  detail: {
    fontSize: typography.label,
  },
  price: {
    fontSize: typography.body,
    fontWeight: '700',
  },
});
