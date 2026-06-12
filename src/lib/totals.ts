interface TotalsInput {
  quantity: number;
  unitPrice: number;
  taxRate?: number;
}

export function computeLineTotal({ quantity, unitPrice }: TotalsInput) {
  return Number((quantity * unitPrice).toFixed(2));
}

export function computeTaxTotal(lines: TotalsInput[]) {
  return Number(
    lines
      .reduce((sum, line) => {
        const lineTotal = computeLineTotal(line);
        return sum + lineTotal * ((line.taxRate ?? 0) / 100);
      }, 0)
      .toFixed(2),
  );
}

export function computeSubTotal(lines: TotalsInput[]) {
  return Number(lines.reduce((sum, line) => sum + computeLineTotal(line), 0).toFixed(2));
}

export function computeGrandTotal(lines: TotalsInput[], discount = 0) {
  const subTotal = computeSubTotal(lines);
  const taxTotal = computeTaxTotal(lines);
  return Number(Math.max(subTotal + taxTotal - discount, 0).toFixed(2));
}
