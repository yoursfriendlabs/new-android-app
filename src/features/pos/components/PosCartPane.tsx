import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, StyleSheet, View } from 'react-native';

import { haptics } from '@/src/shared/lib/haptics';
import { EmptyState } from '@/src/shared/ui/EmptyState';
import { SurfaceCard } from '@/src/shared/ui/SurfaceCard';
import { Money, Text } from '@/src/shared/ui/Text';
import { TotalsCard } from '@/src/shared/ui/TotalsCard';
import { usePalette } from '@/src/stores/theme-store';
import { a11y, radius, spacing } from '@/src/theme';
import type { AppPalette } from '@/src/theme/app-palette';
import { useThemedStyles } from '@/src/theme/use-themed-styles';
import type { PosDraft } from '@/src/types/forms';
import type { Product } from '@/src/types/models';

type CartItem = PosDraft['items'][number];

interface PosCartPaneProps {
  items: CartItem[];
  products: Product[];
  subTotal: number;
  taxTotal: number;
  discountTotal: number;
  grandTotal: number;
  amountReceived: number;
  onAdd: (productId: string) => void;
  onSubtract: (productId: string) => void;
  onToggleUnit: (productId: string, unitType: 'primary' | 'secondary') => void;
  onCheckout: () => void;
}

function secondaryPrice(product: Product | undefined, item: CartItem) {
  if (product?.salePrice && item.secondaryConversionRate) {
    return Number((product.salePrice / item.secondaryConversionRate).toFixed(2));
  }
  return item.unitPrice;
}

/** The running bill — shown as a side pane on tablets. */
export function PosCartPane({
  amountReceived,
  discountTotal,
  grandTotal,
  items,
  onAdd,
  onCheckout,
  onSubtract,
  onToggleUnit,
  products,
  subTotal,
  taxTotal,
}: PosCartPaneProps) {
  const colors = usePalette();
  const styles = useThemedStyles(createStyles);
  const hasItems = items.length > 0;

  return (
    <SurfaceCard>
      <View style={styles.items}>
        {items.map((item) => {
          const product = products.find((entry) => entry.id === item.productId);
          const usesSecondary = item.unitType === 'secondary';

          return (
            <View key={item.productId} style={styles.itemBlock}>
              <View style={styles.row}>
                <View style={styles.copy}>
                  <Text variant="bodyStrong" numberOfLines={1}>
                    {item.name}
                  </Text>
                  <View style={styles.metaRow}>
                    <Text variant="caption" tone="muted">
                      {item.quantity} {item.unit} ×{' '}
                    </Text>
                    <Money value={item.unitPrice} variant="caption" tone="muted" />
                  </View>
                </View>

                <View style={styles.controls}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Remove one ${item.name}`}
                    hitSlop={a11y.hitSlop}
                    style={({ pressed }) => [styles.stepButton, pressed && styles.pressed]}
                    onPress={() => {
                      haptics.selection();
                      onSubtract(item.productId);
                    }}>
                    <MaterialCommunityIcons color={colors.text} name="minus" size={16} />
                  </Pressable>
                  <Text variant="numeric" style={styles.quantity}>
                    {item.quantity}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Add one ${item.name}`}
                    hitSlop={a11y.hitSlop}
                    style={({ pressed }) => [
                      styles.stepButton,
                      { backgroundColor: colors.primary },
                      pressed && styles.pressed,
                    ]}
                    onPress={() => {
                      haptics.selection();
                      onAdd(item.productId);
                    }}>
                    <MaterialCommunityIcons color={colors.onPrimary} name="plus" size={16} />
                  </Pressable>
                </View>
              </View>

              {item.secondaryUnit ? (
                <View style={styles.unitRow}>
                  {(
                    [
                      {
                        type: 'primary' as const,
                        label: item.primaryUnit || 'Primary',
                        price: product?.salePrice ?? item.unitPrice,
                        active: !usesSecondary,
                      },
                      {
                        type: 'secondary' as const,
                        label: item.secondaryUnit,
                        price: secondaryPrice(product, item),
                        active: usesSecondary,
                      },
                    ]
                  ).map((unit) => (
                    <Pressable
                      key={unit.type}
                      accessibilityRole="button"
                      accessibilityState={{ selected: unit.active }}
                      style={[styles.unitChip, unit.active && styles.unitChipActive]}
                      onPress={() => {
                        haptics.selection();
                        onToggleUnit(item.productId, unit.type);
                      }}>
                      <Text variant="caption" tone={unit.active ? 'onPrimary' : 'muted'}>
                        {unit.label}
                      </Text>
                      <Money
                        value={unit.price}
                        variant="caption"
                        tone={unit.active ? 'onPrimary' : 'muted'}
                      />
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
          );
        })}

        {!hasItems ? (
          <EmptyState
            icon="cart-outline"
            title="Cart is empty"
            message="Search a product and tap it to start the bill."
          />
        ) : null}
      </View>

      <TotalsCard
        subTotal={subTotal}
        taxTotal={taxTotal}
        discountTotal={discountTotal}
        grandTotal={grandTotal}
        amountReceived={amountReceived}
      />

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !hasItems }}
        style={({ pressed }) => [
          styles.checkout,
          { backgroundColor: hasItems ? colors.primary : colors.backgroundAlt },
          pressed && styles.pressed,
        ]}
        disabled={!hasItems}
        onPress={() => {
          haptics.tapMedium();
          onCheckout();
        }}>
        <Text variant="bodyStrong" tone={hasItems ? 'onPrimary' : 'soft'}>
          Checkout
        </Text>
      </Pressable>
    </SurfaceCard>
  );
}

const createStyles = (colors: AppPalette) =>
  StyleSheet.create({
    items: {
      gap: spacing.sm,
    },
    itemBlock: {
      gap: spacing.xs,
      paddingBottom: spacing.xs,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    copy: {
      flex: 1,
      gap: 2,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    controls: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    stepButton: {
      width: 32,
      height: 32,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.backgroundAlt,
    },
    pressed: {
      opacity: 0.8,
    },
    quantity: {
      minWidth: 28,
      textAlign: 'center',
    },
    unitRow: {
      flexDirection: 'row',
      gap: spacing.xs,
    },
    unitChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: spacing.sm,
      paddingVertical: 6,
      borderRadius: radius.pill,
      backgroundColor: colors.backgroundAlt,
    },
    unitChipActive: {
      backgroundColor: colors.primary,
    },
    checkout: {
      minHeight: 50,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: spacing.sm,
    },
  });
