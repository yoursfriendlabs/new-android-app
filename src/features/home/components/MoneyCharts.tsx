import { StyleSheet, Text, View } from 'react-native';

import { formatCurrency } from '@/src/shared/lib/format';
import { usePalette } from '@/src/stores/theme-store';
import { radius, spacing, typography } from '@/src/theme';
import { useThemedStyles } from '@/src/theme/use-themed-styles';
import type { AppPalette } from '@/src/theme/app-palette';
import type { FlowPoint } from '@/src/features/home/lib/flow-series';

interface MoneyChartsProps {
  series: FlowPoint[];
  incomeTotal: number;
  expenseTotal: number;
  currency: string;
  hideAmounts?: boolean;
}

export function MoneyCharts({ currency, expenseTotal, hideAmounts, incomeTotal, series }: MoneyChartsProps) {
  const colors = usePalette();
  const styles = useThemedStyles(createStyles);
  const peak = Math.max(...series.flatMap((point) => [point.income, point.expense]), 1);
  const combined = incomeTotal + expenseTotal;
  const saved = incomeTotal - expenseTotal;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.kicker, { color: colors.textMuted }]}>Last 7 days</Text>
          <Text style={[styles.title, { color: colors.text }]}>
            {hideAmounts ? '••••' : formatCurrency(Math.abs(saved), currency)}
          </Text>
          <Text style={[styles.hint, { color: saved >= 0 ? colors.success : colors.danger }]}>
            {saved >= 0 ? 'Net saved this week' : 'Net spent this week'}
          </Text>
        </View>
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: colors.success }]} />
            <Text style={[styles.legendLabel, { color: colors.textMuted }]}>In</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: colors.danger }]} />
            <Text style={[styles.legendLabel, { color: colors.textMuted }]}>Out</Text>
          </View>
        </View>
      </View>

      <View style={styles.bars}>
        {series.map((point) => (
          <View key={point.key} style={styles.day}>
            <View style={styles.pair}>
              <View
                style={[
                  styles.bar,
                  {
                    height: Math.max(4, (point.income / peak) * 88),
                    backgroundColor: point.income ? colors.success : colors.border,
                    opacity: point.income ? 1 : 0.45,
                  },
                ]}
              />
              <View
                style={[
                  styles.bar,
                  {
                    height: Math.max(4, (point.expense / peak) * 88),
                    backgroundColor: point.expense ? colors.danger : colors.border,
                    opacity: point.expense ? 1 : 0.45,
                  },
                ]}
              />
            </View>
            <Text style={[styles.dayLabel, { color: colors.textSoft }]}>{point.label}</Text>
          </View>
        ))}
      </View>

      <View style={[styles.splitTrack, { backgroundColor: colors.background }]}>
        {combined > 0 ? (
          <>
            <View style={{ flex: Math.max(incomeTotal, 0.0001), backgroundColor: colors.success, height: '100%' }} />
            <View style={{ flex: Math.max(expenseTotal, 0.0001), backgroundColor: colors.danger, height: '100%' }} />
          </>
        ) : (
          <View style={{ flex: 1, backgroundColor: colors.border, height: '100%' }} />
        )}
      </View>
      <View style={styles.splitMeta}>
        <Text style={[styles.splitMetaText, { color: colors.success }]}>
          In {hideAmounts ? '••••' : formatCurrency(incomeTotal, currency)}
        </Text>
        <Text style={[styles.splitMetaText, { color: colors.danger }]}>
          Out {hideAmounts ? '••••' : formatCurrency(expenseTotal, currency)}
        </Text>
      </View>
    </View>
  );
}

const createStyles = (_colors: AppPalette) =>
  StyleSheet.create({
    card: {
      borderRadius: radius.lg,
      borderWidth: 1,
      padding: spacing.md,
      gap: spacing.md,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: spacing.md,
    },
    kicker: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    title: {
      marginTop: 4,
      fontSize: typography.heading,
      fontWeight: '800',
    },
    hint: {
      marginTop: 2,
      fontSize: typography.caption,
      fontWeight: '600',
    },
    legend: {
      gap: 6,
      alignItems: 'flex-end',
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    legendLabel: {
      fontSize: typography.caption,
      fontWeight: '700',
    },
    bars: {
      height: 118,
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      gap: 4,
    },
    day: {
      flex: 1,
      alignItems: 'center',
      gap: 6,
    },
    pair: {
      height: 88,
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 3,
    },
    bar: {
      width: 8,
      borderRadius: 5,
    },
    dayLabel: {
      fontSize: 10,
      fontWeight: '700',
    },
    splitTrack: {
      height: 10,
      borderRadius: radius.pill,
      overflow: 'hidden',
      flexDirection: 'row',
    },
    splitMeta: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    splitMetaText: {
      fontSize: typography.caption,
      fontWeight: '700',
    },
  });
