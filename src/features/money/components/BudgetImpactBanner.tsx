import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';

import { useBudgetImpact } from '@/src/features/money/hooks/useBudgetImpact';
import { formatCurrency } from '@/src/shared/lib/format';
import { Text } from '@/src/shared/ui/Text';
import { usePalette } from '@/src/stores/theme-store';
import { radius, spacing } from '@/src/theme';
import type { AppPalette } from '@/src/theme/app-palette';
import type { BudgetImpactItem } from '@/src/types/models';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];
type Tone = 'danger' | 'warning' | 'success' | 'muted';

interface BudgetImpactBannerProps {
  kind: 'income' | 'expense';
  amount: number;
  category: string;
  date: string;
}

function describe(item: BudgetImpactItem): { tone: Tone; icon: IconName; text: string } {
  const { after } = item;
  if (item.scope === 'savings') {
    if (after.reached) {
      const room = after.spendRoom ?? 0;
      return {
        tone: 'success',
        icon: 'piggy-bank-outline',
        text: room > 0
          ? `${item.name}: on target, ${formatCurrency(room)} to spare`
          : `${item.name}: goal reached`,
      };
    }
    return {
      tone: (after.saved ?? 0) < 0 ? 'danger' : 'warning',
      icon: 'piggy-bank-outline',
      text: `${item.name}: ${formatCurrency(after.shortBy ?? 0)} short of your goal after this`,
    };
  }

  const remaining = after.remaining ?? 0;
  if (after.status === 'over') {
    return { tone: 'danger', icon: 'alert-circle-outline', text: `${item.name}: ${formatCurrency(Math.abs(remaining))} over budget after this` };
  }
  if (after.status === 'warning') {
    return { tone: 'warning', icon: 'alert-outline', text: `${item.name}: only ${formatCurrency(remaining)} left after this` };
  }
  return { tone: 'muted', icon: 'check-circle-outline', text: `${item.name}: ${formatCurrency(remaining)} left after this` };
}

function toneColor(tone: Tone, colors: AppPalette) {
  if (tone === 'danger') return colors.danger;
  if (tone === 'warning') return colors.warning;
  if (tone === 'success') return colors.success;
  return colors.textMuted;
}

/**
 * Shows, while the amount is typed, what this entry does to each budget and
 * saving goal it touches — and whether it still earns a coin. All numbers come
 * from GET /api/budgets/impact.
 */
export function BudgetImpactBanner({ amount, category, date, kind }: BudgetImpactBannerProps) {
  const colors = usePalette();
  const impactQuery = useBudgetImpact({ kind, amount, category, date });
  const impact = impactQuery.data;
  if (!impact || amount <= 0 || !impact.items.length) return null;

  const lines = impact.items.map((item) => ({ id: item.id, ...describe(item) }));
  const worst = lines.some((line) => line.tone === 'danger') ? 'danger' : lines.some((line) => line.tone === 'warning') ? 'warning' : 'ok';
  const background = worst === 'danger' ? colors.dangerSoft : worst === 'warning' ? colors.warningSoft : colors.backgroundAlt;

  return (
    <View style={[styles.card, { backgroundColor: background }]}>
      {lines.map((line) => (
        <View key={line.id} style={styles.row}>
          <MaterialCommunityIcons name={line.icon} size={16} color={toneColor(line.tone, colors)} />
          <Text variant="caption" color={toneColor(line.tone, colors)} style={styles.flex}>
            {line.text}
          </Text>
        </View>
      ))}
      {impact.overspending ? (
        <Text variant="caption" tone="danger" weight="700">
          You are overspending, so this entry won&apos;t earn a coin.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.md, padding: spacing.md, gap: spacing.xs, marginTop: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
});
