import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

import { coinLabel } from '@/src/features/habits/lib/coins';
import { usePalette } from '@/src/stores/theme-store';
import { radius, spacing, typography } from '@/src/theme';

interface CoinChipProps {
  coins: number;
  compact?: boolean;
}

export function CoinChip({ coins, compact = false }: CoinChipProps) {
  const colors = usePalette();
  return (
    <Pressable
      onPress={() => router.push('/(app)/coins' as any)}
      style={[styles.chip, { backgroundColor: colors.warningSoft }]}>
      <MaterialCommunityIcons color={colors.warning} name="circle-multiple" size={16} />
      <Text style={[styles.label, { color: colors.warning }]}>
        {compact ? Math.round(coins) : coinLabel(coins)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 32,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    fontSize: typography.caption,
    fontWeight: '800',
  },
});
