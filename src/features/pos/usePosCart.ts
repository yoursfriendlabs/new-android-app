import type { Product } from '@/src/types/models';
import type { PosDraft } from '@/src/types/forms';

export function usePosCart(
  products: Product[] | undefined,
  setValue: (updater: (current: PosDraft) => PosDraft) => void,
) {
  function updateCart(productId: string, direction: 'add' | 'subtract') {
    const product = (products ?? []).find((entry) => entry.id === productId);
    if (!product) return;

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
            stockOnHand: product.stockOnHand,
            quantity: 1,
            unitPrice: product.salePrice,
            taxRate: product.taxRate ?? 0,
          },
        ];
      } else if (existing) {
        items = current.items
          .map((item) =>
            item.productId === productId
              ? {
                  ...item,
                  quantity: Math.max(item.quantity + (direction === 'add' ? 1 : -1), 0),
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
