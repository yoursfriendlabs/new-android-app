import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatCurrency } from '@/src/lib/format';
import { palette, radius, spacing, typography } from '@/src/theme';

const keypadRows = [
  ['AC', '%', '÷', '⌫'],
  ['7', '8', '9', '×'],
  ['4', '5', '6', '−'],
  ['1', '2', '3', '+'],
  ['0', '.', '='],
] as const;

interface AmountKeypadProps {
  value: number;
  onChange: (nextValue: number) => void;
}

export function AmountKeypad({ onChange, value }: AmountKeypadProps) {
  const [expression, setExpression] = useState(value > 0 ? String(value) : '0');

  useEffect(() => {
    const normalizedExternalValue = value > 0 ? String(value) : '0';
    if (!/[+\-×÷−]/.test(expression) && expression !== normalizedExternalValue) {
      setExpression(normalizedExternalValue);
    }
  }, [expression, value]);

  function normalizeOperators(nextExpression: string) {
    return nextExpression.replace(/÷/g, '/').replace(/×/g, '*').replace(/−/g, '-');
  }

  function safeEvaluate(nextExpression: string) {
    const normalized = normalizeOperators(nextExpression).replace(/[^0-9+\-*/.()]/g, '');
    if (!normalized) return 0;

    try {
      const result = Function(`"use strict"; return (${normalized});`)();
      const number = Number(result);
      return Number.isFinite(number) ? number : 0;
    } catch {
      return 0;
    }
  }

  function commit(nextExpression: string, evaluate = false) {
    const cleanedExpression = nextExpression || '0';
    setExpression(cleanedExpression);

    const result = safeEvaluate(cleanedExpression);
    const normalized = Math.round(result * 100) / 100;

    if (evaluate) {
      setExpression(String(normalized));
    }

    onChange(Number.isFinite(normalized) ? normalized : 0);
  }

  function handleKeyPress(key: string) {
    if (key === 'AC') {
      commit('0');
      return;
    }

    if (key === '⌫') {
      commit(expression.length > 1 ? expression.slice(0, -1) : '0');
      return;
    }

    if (key === '=') {
      commit(expression, true);
      return;
    }

    if (key === '%') {
      const result = safeEvaluate(expression) / 100;
      const normalized = Math.round(result * 100) / 100;
      setExpression(String(normalized));
      onChange(normalized);
      return;
    }

    const operators = ['+', '−', '×', '÷'];
    const lastChar = expression.slice(-1);

    if (operators.includes(key)) {
      if (operators.includes(lastChar)) {
        commit(`${expression.slice(0, -1)}${key}`);
      } else {
        commit(`${expression}${key}`);
      }
      return;
    }

    if (key === '.' && /(^|[+\-×÷−])\d*\.\d*$/.test(expression)) {
      return;
    }

    if (expression === '0' && key !== '.') {
      commit(key);
      return;
    }

    const nextExpression = key === '.' && /(^|[+\-×÷−])$/.test(expression)
      ? `${expression}0.`
      : `${expression}${key}`;
    commit(nextExpression);
  }

  return (
    <View style={styles.container}>
      <View style={styles.displayCard}>
        <Text style={styles.caption}>{formatCurrency(value || 0)}</Text>
        <Text numberOfLines={1} style={styles.expression}>
          {expression}
        </Text>
      </View>

      <View style={styles.keypad}>
        {keypadRows.map((row, rowIndex) => (
          <View key={`row-${rowIndex}`} style={styles.row}>
            {row.map((key) => (
              <Pressable
                key={key}
                style={({ pressed }) => [
                  styles.key,
                  key === '=' && styles.keyPrimary,
                  key === '0' && row.length === 3 && styles.keyWide,
                  pressed && styles.keyPressed,
                ]}
                onPress={() => handleKeyPress(key)}>
                <Text style={[styles.keyLabel, key === '=' && styles.keyLabelPrimary]}>{key}</Text>
              </Pressable>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  displayCard: {
    borderRadius: radius.md,
    backgroundColor: palette.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 140,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: palette.border,
  },
  caption: {
    fontSize: typography.label,
    fontWeight: '700',
    color: palette.textSoft,
    textAlign: 'right',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  expression: {
    fontSize: 42,
    fontWeight: '800',
    color: palette.text,
    textAlign: 'right',
  },
  keypad: {
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  key: {
    flex: 1,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.border,
  },
  keyWide: {
    flex: 2.2,
  },
  keyPrimary: {
    backgroundColor: palette.success,
    borderColor: palette.success,
  },
  keyPressed: {
    backgroundColor: palette.backgroundAlt,
  },
  keyLabel: {
    fontSize: 22,
    fontWeight: '800',
    color: palette.text,
  },
  keyLabelPrimary: {
    color: palette.white,
  },
});
