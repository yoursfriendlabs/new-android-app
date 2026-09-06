import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { MoneyCharts } from '@/src/features/home/components/MoneyCharts';
import { CategoryBreakdown, type CategoryBreakdownItem } from '@/src/features/money/components/CategoryBreakdown';
import { buildSevenDayFlow } from '@/src/features/home/lib/flow-series';
import { Screen } from '@/src/shared/layout/Screen';
import { PageHeading } from '@/src/shared/ui/PageHeading';
import { expenseCategory } from '@/src/features/money/lib/expense';
import { formatCurrency } from '@/src/shared/lib/format';
import { moneyCategoryFromNote } from '@/src/features/money/lib/money';
import { useParties, usePartyTransactions, usePurchases } from '@/src/shared/hooks/useAppQueries';
import { useAuthStore } from '@/src/stores/auth-store';
import { useTranslation } from '@/src/i18n';
import { usePalette } from '@/src/stores/theme-store';
import { radius, spacing, typography } from '@/src/theme';
import { useThemedStyles } from '@/src/theme/use-themed-styles';
import type { AppPalette } from '@/src/theme/app-palette';

export default function MoneyInsightsScreen() {
  const colors = usePalette();
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();
  const currency = useAuthStore((state) => state.businessProfile?.currencyCode) || 'NPR';
  const expensesQuery = usePurchases('expense');
  const moneyTxQuery = usePartyTransactions();
  const partiesQuery = useParties('', 'both');

  const partyById = useMemo(() => {
    return new Map((partiesQuery.data ?? []).map((party) => [party.id, party]));
  }, [partiesQuery.data]);

  const rows: CategoryBreakdownItem[] = useMemo(() => {
    const expenses = (expensesQuery.data ?? []).map((item) => ({
      id: `out-${item.id}`,
      kind: 'out' as const,
      title: expenseCategory(item),
      amount: Number(item.grandTotal || 0),
    }));
    const payments = (moneyTxQuery.data ?? []).map((item) => {
      const inbound = item.direction === 'receive';
      return {
        id: `${inbound ? 'in' : 'paid'}-${item.id}`,
        kind: inbound ? ('in' as const) : ('out' as const),
        title: moneyCategoryFromNote(item.note) || (inbound ? t('home.income') : t('common.paid')),
        amount: Number(item.amount || 0),
      };
    });
    return [...payments, ...expenses];
  }, [expensesQuery.data, moneyTxQuery.data, t]);

  const weekFlow = useMemo(
    () =>
      buildSevenDayFlow({
        expenses: expensesQuery.data ?? [],
        payments: moneyTxQuery.data ?? [],
      }),
    [expensesQuery.data, moneyTxQuery.data],
  );

  const weekTotals = useMemo(
    () =>
      weekFlow.reduce(
        (acc, point) => {
          acc.income += point.income;
          acc.expense += point.expense;
          return acc;
        },
        { income: 0, expense: 0 },
      ),
    [weekFlow],
  );

  const allTotals = useMemo(() => {
    const income = rows.filter((r) => r.kind === 'in').reduce((sum, r) => sum + r.amount, 0);
    const expense = rows.filter((r) => r.kind === 'out').reduce((sum, r) => sum + r.amount, 0);
    return { income, expense, saved: income - expense };
  }, [rows]);

  return (
    <Screen>
      <PageHeading
        title={t('money.insights')}
        subtitle={t('money.insightsSubtitle')}
      />

      {/* Overview Cards */}
      <View style={styles.overviewRow}>
        <View style={[styles.overviewCard, { backgroundColor: colors.successSoft, borderColor: colors.border }]}>
          <Text style={[styles.overviewKicker, { color: colors.success }]}>{t('money.totalIncome')}</Text>
          <Text style={[styles.overviewValue, { color: colors.success }]}>{formatCurrency(allTotals.income, currency)}</Text>
        </View>
        <View style={[styles.overviewCard, { backgroundColor: colors.dangerSoft, borderColor: colors.border }]}>
          <Text style={[styles.overviewKicker, { color: colors.danger }]}>{t('money.totalExpense')}</Text>
          <Text style={[styles.overviewValue, { color: colors.danger }]}>{formatCurrency(allTotals.expense, currency)}</Text>
        </View>
      </View>

      {/* Net Saved Card */}
      <View style={[styles.netCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.netLabel, { color: colors.textMuted }]}>{t('money.netSaved')}</Text>
        <Text style={[styles.netValue, { color: allTotals.saved >= 0 ? colors.success : colors.danger }]}>
          {formatCurrency(Math.abs(allTotals.saved), currency)}
        </Text>
        <Text style={[styles.netHint, { color: allTotals.saved >= 0 ? colors.success : colors.danger }]}>
          {allTotals.saved >= 0 ? t('money.positiveSavings') : t('money.negativeSavings')}
        </Text>
      </View>

      {/* Weekly Flow Chart */}
      <MoneyCharts
        series={weekFlow}
        incomeTotal={weekTotals.income}
        expenseTotal={weekTotals.expense}
        currency={currency}
      />

      {/* Category Breakdown */}
      <CategoryBreakdown
        items={rows}
        currency={currency}
      />
    </Screen>
  );
}

const createStyles = (colors: AppPalette) =>
  StyleSheet.create({
    overviewRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    overviewCard: {
      flex: 1,
      borderRadius: radius.md,
      borderWidth: 1,
      padding: spacing.md,
      gap: 4,
    },
    overviewKicker: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    overviewValue: {
      fontSize: typography.subheading,
      fontWeight: '800',
    },
    netCard: {
      borderRadius: radius.lg,
      borderWidth: 1,
      padding: spacing.md,
      alignItems: 'center',
      gap: 4,
    },
    netLabel: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    netValue: {
      fontSize: typography.heading,
      fontWeight: '800',
    },
    netHint: {
      fontSize: typography.caption,
      fontWeight: '600',
    },
  });
