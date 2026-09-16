function toNonNegativeAmount(value: number) {
  return Number.isFinite(value) ? Math.max(value, 0) : 0;
}

export function calculateServicePayment(grandTotal: number, tenderedAmount: number) {
  const total = toNonNegativeAmount(grandTotal);
  const tendered = toNonNegativeAmount(tenderedAmount);
  const receivedTotal = Math.min(tendered, total);

  return {
    tendered,
    receivedTotal,
    changeDue: Math.max(tendered - total, 0),
    balanceDue: Math.max(total - receivedTotal, 0),
  };
}
