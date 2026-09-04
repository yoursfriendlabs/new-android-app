import { Pressable, StyleSheet, Text, View } from 'react-native';

import { usePalette } from '@/src/stores/theme-store';
import { useTranslation } from '@/src/i18n';
import { radius, spacing, typography } from '@/src/theme';
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
  activeBackgroundColor,
  activeTextColor,
  inactiveBackgroundColor,
  inactiveTextColor,
  onChange,
  value,
}: PaymentMethodSelectorProps) {
  const colors = usePalette();
  const { t } = useTranslation();
  const activeBg = activeBackgroundColor ?? colors.primary;
  const activeFg = activeTextColor ?? colors.onPrimary;
  const inactiveBg = inactiveBackgroundColor ?? colors.backgroundAlt;
  const inactiveFg = inactiveTextColor ?? colors.text;

  return (
    <View style={styles.row}>
      {(['cash', 'bank'] as PaymentMethod[]).map((item) => {
        const active = item === value;
        return (
          <Pressable
            key={item}
            style={[styles.option, { backgroundColor: active ? activeBg : inactiveBg }]}
            onPress={() => onChange(item)}>
            <Text style={[styles.label, { color: active ? activeFg : inactiveFg }]}>
              {item === 'cash' ? t('common.cash') : t('common.bank')}
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: typography.body,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
});
