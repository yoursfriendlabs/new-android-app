import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { formatCurrency } from '@/src/shared/lib/format';
import { usePalette } from '@/src/stores/theme-store';
import { radius, spacing, typography } from '@/src/theme';
import type { AppPalette } from '@/src/theme/app-palette';
import type { Product } from '@/src/types/models';
import { useThemedStyles } from '@/src/theme/use-themed-styles';

interface ProductCardProps {
  product: Product;
  quantity: number;
  onAdd: () => void;
  onSubtract: () => void;
  onInfo?: () => void;
}

function getStockTone(stockOnHand: number | undefined, colors: AppPalette) {
  const stock = Number(stockOnHand ?? 0);
  if (stock <= 0) {
    return { label: 'Out of stock', backgroundColor: colors.dangerSoft, color: colors.danger };
  }
  if (stock <= 5) {
    return { label: 'Low stock', backgroundColor: colors.warningSoft, color: colors.warning };
  }
  return { label: 'In stock', backgroundColor: colors.successSoft, color: colors.success };
}

export function ProductCard({ onAdd, onInfo, onSubtract, product, quantity }: ProductCardProps) {
  const colors = usePalette();
  const styles = useThemedStyles(createStyles);
  const stockTone = getStockTone(product.stockOnHand, colors);

  function showInfo() {
    if (onInfo) {
      onInfo();
      return;
    }

    Alert.alert(
      product.name,
      [
        product.categoryName ? `Category: ${product.categoryName}` : null,
        product.primaryUnit ? `Unit: ${product.primaryUnit}` : null,
        product.stockOnHand !== undefined ? `Stock: ${product.stockOnHand}` : null,
        `Price: ${formatCurrency(product.salePrice)}`,
      ]
        .filter(Boolean)
        .join('\n'),
    );
  }

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        quantity > 0 && { borderColor: colors.primary, backgroundColor: colors.accentSoft },
      ]}>
      <View style={styles.headerRow}>
        <View style={[styles.categoryBadge, { backgroundColor: colors.backgroundAlt }]}>
          <Text numberOfLines={1} style={[styles.categoryBadgeLabel, { color: colors.textMuted }]}>
            {product.categoryName || 'General'}
          </Text>
        </View>
        <Pressable hitSlop={8} onPress={showInfo}>
          {quantity > 0 ? (
            <View style={[styles.selectedBadge, { backgroundColor: colors.backgroundAlt }]}>
              <MaterialCommunityIcons color={colors.primary} name="cart" size={12} />
              <Text style={[styles.selectedBadgeLabel, { color: colors.primary }]}>{quantity}</Text>
            </View>
          ) : (
            <Text style={[styles.stockTextHeader, { color: stockTone.color }]}>Stock {product.stockOnHand ?? 0}</Text>
          )}
        </Pressable>
      </View>

      <Pressable style={styles.bodyPressable} onPress={onAdd} onLongPress={showInfo}>
        <Text numberOfLines={2} style={[styles.cleanTitle, { color: colors.text }]}>
          {product.name}
        </Text>
        <Text style={[styles.cleanUnit, { color: colors.textMuted }]}>per {product.primaryUnit || 'unit'}</Text>
        <Text style={[styles.cleanPrice, { color: colors.primary }]}>{formatCurrency(product.salePrice)}</Text>
      </Pressable>

      {quantity > 0 ? (
        <View style={styles.counter}>
          <Pressable style={[styles.counterButton, { backgroundColor: colors.backgroundAlt }]} onPress={onSubtract}>
            <MaterialCommunityIcons color={colors.text} name="minus" size={18} />
          </Pressable>
          <Text style={[styles.counterValue, { color: colors.text }]}>{quantity}</Text>
          <Pressable
            style={[styles.counterButton, { backgroundColor: colors.primary }]}
            onPress={onAdd}>
            <MaterialCommunityIcons color={colors.onPrimary} name="plus" size={18} />
          </Pressable>
        </View>
      ) : (
        <Pressable style={[styles.addButton, { backgroundColor: colors.primary }]} onPress={onAdd}>
          <MaterialCommunityIcons color={colors.onPrimary} name="plus" size={16} />
          <Text style={[styles.addLabel, { color: colors.onPrimary }]}>Add</Text>
        </Pressable>
      )}
    </View>
  );
}

const createStyles = (colors: AppPalette) => StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: radius.lg,
    padding: spacing.sm,
    borderWidth: 1,
    gap: spacing.xs,
    justifyContent: 'space-between',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: 2,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    maxWidth: '55%',
  },
  categoryBadgeLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  stockTextHeader: {
    fontSize: 11,
    fontWeight: '700',
  },
  selectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  selectedBadgeLabel: {
    fontSize: 10,
    fontWeight: '800',
  },
  bodyPressable: {
    flex: 1,
    gap: 2,
  },
  cleanTitle: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
  },
  cleanUnit: {
    fontSize: 11,
    marginTop: 2,
  },
  cleanPrice: {
    fontSize: 15,
    fontWeight: '800',
    marginTop: 4,
    marginBottom: 4,
  },
  addButton: {
    minHeight: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: 4,
  },
  addLabel: {
    fontSize: typography.label,
    fontWeight: '800',
  },
  counter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 4,
  },
  counterButton: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterValue: {
    flex: 1,
    textAlign: 'center',
    fontSize: typography.body,
    fontWeight: '800',
  },
});
