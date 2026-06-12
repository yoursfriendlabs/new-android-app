import { FlashList } from '@shopify/flash-list';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/src/components/feedback/BottomSheet';
import { SearchField } from '@/src/components/ui/SearchField';
import { formatCurrency } from '@/src/lib/format';
import { palette, spacing, typography } from '@/src/theme';
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
  return (
    <BottomSheet visible={visible} title="Select product" subtitle="Live search across your product list." onClose={onClose} fullHeight>
      <SearchField placeholder="Search product" value={search} onChangeText={onSearchChange} />
      <FlashList
        data={products}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => onPick(item)}>
            <View style={styles.meta}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.detail}>
                {[item.categoryName, item.primaryUnit, `Stock ${item.stockOnHand ?? 0}`].filter(Boolean).join('  •  ')}
              </Text>
            </View>
            <Text style={styles.price}>{formatCurrency(item.salePrice)}</Text>
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
    borderBottomColor: palette.border,
  },
  meta: {
    flex: 1,
    gap: spacing.xxs,
  },
  name: {
    fontSize: typography.body,
    fontWeight: '700',
    color: palette.text,
  },
  detail: {
    fontSize: typography.label,
    color: palette.textMuted,
  },
  price: {
    fontSize: typography.body,
    fontWeight: '700',
    color: palette.primary,
  },
});
