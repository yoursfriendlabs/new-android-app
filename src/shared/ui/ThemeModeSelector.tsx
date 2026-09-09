import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { haptics } from '@/src/shared/lib/haptics';
import { Text } from '@/src/shared/ui/Text';
import { usePalette, useThemeStore, type ThemeModePreference } from '@/src/stores/theme-store';
import { radius, spacing } from '@/src/theme';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

const OPTIONS: Array<{ value: ThemeModePreference; label: string; icon: IconName }> = [
  { value: 'system', label: 'System', icon: 'cellphone-cog' },
  { value: 'light', label: 'Light', icon: 'white-balance-sunny' },
  { value: 'dark', label: 'Dark', icon: 'weather-night' },
];

/** Light / dark / follow-the-phone switch. Sits above the colour picker. */
export function ThemeModeSelector({ compact = false }: { compact?: boolean }) {
  const colors = usePalette();
  const preference = useThemeStore((state) => state.modePreference);
  const setModePreference = useThemeStore((state) => state.setModePreference);

  return (
    <View style={[styles.row, { backgroundColor: colors.backgroundAlt }]}>
      {OPTIONS.map((option) => {
        const selected = preference === option.value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`${option.label} appearance`}
            onPress={() => {
              haptics.selection();
              void setModePreference(option.value);
            }}
            style={[
              styles.option,
              compact && styles.optionCompact,
              selected && { backgroundColor: colors.surface },
            ]}>
            <MaterialCommunityIcons
              name={option.icon}
              size={16}
              color={selected ? colors.primary : colors.textMuted}
            />
            <Text variant="label" tone={selected ? 'default' : 'muted'}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    borderRadius: radius.input,
    padding: 4,
    gap: 4,
  },
  option: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: 40,
    borderRadius: radius.sm,
  },
  optionCompact: {
    minHeight: 34,
  },
});
