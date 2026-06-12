import { useMemo } from 'react';
import { computeGrandTotal, computeSubTotal, computeTaxTotal } from '@/src/lib/totals';
import type { PosDraft } from '@/src/types/forms';

export function usePosTotals(value: PosDraft) {
  const subTotal = useMemo(
    () =>
      computeSubTotal(
        value.items.map((item) => ({
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          taxRate: item.taxRate,
        })),
      ),
    [value.items],
  );

  const taxTotal = useMemo(
    () =>
      computeTaxTotal(
        value.items.map((item) => ({
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          taxRate: item.taxRate,
        })),
      ),
    [value.items],
  );

  const grandTotal = useMemo(
    () =>
      computeGrandTotal(
        value.items.map((item) => ({
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          taxRate: item.taxRate,
        })),
        value.discount,
      ),
    [value.discount, value.items],
  );

  const cartItemCount = useMemo(
    () => value.items.reduce((sum, item) => sum + item.quantity, 0),
    [value.items],
  );

  return {
    subTotal,
    taxTotal,
    grandTotal,
    cartItemCount,
  };
}
