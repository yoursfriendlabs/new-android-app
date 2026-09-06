import { FlashList } from '@shopify/flash-list';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/src/shared/feedback/BottomSheet';
import { SearchField } from '@/src/shared/ui/SearchField';
import { Avatar } from '@/src/shared/ui/Avatar';
import { formatCurrency, prettyDate } from '@/src/shared/lib/format';
import { daysUntilExpiry, expiryRemainingLabel } from '@/src/features/inventory/lib/inventory';
import { usePalette } from '@/src/stores/theme-store';
import { radius, spacing, typography } from '@/src/theme';
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
    <BottomSheet
      visible={visible}
      title="Select product"
      subtitle="Live search across your product catalog."
      onClose={onClose}
      fullHeight>
      <SearchField placeholder="Search product name, brand, or SKU" value={search} onChangeText={onSearchChange} />
      <FlashList
        data={products}
        renderItem={({ item }) => {
          const totalStock = Number(item.stockOnHand ?? 0);
          const expiredQty = Number(item.expiredQuantity ?? 0);
          const sellableQty = Number(item.sellableQuantity ?? Math.max(0, totalStock - expiredQty));
          const hasExpired = Boolean(item.hasExpiredStock) || expiredQty > 0;
          const daysLeft = daysUntilExpiry(item.expiryDate);
          const isNear = !hasExpired && daysLeft != null && daysLeft >= 0 && daysLeft <= 20;

          return (
            <Pressable style={[styles.row, { borderBottomColor: colors.border }]} onPress={() => onPick(item)}>
              <Avatar
                uri={item.imageUrl}
                name={item.name}
                size={42}
                shape="rounded"
                backgroundColor={colors.accentSoft}
                textColor={colors.primary}
              />
              <View style={styles.meta}>
                <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={[styles.detail, { color: colors.textMuted }]} numberOfLines={1}>
                  {[item.companyName || item.categoryName || 'General', item.primaryUnit].filter(Boolean).join('  •  ')}
                </Text>

                {/* Expiry info if present */}
                {item.expiryDate ? (
                  <Text
                    style={[
                      styles.expiryText,
                      {
                        color: hasExpired ? colors.danger : isNear ? colors.info : colors.textMuted,
                      },
                    ]}>
                    Exp: {prettyDate(item.expiryDate)}
                    {expiryRemainingLabel(item.expiryDate) ? ` (${expiryRemainingLabel(item.expiryDate)})` : ''}
                  </Text>
                ) : null}
              </View>

              <View style={styles.rightCol}>
                <Text style={[styles.price, { color: colors.primary }]}>{formatCurrency(item.salePrice)}</Text>
                {hasExpired ? (
                  <View style={{ alignItems: 'flex-end', gap: 1 }}>
                    <Text style={[styles.stockText, { color: colors.text }]}>
                      {sellableQty} {item.primaryUnit} sellable
                    </Text>
                    <Text style={[styles.expiredBadge, { color: colors.danger }]}>
                      {expiredQty} expired
                    </Text>
                  </View>
                ) : (
                  <Text style={[styles.stockText, { color: colors.textMuted }]}>
                    Stock {totalStock} {item.primaryUnit}
                  </Text>
                )}
              </View>
            </Pressable>
          );
        }}
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
    gap: 2,
  },
  name: {
    fontSize: typography.body,
    fontWeight: '700',
  },
  detail: {
    fontSize: typography.label,
  },
  expiryText: {
    fontSize: 11,
    fontWeight: '600',
  },
  rightCol: {
    alignItems: 'flex-end',
    gap: 2,
  },
  price: {
    fontSize: typography.body,
    fontWeight: '800',
  },
  stockText: {
    fontSize: typography.label,
    fontWeight: '600',
  },
  expiredBadge: {
    fontSize: 10,
    fontWeight: '700',
  },
});
