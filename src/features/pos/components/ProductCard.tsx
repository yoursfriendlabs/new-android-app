import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { formatCurrency } from '@/src/shared/lib/format';
import { usePalette } from '@/src/stores/theme-store';
import { useTranslation } from '@/src/i18n';
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

function getStockTone(stockOnHand: number | undefined, colors: AppPalette, t: (k: string) => string) {
  const stock = Number(stockOnHand ?? 0);
  if (stock <= 0) {
    return { label: t('inventory.outOfStock'), backgroundColor: colors.dangerSoft, color: colors.danger };
  }
  if (stock <= 5) {
    return { label: t('inventory.lowStock'), backgroundColor: colors.warningSoft, color: colors.warning };
  }
  return { label: t('inventory.inStock'), backgroundColor: colors.successSoft, color: colors.success };
}

export function ProductCard({ onAdd, onInfo, onSubtract, product, quantity }: ProductCardProps) {
  const colors = usePalette();
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();
  const stockTone = getStockTone(product.stockOnHand, colors, t);
  const imageUri = product.imageUrl || (product as any).image || (product as any).photoUrl || (product as any).thumbnailUrl;

  function showInfo() {
    if (onInfo) {
      onInfo();
      return;
    }

    Alert.alert(
      product.name,
      [
        product.categoryName ? `${t('common.category')}: ${product.categoryName}` : null,
        product.primaryUnit ? `${t('inventory.unit')}: ${product.primaryUnit}` : null,
        product.stockOnHand !== undefined ? `${t('inventory.currentStock')}: ${product.stockOnHand}` : null,
        `${t('common.price')}: ${formatCurrency(product.salePrice)}`,
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
      
      {/* Product Image or Icon Banner */}
      <Pressable style={styles.imageContainer} onPress={onAdd} onLongPress={showInfo}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.productImg} resizeMode="cover" />
        ) : (
          <View style={[styles.placeholderBox, { backgroundColor: colors.backgroundAlt }]}>
            <MaterialCommunityIcons name="package-variant-closed" size={24} color={colors.textSoft} />
          </View>
        )}

        {/* Floating Category Badge */}
        {product.categoryName ? (
          <View style={[styles.floatingCategoryBadge, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
            <Text numberOfLines={1} style={styles.floatingCategoryText}>
              {product.categoryName}
            </Text>
          </View>
        ) : null}

        {/* Stock status pill */}
        <View style={[styles.stockPill, { backgroundColor: stockTone.backgroundColor }]}>
          <Text style={[styles.stockPillText, { color: stockTone.color }]}>
            {product.stockOnHand !== undefined ? `${product.stockOnHand}` : '∞'}
          </Text>
        </View>
      </Pressable>

      {/* Product Details */}
      <Pressable style={styles.bodyPressable} onPress={onAdd} onLongPress={showInfo}>
        <Text numberOfLines={2} style={[styles.cleanTitle, { color: colors.text }]}>
          {product.name}
        </Text>
        <View style={styles.priceRow}>
          <Text style={[styles.cleanPrice, { color: colors.primary }]}>
            {formatCurrency(product.salePrice)}
          </Text>
          <Text style={[styles.cleanUnit, { color: colors.textMuted }]}>
            /{product.primaryUnit || 'unit'}
          </Text>
        </View>
      </Pressable>

      {/* Quantity / Add Controls */}
      {quantity > 0 ? (
        <View style={styles.counter}>
          <Pressable style={[styles.counterButton, { backgroundColor: colors.backgroundAlt }]} onPress={onSubtract}>
            <MaterialCommunityIcons color={colors.text} name="minus" size={16} />
          </Pressable>
          <Text style={[styles.counterValue, { color: colors.primary }]}>{quantity}</Text>
          <Pressable
            style={[styles.counterButton, { backgroundColor: colors.primary }]}
            onPress={onAdd}>
            <MaterialCommunityIcons color={colors.white} name="plus" size={16} />
          </Pressable>
        </View>
      ) : (
        <Pressable style={[styles.addButton, { backgroundColor: colors.primary }]} onPress={onAdd}>
          <MaterialCommunityIcons color={colors.white} name="plus" size={15} />
          <Text style={[styles.addLabel, { color: colors.white }]}>{t('common.add')}</Text>
        </Pressable>
      )}
    </View>
  );
}

const createStyles = (colors: AppPalette) =>
  StyleSheet.create({
    card: {
      flex: 1,
      borderRadius: radius.lg,
      padding: spacing.xs,
      borderWidth: 1,
      gap: spacing.xs,
      justifyContent: 'space-between',
    },
    imageContainer: {
      width: '100%',
      height: 90,
      borderRadius: radius.md,
      overflow: 'hidden',
      position: 'relative',
    },
    productImg: {
      width: '100%',
      height: '100%',
    },
    placeholderBox: {
      width: '100%',
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
    },
    floatingCategoryBadge: {
      position: 'absolute',
      bottom: 4,
      left: 4,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: radius.pill,
      maxWidth: '75%',
    },
    floatingCategoryText: {
      color: '#ffffff',
      fontSize: 9,
      fontWeight: '700',
    },
    stockPill: {
      position: 'absolute',
      top: 4,
      right: 4,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: radius.pill,
      minWidth: 20,
      alignItems: 'center',
    },
    stockPillText: {
      fontSize: 10,
      fontWeight: '800',
    },
    bodyPressable: {
      flex: 1,
      paddingHorizontal: 2,
      gap: 2,
    },
    cleanTitle: {
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 17,
      minHeight: 34,
    },
    priceRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 2,
      marginTop: 2,
    },
    cleanPrice: {
      fontSize: 14,
      fontWeight: '800',
    },
    cleanUnit: {
      fontSize: 10,
      fontWeight: '600',
    },
    addButton: {
      minHeight: 34,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 4,
    },
    addLabel: {
      fontSize: 12,
      fontWeight: '800',
    },
    counter: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      minHeight: 34,
    },
    counterButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
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
