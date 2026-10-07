import { useEffect, useState } from 'react';
import { StyleSheet, TextInput, type StyleProp, type TextStyle } from 'react-native';

import { usePalette } from '@/src/stores/theme-store';
import { radius, typography } from '@/src/theme';
import type { AppPalette } from '@/src/theme/app-palette';
import { useThemedStyles } from '@/src/theme/use-themed-styles';

interface QuantityInputProps {
  value: number;
  /** Called once typing is done, with the number typed (0 removes the line). */
  onCommit: (quantity: number) => void;
  accessibilityLabel?: string;
  style?: StyleProp<TextStyle>;
}

function formatQuantity(value: number) {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(3)));
}

/**
 * The count between the minus and plus buttons, typed straight in. The cart
 * only changes when the box loses focus or the keyboard is closed, so a
 * half-typed "1" on the way to "12" never lands on the bill.
 */
export function QuantityInput({ accessibilityLabel, onCommit, style, value }: QuantityInputProps) {
  const colors = usePalette();
  const styles = useThemedStyles(createStyles);
  const [text, setText] = useState(formatQuantity(value));
  const [editing, setEditing] = useState(false);

  // Plus and minus change the value from outside; follow them unless typing.
  useEffect(() => {
    if (!editing) setText(formatQuantity(value));
  }, [editing, value]);

  function commit() {
    setEditing(false);
    const parsed = Number(text.replace(',', '.'));
    if (!text.trim() || !Number.isFinite(parsed) || parsed < 0) {
      setText(formatQuantity(value));
      return;
    }
    const next = Number(parsed.toFixed(3));
    if (next !== value) onCommit(next);
    else setText(formatQuantity(value));
  }

  return (
    <TextInput
      accessibilityLabel={accessibilityLabel}
      value={text}
      onChangeText={(next) => setText(next.replace(/[^0-9.,]/g, ''))}
      onFocus={() => setEditing(true)}
      onBlur={commit}
      onSubmitEditing={commit}
      keyboardType="decimal-pad"
      returnKeyType="done"
      selectTextOnFocus
      maxLength={8}
      textAlign="center"
      placeholderTextColor={colors.textSoft}
      style={[styles.input, style]}
    />
  );
}

const createStyles = (colors: AppPalette) =>
  StyleSheet.create({
    input: {
      minWidth: 44,
      height: 32,
      paddingHorizontal: 4,
      paddingVertical: 0,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      color: colors.text,
      fontSize: typography.body,
      fontWeight: '800',
    },
  });
