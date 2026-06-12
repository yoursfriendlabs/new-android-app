import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { formatCurrency } from '@/src/lib/format';
import { palette, radius, spacing, typography } from '@/src/theme';
import type { Product } from '@/src/types/models';

interface ProductCardProps {
  product: Product;
  quantity: number;
  onAdd: () => void;
  onSubtract: () => void;
  onInfo?: () => void;
}

function getStockTone(stockOnHand?: number) {
  const stock = Number(stockOnHand ?? 0);
  if (stock <= 0) {
    return {
      label: 'Out of stock',
      backgroundColor: palette.dangerSoft,
      color: palette.danger,
    };
  }

  if (stock <= 5) {
    return {
      label: 'Low stock',
      backgroundColor: palette.warningSoft,
      color: palette.warning,
    };
  }

  return {
    label: 'In stock',
    backgroundColor: palette.successSoft,
    color: palette.success,
  };
}

export function ProductCard({ onAdd, onInfo, onSubtract, product, quantity }: ProductCardProps) {
  const stockTone = getStockTone(product.stockOnHand);

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
    <View style={[styles.card, quantity > 0 && styles.cardActive]}>
      <View style={styles.headerRow}>
        <View style={[styles.stockBadge, { backgroundColor: stockTone.backgroundColor }]}>
          <Text style={[styles.stockBadgeLabel, { color: stockTone.color }]}>{stockTone.label}</Text>
        </View>
        {quantity > 0 ? (
          <View style={styles.selectedBadge}>
            <MaterialCommunityIcons color={palette.primary} name="cart" size={14} />
            <Text style={styles.selectedBadgeLabel}>{quantity} in cart</Text>
          </View>
        ) : (
          <Pressable style={styles.infoButton} onPress={showInfo}>
            <MaterialCommunityIcons color={palette.textSoft} name="information-outline" size={20} />
          </Pressable>
        )}
      </View>

      <View style={styles.identityRow}>
        <View style={styles.thumbnail}>
          <Text style={styles.thumbnailLabel}>{product.name.slice(0, 1).toUpperCase()}</Text>
        </View>
        <View style={styles.identityCopy}>
          <Text numberOfLines={1} style={styles.category}>
            {product.categoryName || 'General item'}
          </Text>
          <Text numberOfLines={2} style={styles.title}>
            {product.name}
          </Text>
        </View>
      </View>

      <View style={styles.priceRow}>
        <View style={styles.priceCopy}>
          <Text style={styles.price}>{formatCurrency(product.salePrice)}</Text>
          <Text style={styles.unit}>per {product.primaryUnit}</Text>
        </View>
        <Text style={styles.stockText}>
          {product.stockOnHand ?? 0} {product.primaryUnit}
        </Text>
      </View>

      {quantity > 0 ? (
        <View style={styles.counter}>
          <Pressable style={styles.counterButton} onPress={onSubtract}>
            <MaterialCommunityIcons color={palette.text} name="minus" size={18} />
          </Pressable>
          <Text style={styles.counterValue}>{quantity}</Text>
          <Pressable style={[styles.counterButton, styles.counterButtonPrimary]} onPress={onAdd}>
            <MaterialCommunityIcons color={palette.white} name="plus" size={18} />
          </Pressable>
        </View>
      ) : (
        <Pressable style={styles.addButton} onPress={onAdd}>
          <MaterialCommunityIcons color={palette.primary} name="plus-circle-outline" size={18} />
          <Text style={styles.addLabel}>Quick add</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: palette.border,
    gap: spacing.xs,
  },
  cardActive: {
    borderColor: palette.primary,
    backgroundColor: '#fffcf7',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.xs,
  },
  stockBadge: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  stockBadgeLabel: {
    fontSize: typography.caption,
    fontWeight: '800',
  },
  selectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.xs,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: palette.backgroundAlt,
  },
  selectedBadgeLabel: {
    color: palette.primary,
    fontSize: typography.caption,
    fontWeight: '800',
  },
  infoButton: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  thumbnail: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: palette.backgroundAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: palette.primary,
  },
  identityCopy: {
    flex: 1,
    gap: 2,
  },
  category: {
    fontSize: typography.caption,
    fontWeight: '700',
    color: palette.textSoft,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  title: {
    fontSize: typography.body,
    fontWeight: '800',
    lineHeight: 18,
    color: palette.text,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.xs,
  },
  priceCopy: {
    flex: 1,
    gap: 2,
  },
  price: {
    fontSize: typography.subheading,
    fontWeight: '800',
    color: palette.text,
  },
  unit: {
    fontSize: typography.caption,
    color: palette.textMuted,
  },
  stockText: {
    fontSize: typography.caption,
    fontWeight: '700',
    color: palette.textMuted,
  },
  addButton: {
    minHeight: 40,
    backgroundColor: palette.backgroundAlt,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  addLabel: {
    fontSize: typography.label,
    fontWeight: '800',
    color: palette.primary,
  },
  counter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  counterButton: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: palette.backgroundAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterButtonPrimary: {
    backgroundColor: palette.success,
  },
  counterValue: {
    flex: 1,
    textAlign: 'center',
    fontSize: typography.body,
    fontWeight: '800',
    color: palette.text,
  },
});
