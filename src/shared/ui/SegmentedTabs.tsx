import { type StyleProp, type ViewStyle, ScrollView, StyleSheet } from 'react-native';

import { FilterChip } from '@/src/shared/ui/FilterChip';
import { spacing } from '@/src/theme';

interface SegmentedTabsProps<T extends string> {
  value: T;
  options: Array<{ label: string; value: T }>;
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  activeBackgroundColor?: string;
  inactiveBackgroundColor?: string;
  activeTextColor?: string;
  inactiveTextColor?: string;
}

export function SegmentedTabs<T extends string>({
  activeBackgroundColor,
  activeTextColor,
  style,
  contentContainerStyle,
  inactiveBackgroundColor,
  inactiveTextColor,
  onChange,
  options,
  value,
}: SegmentedTabsProps<T>) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      style={[style, styles.scroll]}
      contentContainerStyle={[styles.wrap, contentContainerStyle]}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <FilterChip
            key={option.value}
            label={option.label}
            selected={active}
            backgroundColor={active ? activeBackgroundColor : inactiveBackgroundColor}
            textColor={active ? activeTextColor : inactiveTextColor}
            onPress={() => onChange(option.value)}
          />
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0, flexShrink: 0 },
  wrap: {
    gap: spacing.xs,
    alignItems: 'center',
  },
});
