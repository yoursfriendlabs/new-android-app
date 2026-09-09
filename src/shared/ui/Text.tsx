import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';

import { formatCurrency } from '@/src/shared/lib/format';
import { usePalette } from '@/src/stores/theme-store';
import { typeScale, type TypeVariant } from '@/src/theme';
import type { AppPalette } from '@/src/theme/app-palette';

export type TextTone =
  | 'default'
  | 'muted'
  | 'soft'
  | 'primary'
  | 'success'
  | 'danger'
  | 'warning'
  | 'onPrimary';

function toneColor(tone: TextTone, colors: AppPalette) {
  switch (tone) {
    case 'muted':
      return colors.textMuted;
    case 'soft':
      return colors.textSoft;
    case 'primary':
      return colors.primary;
    case 'success':
      return colors.success;
    case 'danger':
      return colors.danger;
    case 'warning':
      return colors.warning;
    case 'onPrimary':
      return colors.onPrimary;
    default:
      return colors.text;
  }
}

export interface TextProps extends RNTextProps {
  variant?: TypeVariant;
  tone?: TextTone;
  /** Overrides `tone` when you need a one-off colour. */
  color?: string;
  align?: TextStyle['textAlign'];
  weight?: TextStyle['fontWeight'];
}

/**
 * The app's text. Pick a `variant` instead of writing fontSize/fontWeight by hand,
 * so type stays consistent and every screen follows the theme.
 */
export function Text({
  align,
  color,
  style,
  tone = 'default',
  variant = 'body',
  weight,
  ...rest
}: TextProps) {
  const colors = usePalette();

  return (
    <RNText
      {...rest}
      style={[
        typeScale[variant],
        { color: color ?? toneColor(tone, colors) },
        align ? { textAlign: align } : null,
        weight ? { fontWeight: weight } : null,
        style,
      ]}
    />
  );
}

export interface MoneyProps extends Omit<TextProps, 'children'> {
  value: number;
  currency?: string;
  /** Renders `••••` instead of the amount — used by the balance-privacy toggle. */
  hidden?: boolean;
  /** Prefixes + or − and colours the amount green or red. */
  signed?: boolean;
}

/** Currency amounts with tabular figures, so columns of numbers line up. */
export function Money({
  currency = 'NPR',
  hidden = false,
  signed = false,
  tone,
  value,
  variant = 'numeric',
  ...rest
}: MoneyProps) {
  const amount = formatCurrency(Math.abs(value), currency);
  const positive = value >= 0;
  const resolvedTone: TextTone = tone ?? (signed ? (positive ? 'success' : 'danger') : 'default');
  const prefix = signed ? (positive ? '+' : '-') : '';

  return (
    <Text {...rest} variant={variant} tone={resolvedTone}>
      {hidden ? '••••' : `${prefix}${amount}`}
    </Text>
  );
}
