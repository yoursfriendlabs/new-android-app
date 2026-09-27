import { StyleSheet, Text } from 'react-native';

import { usePalette } from '@/src/stores/theme-store';
import { typography } from '@/src/theme';

/**
 * The message under a control that is not a FormField — a picker row, a chip
 * group, a date box. FormField prints its own; this keeps the wording, colour
 * and screen-reader announcement identical for everything else.
 */
export function FieldError({ message }: { message?: string }) {
  const colors = usePalette();
  if (!message) return null;
  return (
    <Text accessibilityLiveRegion="polite" style={[styles.text, { color: colors.danger }]}>
      {message}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    fontSize: typography.caption,
    fontWeight: '600',
    lineHeight: 18,
  },
});
