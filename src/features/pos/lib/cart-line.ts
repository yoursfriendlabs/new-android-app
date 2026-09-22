import type { CartLineDraft } from '@/src/types/forms';
import type { Product } from '@/src/types/models';

/** Stock that can be sold now: on hand minus anything expired. */
export function sellableStock(product: Product): number {
  const totalStock = Number(product.stockOnHand ?? 0);
  const expiredQty = Number(product.expiredQuantity ?? 0);
  return Number(product.sellableQuantity ?? Math.max(0, totalStock - expiredQty));
}

export function isServiceProduct(product: Product): boolean {
  return String(product.itemType || 'goods').toLowerCase() === 'service';
}

/** A bill line for a product at its listed sale price. */
export function toCartLine(product: Product, quantity = 1): CartLineDraft {
  return {
    productId: product.id,
    name: product.name,
    unit: product.primaryUnit,
    unitType: 'primary',
    primaryUnit: product.primaryUnit,
    secondaryUnit: product.secondaryUnit || undefined,
    secondaryConversionRate: product.secondaryConversionRate || undefined,
    categoryName: product.categoryName,
    stockOnHand: sellableStock(product),
    quantity,
    unitPrice: product.salePrice,
    taxRate: product.taxRate ?? 0,
  };
}
