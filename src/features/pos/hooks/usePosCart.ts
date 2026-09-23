import { Alert } from 'react-native';

import { isServiceProduct, sellableStock as sellableOf, toCartLine } from '@/src/features/pos/lib/cart-line';
import type { Product } from '@/src/types/models';
import type { PosDraft } from '@/src/types/forms';

export function usePosCart(
  products: Product[] | undefined,
  setValue: (updater: (current: PosDraft) => PosDraft) => void,
  /** Called when a line that was already saved is taken off the bill. */
  onLineRemoved?: (saleItemId: string) => void,
) {
  function updateCart(productId: string, direction: 'add' | 'subtract') {
    const product = (products ?? []).find((entry) => entry.id === productId);
    if (!product) return;

    const totalStock = Number(product.stockOnHand ?? 0);
    const expiredQty = Number(product.expiredQuantity ?? 0);
    const sellableStock = sellableOf(product);

    if (direction === 'add' && !isServiceProduct(product)) {
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
        items = [...current.items, toCartLine(product, 1)];
      } else if (existing) {
        const nextQty = existing.quantity + (direction === 'add' ? 1 : -1);
        if (
          direction === 'add' &&
          !isServiceProduct(product) &&
          nextQty > sellableStock
        ) {
          Alert.alert(
            'Insufficient sellable stock',
            `Only ${sellableStock} ${product.primaryUnit || 'units'} of non-expired stock available.`,
          );
          return current;
        }

        if (nextQty <= 0 && existing.saleItemId) {
          onLineRemoved?.(existing.saleItemId);
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
