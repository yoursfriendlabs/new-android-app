import { type StyleProp, type ViewStyle, Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { palette, radius, spacing, typography } from '@/src/theme';

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
  activeBackgroundColor = palette.primary,
  activeTextColor = palette.white,
  style,
  contentContainerStyle,
  inactiveBackgroundColor = palette.backgroundAlt,
  inactiveTextColor = palette.textMuted,
  onChange,
  options,
  value,
}: SegmentedTabsProps<T>) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      style={[style, { flexGrow: 0 }]}
      contentContainerStyle={[styles.wrap, contentContainerStyle]}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            style={[
              styles.pill,
              { backgroundColor: inactiveBackgroundColor },
              active && [styles.pillActive, { backgroundColor: activeBackgroundColor }],
            ]}
            onPress={() => onChange(option.value)}>
            <Text
              numberOfLines={1}
              style={[
                styles.label,
                { color: inactiveTextColor },
                active && [styles.labelActive, { color: activeTextColor }],
              ]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    minHeight: 44,
    alignItems: 'center',
  },
  pill: {
    flexShrink: 0,
    alignSelf: 'flex-start',
    minHeight: 34,
    paddingHorizontal: spacing.md,
    paddingVertical: 0,
    borderRadius: radius.pill,
    backgroundColor: palette.backgroundAlt,
    justifyContent: 'center',
    maxWidth: 220,
  },
  pillActive: {
    backgroundColor: palette.primary,
  },
  label: {
    fontSize: typography.label,
    fontWeight: '700',
    color: palette.textMuted,
    flexShrink: 1,
  },
  labelActive: {
    color: palette.white,
  },
});
