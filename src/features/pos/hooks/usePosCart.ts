import { Alert } from 'react-native';

import type { Product } from '@/src/types/models';
import type { PosDraft } from '@/src/types/forms';

export function usePosCart(
  products: Product[] | undefined,
  setValue: (updater: (current: PosDraft) => PosDraft) => void,
) {
  function updateCart(productId: string, direction: 'add' | 'subtract') {
    const product = (products ?? []).find((entry) => entry.id === productId);
    if (!product) return;

    const totalStock = Number(product.stockOnHand ?? 0);
    const expiredQty = Number(product.expiredQuantity ?? 0);
    const sellableStock = Number(product.sellableQuantity ?? Math.max(0, totalStock - expiredQty));

    if (direction === 'add' && String(product.itemType || 'goods').toLowerCase() !== 'service') {
      if (sellableStock <= 0) {
        if (expiredQty > 0) {
          Alert.alert(
            'All stock expired',
            `All ${totalStock} ${product.primaryUnit || 'units'} of "${product.name}" are expired and cannot be sold.`,
          );
        }
        return;
      }
    }

    setValue((current) => {
      const existing = current.items.find((item) => item.productId === productId);
      let items = current.items;

      if (!existing && direction === 'add') {
        items = [
          ...current.items,
          {
            productId: product.id,
            name: product.name,
            unit: product.primaryUnit,
            unitType: 'primary',
            primaryUnit: product.primaryUnit,
            secondaryUnit: product.secondaryUnit || undefined,
            secondaryConversionRate: product.secondaryConversionRate || undefined,
            categoryName: product.categoryName,
            stockOnHand: sellableStock,
            quantity: 1,
            unitPrice: product.salePrice,
            taxRate: product.taxRate ?? 0,
          },
        ];
      } else if (existing) {
        const nextQty = existing.quantity + (direction === 'add' ? 1 : -1);
        if (
          direction === 'add' &&
          String(product.itemType || 'goods').toLowerCase() !== 'service' &&
          nextQty > sellableStock
        ) {
          Alert.alert(
            'Insufficient sellable stock',
            `Only ${sellableStock} ${product.primaryUnit || 'units'} of non-expired stock available.`,
          );
          return current;
        }

        items = current.items
          .map((item) =>
            item.productId === productId
              ? {
                  ...item,
                  quantity: Math.max(nextQty, 0),
                }
              : item,
          )
          .filter((item) => item.quantity > 0);
      }

      return {
        ...current,
        items,
      };
    });
  }

  return {
    updateCart,
  };
}
