import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { usePalette } from '@/src/stores/theme-store';
import { a11y, radius, spacing, typography } from '@/src/theme';
import type { AppPalette } from '@/src/theme/app-palette';

interface FilterChipProps {
  label: string;
  selected?: boolean;
  onPress: () => void;
  icon?: ReactNode;
  disabled?: boolean;
  backgroundColor?: string;
  textColor?: string;
}

/** Dashboard-sized pill, with a separate 48dp touch target. */
export function FilterChip({ label, selected, onPress, icon, disabled, backgroundColor, textColor }: FilterChipProps) {
  const colors = usePalette();
  const styles = createStyles(colors);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      aria-selected={selected}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.target, (pressed || disabled) && styles.dimmed]}>
      <View style={[
        styles.pill,
        selected && styles.selected,
        backgroundColor ? { backgroundColor, borderColor: selected ? backgroundColor : colors.border } : null,
      ]}>
        {icon ? <View accessible={false} importantForAccessibility="no-hide-descendants">{icon}</View> : null}
        <Text style={[styles.label, selected && styles.selectedLabel, textColor ? { color: textColor } : null]}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const createStyles = (colors: AppPalette) => StyleSheet.create({
  target: {
    minHeight: a11y.minTouchTarget,
    minWidth: a11y.minTouchTarget,
    maxWidth: '100%',
    alignSelf: 'flex-start',
    justifyContent: 'center',
    paddingVertical: 7,
    flexShrink: 0,
  },
  pill: {
    minHeight: 34,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xxs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxs,
  },
  selected: { backgroundColor: colors.primary, borderColor: colors.primary },
  label: { fontSize: typography.label, fontWeight: '700', color: colors.textMuted, flexShrink: 1 },
  selectedLabel: { color: colors.onPrimary },
  dimmed: { opacity: 0.8 },
});
