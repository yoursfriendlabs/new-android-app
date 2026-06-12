import { Pressable, StyleSheet, Text, View } from 'react-native';

import { palette, radius, spacing, typography } from '@/src/theme';
import type { PaymentMethod } from '@/src/types/models';

interface PaymentMethodSelectorProps {
  value: PaymentMethod;
  onChange: (value: PaymentMethod) => void;
  activeBackgroundColor?: string;
  activeTextColor?: string;
  inactiveBackgroundColor?: string;
  inactiveTextColor?: string;
}

export function PaymentMethodSelector({
  activeBackgroundColor = palette.primary,
  activeTextColor = palette.white,
  inactiveBackgroundColor = palette.backgroundAlt,
  inactiveTextColor = palette.text,
  onChange,
  value,
}: PaymentMethodSelectorProps) {
  return (
    <View style={styles.row}>
      {(['cash', 'bank'] as PaymentMethod[]).map((item) => {
        const active = item === value;
        return (
          <Pressable
            key={item}
            style={[
              styles.option,
              { backgroundColor: inactiveBackgroundColor },
              active && [styles.optionActive, { backgroundColor: activeBackgroundColor }],
            ]}
            onPress={() => onChange(item)}>
            <Text
              style={[
                styles.label,
                { color: inactiveTextColor },
                active && [styles.labelActive, { color: activeTextColor }],
              ]}>
              {item === 'cash' ? 'Cash' : 'Bank'}
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
    gap: spacing.sm,
  },
  option: {
    flex: 1,
    minHeight: 46,
    borderRadius: radius.md,
    backgroundColor: palette.backgroundAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionActive: {
    backgroundColor: palette.primary,
  },
  label: {
    fontSize: typography.body,
    fontWeight: '700',
    color: palette.text,
    textTransform: 'capitalize',
  },
  labelActive: {
    color: palette.white,
  },
});
