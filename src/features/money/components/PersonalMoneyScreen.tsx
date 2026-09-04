import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { MoneyEntrySheet, type MoneyEntryKind } from '@/src/features/money/components/MoneyEntrySheet';
import { MoneyCharts } from '@/src/features/home/components/MoneyCharts';
import { buildSevenDayFlow } from '@/src/features/home/lib/flow-series';
import { Screen } from '@/src/shared/layout/Screen';
import { SearchField } from '@/src/shared/ui/SearchField';
import { SegmentedTabs } from '@/src/shared/ui/SegmentedTabs';
import { StickyActionBar } from '@/src/shared/ui/StickyActionBar';
import { expenseCategory, expenseDue, isInCurrentMonth } from '@/src/features/money/lib/expense';
import { formatCurrency, prettyDate } from '@/src/shared/lib/format';
import { uniqueLogDays } from '@/src/features/habits/lib/habits';
import { moneyCategoryFromNote, moneyPersonLabel } from '@/src/features/money/lib/money';
import { useDebouncedValue } from '@/src/shared/hooks/useDebouncedValue';
import { useParties, usePartyTransactions, usePurchases } from '@/src/shared/hooks/useAppQueries';
import { useHabitStore } from '@/src/stores/habit-store';
import { useAuthStore } from '@/src/stores/auth-store';
import { usePalette } from '@/src/stores/theme-store';
import { radius, shadows, spacing, typography } from '@/src/theme';
import { useThemedStyles } from '@/src/theme/use-themed-styles';
import type { AppPalette } from '@/src/theme/app-palette';

type MoneyFilter = 'all' | 'in' | 'out';

export function PersonalMoneyScreen() {
  const colors = usePalette();
  const styles = useThemedStyles(createStyles);
  const params = useLocalSearchParams<{ entry?: string | string[] }>();
  const currency = useAuthStore((state) => state.businessProfile?.currencyCode) || 'NPR';
  const expensesQuery = usePurchases('expense');
  const moneyTxQuery = usePartyTransactions();
  const partiesQuery = useParties('', 'both');
  const [period, setPeriod] = useState<'month' | 'all'>('month');
  const [filter, setFilter] = useState<MoneyFilter>('all');
  const [search, setSearch] = useState('');
  const [entryKind, setEntryKind] = useState<MoneyEntryKind | null>(null);
  const storedLogDates = useHabitStore((state) => state.logDates);
  const debouncedSearch = useDebouncedValue(search);
  const routeEntry = Array.isArray(params.entry) ? params.entry[0] : params.entry;

  useEffect(() => {
    if (routeEntry === 'income' || routeEntry === 'expense') {
      setEntryKind(routeEntry);
    }
  }, [routeEntry]);

  const partyById = useMemo(() => {
    return new Map((partiesQuery.data ?? []).map((party) => [party.id, party]));
  }, [partiesQuery.data]);

  const rows = useMemo(() => {
    const expenses = (expensesQuery.data ?? [])
      .filter((item) => (period === 'all' ? true : isInCurrentMonth(item.purchaseDate)))
      .map((item) => ({
        id: `out-${item.id}`,
        kind: 'out' as const,
        title: expenseCategory(item),
        person: moneyPersonLabel(item.partyId ? partyById.get(item.partyId) ?? null : null, item.partyName),
        date: item.purchaseDate,
        amount: Number(item.grandTotal || 0),
        due: expenseDue(item),
      }));
    const payments = (moneyTxQuery.data ?? [])
      .filter((item) => (period === 'all' ? true : isInCurrentMonth(item.txDate)))
      .map((item) => {
        const party = partyById.get(item.partyId) ?? null;
        const inbound = item.direction === 'receive';
        return {
          id: `${inbound ? 'in' : 'paid'}-${item.id}`,
          kind: inbound ? ('in' as const) : ('out' as const),
          title: moneyCategoryFromNote(item.note) || (inbound ? 'Income' : 'Paid'),
          person: moneyPersonLabel(party),
          date: item.txDate,
          amount: Number(item.amount || 0),
          due: 0,
        };
      });
    return [...payments, ...expenses].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }, [expensesQuery.data, moneyTxQuery.data, partyById, period]);

  const visibleRows = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    return rows.filter((row) => {
      if (filter !== 'all' && row.kind !== filter) return false;
      if (!query) return true;
      return [row.title, row.person].some((value) => value.toLowerCase().includes(query));
    });
  }, [debouncedSearch, filter, rows]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        if (row.kind === 'in') acc.income += row.amount;
        else acc.expense += row.amount;
        return acc;
      },
      { income: 0, expense: 0 },
    );
  }, [rows]);

  const monthTotals = useMemo(() => {
    const expenses = (expensesQuery.data ?? [])
      .filter((item) => isInCurrentMonth(item.purchaseDate))
      .reduce((sum, item) => sum + Number(item.grandTotal || 0), 0);
    const income = (moneyTxQuery.data ?? [])
      .filter((item) => item.direction === 'receive' && isInCurrentMonth(item.txDate))
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
    return { income, expense: expenses, saved: income - expenses };
  }, [expensesQuery.data, moneyTxQuery.data]);
  const activityDates = useMemo(
    () =>
      uniqueLogDays([
        ...storedLogDates,
        ...(expensesQuery.data ?? []).map((item) => item.purchaseDate),
        ...(moneyTxQuery.data ?? []).map((item) => item.txDate),
      ]),
    [expensesQuery.data, moneyTxQuery.data, storedLogDates],
  );
  const allTimeCounts = useMemo(() => {
    const expenseCount = expensesQuery.data?.length ?? 0;
    const incomeCount = (moneyTxQuery.data ?? []).filter((item) => item.direction === 'receive').length;
    return {
      entryCount: expenseCount + (moneyTxQuery.data?.length ?? 0),
      incomeCount,
      expenseCount,
    };
  }, [expensesQuery.data, moneyTxQuery.data]);

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

  async function handleRefresh() {
    await Promise.all([expensesQuery.refetch(), moneyTxQuery.refetch(), partiesQuery.refetch()]);
  }

  return (
    <Screen
      scrollable={false}
      padded={false}
      topBarTitle="Money"
      footer={
        <StickyActionBar
          secondary={{ label: 'Income', onPress: () => setEntryKind('income') }}
          primary={{ label: 'Expense', onPress: () => setEntryKind('expense') }}
        />
      }>
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={expensesQuery.isRefetching || moneyTxQuery.isRefetching}
            onRefresh={() => void handleRefresh()}
          />
        }
        contentContainerStyle={styles.scroll}>
        <MoneyCharts
          series={weekFlow}
          incomeTotal={weekTotals.income}
          expenseTotal={weekTotals.expense}
          currency={currency}
        />

        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { backgroundColor: colors.successSoft, borderColor: colors.border }]}>
            <Text style={[styles.summaryLabel, { color: colors.success }]}>In</Text>
            <Text style={[styles.summaryValue, { color: colors.success }]}>{formatCurrency(totals.income, currency)}</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: colors.dangerSoft, borderColor: colors.border }]}>
            <Text style={[styles.summaryLabel, { color: colors.danger }]}>Out</Text>
            <Text style={[styles.summaryValue, { color: colors.danger }]}>{formatCurrency(totals.expense, currency)}</Text>
          </View>
        </View>

        <SegmentedTabs
          value={period}
          onChange={setPeriod}
          options={[
            { label: 'This month', value: 'month' },
            { label: 'All time', value: 'all' },
          ]}
        />

        <SearchField placeholder="Search income or expenses" value={search} onChangeText={setSearch} />
        <SegmentedTabs
          value={filter}
          onChange={setFilter}
          options={[
            { label: 'All', value: 'all' },
            { label: 'Income', value: 'in' },
            { label: 'Expenses', value: 'out' },
          ]}
        />

        {!visibleRows.length ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Nothing recorded yet</Text>
            <Text style={[styles.emptyCopy, { color: colors.textMuted }]}>
              Add income when money comes in, and expenses when it goes out.
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {visibleRows.map((row) => (
              <View key={row.id} style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.avatar, { backgroundColor: row.kind === 'in' ? colors.success : colors.danger }]}>
                  <MaterialCommunityIcons
                    name={row.kind === 'in' ? 'arrow-down' : 'arrow-up'}
                    size={18}
                    color={colors.white}
                  />
                </View>
                <View style={styles.rowCopy}>
                  <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
                    {row.title}
                  </Text>
                  <Text style={[styles.rowMeta, { color: colors.textMuted }]}>
                    {[prettyDate(row.date), row.person].filter(Boolean).join('  ·  ')}
                  </Text>
                </View>
                <View style={styles.rowSide}>
                  <Text style={[styles.rowAmount, { color: row.kind === 'in' ? colors.success : colors.danger }]}>
                    {row.kind === 'in' ? '+' : '-'}
                    {formatCurrency(row.amount, currency)}
                  </Text>
                  {row.due > 0 ? (
                    <Text style={[styles.rowDue, { color: colors.danger }]}>Due {formatCurrency(row.due, currency)}</Text>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <MoneyEntrySheet
        visible={Boolean(entryKind)}
        kind={entryKind ?? 'expense'}
        compact
        activityDates={activityDates}
        snapshot={{ ...allTimeCounts, savedThisMonth: monthTotals.saved }}
        onClose={() => {
          setEntryKind(null);
          if (routeEntry) router.setParams({ entry: undefined });
        }}
      />
    </Screen>
  );
}

const createStyles = (colors: AppPalette) =>
  StyleSheet.create({
    scroll: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.xxl,
      gap: spacing.md,
    },
    summaryRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    summaryCard: {
      flex: 1,
      borderRadius: radius.md,
      borderWidth: 1,
      padding: spacing.md,
      gap: 4,
    },
    summaryLabel: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    summaryValue: {
      fontSize: typography.subheading,
      fontWeight: '800',
    },
    emptyCard: {
      borderRadius: radius.lg,
      borderWidth: 1,
      padding: spacing.lg,
      gap: spacing.xs,
    },
    emptyTitle: {
      fontSize: typography.body,
      fontWeight: '800',
    },
    emptyCopy: {
      fontSize: typography.body,
      lineHeight: 22,
    },
    list: {
      gap: spacing.sm,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderRadius: radius.lg,
      borderWidth: 1,
      padding: spacing.md,
      ...shadows.card,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowCopy: {
      flex: 1,
      gap: 2,
    },
    rowTitle: {
      fontSize: typography.body,
      fontWeight: '700',
    },
    rowMeta: {
      fontSize: typography.caption,
    },
    rowSide: {
      alignItems: 'flex-end',
    },
    rowAmount: {
      fontSize: typography.body,
      fontWeight: '800',
    },
    rowDue: {
      fontSize: typography.caption,
      fontWeight: '700',
    },
  });
