import { useMemo } from 'react';
import { computeGrandTotal, computeSubTotal, computeTaxTotal } from '@/src/shared/lib/totals';
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

  const taxTotal = useMemo(() => {
    if (value.taxOverride !== undefined && Number.isFinite(value.taxOverride)) {
      return Math.max(0, value.taxOverride);
    }
    return computeTaxTotal(
      value.items.map((item) => ({
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxRate: item.taxRate,
      })),
    );
  }, [value.items, value.taxOverride]);

  const grandTotal = useMemo(() => {
    return Math.max(0, subTotal + taxTotal - Number(value.discount || 0));
  }, [subTotal, taxTotal, value.discount]);

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
