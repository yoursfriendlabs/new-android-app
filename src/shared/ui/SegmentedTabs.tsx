import { type StyleProp, type ViewStyle, Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { usePalette } from '@/src/stores/theme-store';
import { radius, spacing, typography } from '@/src/theme';

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
  const colors = usePalette();
  const resolvedActiveBackground = activeBackgroundColor ?? colors.primary;
  const resolvedActiveText = activeTextColor ?? colors.onPrimary;
  const resolvedInactiveBackground = inactiveBackgroundColor ?? colors.backgroundAlt;
  const resolvedInactiveText = inactiveTextColor ?? colors.textMuted;
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
              { backgroundColor: resolvedInactiveBackground },
              active && [styles.pillActive, { backgroundColor: resolvedActiveBackground }],
            ]}
            onPress={() => onChange(option.value)}>
            <Text
              numberOfLines={1}
              style={[
                styles.label,
                { color: resolvedInactiveText },
                active && [styles.labelActive, { color: resolvedActiveText }],
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
    justifyContent: 'center',
    maxWidth: 220,
  },
  pillActive: {},
  label: {
    fontSize: typography.label,
    fontWeight: '700',
    flexShrink: 1,
  },
  labelActive: {},
});
