import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/src/shared/feedback/BottomSheet';
import { formatCurrency } from '@/src/shared/lib/format';
import { usePalette } from '@/src/stores/theme-store';
import { radius, spacing, typography } from '@/src/theme';

const GOALS = [2000, 5000, 10000, 20000, 50000];

interface SaveGoalSheetProps {
  visible: boolean;
  currency: string;
  value: number;
  onClose: () => void;
  onSave: (amount: number) => void;
}

export function SaveGoalSheet({ currency, onClose, onSave, value, visible }: SaveGoalSheetProps) {
  const colors = usePalette();

  return (
    <BottomSheet
      visible={visible}
      title="Monthly save goal"
      subtitle="A target makes the streak mean something."
      onClose={onClose}>
      <View style={styles.wrap}>
        {GOALS.map((amount) => {
          const active = value === amount;
          return (
            <Pressable
              key={amount}
              style={[
                styles.chip,
                {
                  backgroundColor: active ? colors.primary : colors.backgroundAlt,
                  borderColor: active ? colors.primary : colors.border,
                },
              ]}
              onPress={() => {
                onSave(amount);
                onClose();
              }}>
              <Text style={[styles.chipLabel, { color: active ? colors.white : colors.text }]}>
                {formatCurrency(amount, currency)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  chip: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: 'center',
  },
  chipLabel: {
    fontSize: typography.body,
    fontWeight: '800',
  },
});
