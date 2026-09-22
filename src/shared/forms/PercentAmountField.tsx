import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { FormField } from '@/src/shared/forms/FormField';
import { spacing } from '@/src/theme';

interface PercentAmountFieldProps {
  label: string;
  /** What the percentage is taken of, e.g. the subtotal. */
  base: number;
  /** The amount in money. This is what gets saved. */
  amount: number;
  /** Called with undefined when both boxes are cleared. */
  onChangeAmount: (amount: number | undefined) => void;
  helperText?: string;
}

const round2 = (value: number) => Math.round(value * 100) / 100;
const toNumber = (text: string) => {
  const value = Number(text.replace(/,/g, ''));
  return Number.isFinite(value) ? value : 0;
};

/**
 * Two linked boxes: type a percentage and the amount is worked out, or type the
 * amount and the percentage is worked out. A percentage keeps applying when
 * the base changes, so 10% off stays 10% as items are added.
 */
export function PercentAmountField({ amount, base, helperText, label, onChangeAmount }: PercentAmountFieldProps) {
  const [percentText, setPercentText] = useState<string | null>(null);
  const [amountText, setAmountText] = useState<string | null>(null);
  const previousBase = useRef(base);

  useEffect(() => {
    const oldBase = previousBase.current;
    previousBase.current = base;
    if (percentText === null || oldBase === base) return;
    const percent = toNumber(percentText);
    // Only follow the new base if the amount still comes from this percentage.
    if (round2((oldBase * percent) / 100) !== round2(amount)) return;
    onChangeAmount(round2((base * percent) / 100));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base]);

  const percentFromAmount = base > 0 && amount > 0 ? round2((amount / base) * 100) : 0;
  const percentShown =
    percentText !== null && round2((base * toNumber(percentText)) / 100) === round2(amount)
      ? percentText
      : percentFromAmount
        ? String(percentFromAmount)
        : '';
  const amountShown =
    amountText !== null && toNumber(amountText) === round2(amount) ? amountText : amount ? String(round2(amount)) : '';

  return (
    <View style={styles.wrap}>
      <View style={styles.percent}>
        <FormField
          label={`${label} %`}
          value={percentShown}
          onChangeText={(text) => {
            setAmountText(null);
            if (!text.trim()) {
              setPercentText(null);
              onChangeAmount(undefined);
              return;
            }
            setPercentText(text);
            onChangeAmount(round2((base * toNumber(text)) / 100));
          }}
          keyboardType="decimal-pad"
          placeholder="0"
        />
      </View>
      <View style={styles.amount}>
        <FormField
          label={`${label} amount`}
          value={amountShown}
          helperText={helperText}
          onChangeText={(text) => {
            setPercentText(null);
            if (!text.trim()) {
              setAmountText(null);
              onChangeAmount(undefined);
              return;
            }
            setAmountText(text);
            onChangeAmount(round2(toNumber(text)));
          }}
          keyboardType="decimal-pad"
          placeholder="0"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  percent: {
    flex: 2,
  },
  amount: {
    flex: 3,
  },
});
