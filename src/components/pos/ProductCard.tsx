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
        <View style={styles.categoryBadge}>
          <Text numberOfLines={1} style={styles.categoryBadgeLabel}>
            {product.categoryName || 'General'}
          </Text>
        </View>
        {quantity > 0 ? (
          <View style={styles.selectedBadge}>
            <MaterialCommunityIcons color={palette.primary} name="cart" size={12} />
            <Text style={styles.selectedBadgeLabel}>{quantity} in cart</Text>
          </View>
        ) : (
          <Text style={[styles.stockTextHeader, { color: stockTone.color }]}>
            Stock {product.stockOnHand ?? 0}
          </Text>
        )}
      </View>

      <Pressable style={styles.bodyPressable} onPress={showInfo}>
        <Text numberOfLines={2} style={styles.cleanTitle}>
          {product.name}
        </Text>
        <Text style={styles.cleanUnit}>
          per {product.primaryUnit || 'unit'}
        </Text>
        <Text style={styles.cleanPrice}>
          {formatCurrency(product.salePrice)}
        </Text>
      </Pressable>

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
    justifyContent: 'space-between',
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
    marginBottom: 2,
  },
  categoryBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    maxWidth: '55%',
  },
  categoryBadgeLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
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
    backgroundColor: palette.backgroundAlt,
  },
  selectedBadgeLabel: {
    color: palette.primary,
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
    color: palette.text,
    lineHeight: 18,
  },
  cleanUnit: {
    fontSize: 11,
    color: palette.textMuted,
    marginTop: 2,
  },
  cleanPrice: {
    fontSize: 15,
    fontWeight: '800',
    color: palette.primary,
    marginTop: 4,
    marginBottom: 4,
  },
  addButton: {
    minHeight: 38,
    backgroundColor: palette.backgroundAlt,
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
    color: palette.primary,
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
