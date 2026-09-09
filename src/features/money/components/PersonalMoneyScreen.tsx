import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { MoneyEntrySheet, type MoneyEntryKind } from '@/src/features/money/components/MoneyEntrySheet';
import { Screen } from '@/src/shared/layout/Screen';
import { SearchField } from '@/src/shared/ui/SearchField';
import { SegmentedTabs } from '@/src/shared/ui/SegmentedTabs';
import { StickyActionBar } from '@/src/shared/ui/StickyActionBar';
import { expenseCategory, expenseDue, isInCurrentMonth } from '@/src/features/money/lib/expense';
import { formatCurrency, prettyDate } from '@/src/shared/lib/format';
import { moneyCategoryFromPurchase, moneyPersonLabel } from '@/src/features/money/lib/money';
import { useDebouncedValue } from '@/src/shared/hooks/useDebouncedValue';
import { useParties, usePurchases } from '@/src/shared/hooks/useAppQueries';
import { useAuthStore } from '@/src/stores/auth-store';
import { useTranslation } from '@/src/i18n';
import { usePalette } from '@/src/stores/theme-store';
import { radius, shadows, spacing, typography } from '@/src/theme';
import { useThemedStyles } from '@/src/theme/use-themed-styles';
import type { AppPalette } from '@/src/theme/app-palette';
import { buildExpenseReceipt, openReceiptPreview } from '@/src/shared/lib/receipt';

type MoneyFilter = 'all' | 'in' | 'out';

export function PersonalMoneyScreen() {
  const colors = usePalette();
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ entry?: string | string[]; filter?: string | string[] }>();
  const currency = useAuthStore((state) => state.businessProfile?.currencyCode) || 'NPR';
  const expensesQuery = usePurchases('expense');
  const incomesQuery = usePurchases('income');
  const partiesQuery = useParties('', 'both');
  const [period, setPeriod] = useState<'month' | 'all'>('month');
  const [filter, setFilter] = useState<MoneyFilter>('all');
  const [search, setSearch] = useState('');
  const [entryKind, setEntryKind] = useState<MoneyEntryKind | null>(null);
  const debouncedSearch = useDebouncedValue(search);
  const routeEntry = Array.isArray(params.entry) ? params.entry[0] : params.entry;
  const routeFilter = Array.isArray(params.filter) ? params.filter[0] : params.filter;

  useEffect(() => {
    if (routeEntry === 'income' || routeEntry === 'expense') {
      setEntryKind(routeEntry);
    }
  }, [routeEntry]);

  useEffect(() => {
    if (routeFilter === 'in' || routeFilter === 'out' || routeFilter === 'all') {
      setFilter(routeFilter);
    }
  }, [routeFilter]);

  const businessProfile = useAuthStore((state) => state.businessProfile);

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
        raw: item,
      }));
    const incomes = (incomesQuery.data ?? [])
      .filter((item) => (period === 'all' ? true : isInCurrentMonth(item.purchaseDate)))
      .map((item) => ({
        id: `in-${item.id}`,
        kind: 'in' as const,
        title: moneyCategoryFromPurchase(item),
        person: moneyPersonLabel(item.partyId ? partyById.get(item.partyId) ?? null : null, item.partyName),
        date: item.purchaseDate,
        amount: Number(item.grandTotal || 0),
        due: 0,
        raw: item,
      }));
    return [...incomes, ...expenses].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }, [expensesQuery.data, incomesQuery.data, partyById, period]);

  const handleOpenReceipt = (row: (typeof rows)[number]) => {
    const { input, html } = buildExpenseReceipt(row.raw, businessProfile);
    openReceiptPreview(router, input, html);
  };

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

  async function handleRefresh() {
    await Promise.all([expensesQuery.refetch(), incomesQuery.refetch(), partiesQuery.refetch()]);
  }

  return (
    <Screen
      scrollable={false}
      padded={false}
      topBarTitle={t('nav.money')}
      topBarRight={
        <Pressable
          onPress={() => router.push('/(app)/money-insights' as any)}
          hitSlop={8}
          style={styles.headerIcon}>
          <MaterialCommunityIcons name="chart-arc" size={22} color={colors.primary} />
        </Pressable>
      }
      footer={
        <StickyActionBar
          secondary={{ label: t('home.income'), onPress: () => setEntryKind('income'), tone: 'success' }}
          primary={{ label: t('home.expense'), onPress: () => setEntryKind('expense'), tone: 'danger' }}
        />
      }>
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={expensesQuery.isRefetching || incomesQuery.isRefetching}
            onRefresh={() => void handleRefresh()}
          />
        }
        contentContainerStyle={styles.scroll}>
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { backgroundColor: colors.successSoft, borderColor: colors.border }]}>
            <Text style={[styles.summaryLabel, { color: colors.success }]}>{t('money.totalIncome')}</Text>
            <Text style={[styles.summaryValue, { color: colors.success }]}>{formatCurrency(totals.income, currency)}</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: colors.dangerSoft, borderColor: colors.border }]}>
            <Text style={[styles.summaryLabel, { color: colors.danger }]}>{t('money.totalExpense')}</Text>
            <Text style={[styles.summaryValue, { color: colors.danger }]}>{formatCurrency(totals.expense, currency)}</Text>
          </View>
        </View>

        <SegmentedTabs
          value={period}
          onChange={setPeriod}
          options={[
            { label: t('common.thisMonth'), value: 'month' },
            { label: t('common.all'), value: 'all' },
          ]}
        />

        <SearchField placeholder={t('common.search')} value={search} onChangeText={setSearch} />
        <SegmentedTabs
          value={filter}
          onChange={setFilter}
          options={[
            { label: t('common.all'), value: 'all' },
            { label: t('home.income'), value: 'in' },
            { label: t('home.expense'), value: 'out' },
          ]}
        />

        {!visibleRows.length ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('money.nothingRecordedYet')}</Text>
            <Text style={[styles.emptyCopy, { color: colors.textMuted }]}>
              {t('money.addMoneyHint')}
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {visibleRows.map((row) => (
              <Pressable
                key={row.id}
                onPress={() => handleOpenReceipt(row)}
                style={({ pressed }) => [
                  styles.row,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                  pressed && { opacity: 0.8 },
                ]}>
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
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2 }}>
                    <MaterialCommunityIcons name="receipt" size={13} color={colors.primary} />
                    <Text style={{ fontSize: 11, color: colors.primary, fontWeight: '700' }}>Bill</Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      <MoneyEntrySheet
        visible={Boolean(entryKind)}
        kind={entryKind ?? 'expense'}
        compact
        onClose={() => {
          setEntryKind(null);
          if (routeEntry) router.setParams({ entry: undefined });
        }}
      />
    </Screen>
  );
}

const createStyles = (_colors: AppPalette) =>
  StyleSheet.create({
    scroll: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.xxl,
      gap: spacing.md,
    },
    headerIcon: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
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
      gap: 3,
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
