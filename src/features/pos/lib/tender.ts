export function buildTenderOptions(grandTotal: number) {
  const total = Math.max(Number(grandTotal || 0), 0);
  const roundTotal = Math.ceil(total);
  const options: Array<{ label: string; value: number }> = [{ label: 'Exact', value: total }];

  [100, 500, 1000, 2000, 5000].forEach((denom) => {
    if (denom >= roundTotal && !options.some((option) => Math.abs(option.value - denom) < 0.01)) {
      options.push({ label: `Rs ${denom}`, value: denom });
    }
  });

  if (options.length === 1 && total > 0) {
    const next100 = Math.ceil(total / 100) * 100;
    const next500 = Math.ceil(total / 500) * 500;
    if (next100 > total) options.push({ label: `Rs ${next100}`, value: next100 });
    if (next500 > next100) options.push({ label: `Rs ${next500}`, value: next500 });
  }

  return options;
}
