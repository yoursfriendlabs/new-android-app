import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { MoneyEntrySheet, type MoneyEntryKind } from '@/src/features/money/components/MoneyEntrySheet';
import { Screen } from '@/src/shared/layout/Screen';
import { SearchField } from '@/src/shared/ui/SearchField';
import { SegmentedTabs } from '@/src/shared/ui/SegmentedTabs';
import { StickyActionBar } from '@/src/shared/ui/StickyActionBar';
import { expenseCategory, expenseDue } from '@/src/features/money/lib/expense';
import { formatCurrency, getRangeForPeriod, prettyDate, todayIso } from '@/src/shared/lib/format';
import { moneyCategoryFromPurchase, moneyRemarkFromNote } from '@/src/features/money/lib/money';
import { useDebouncedValue } from '@/src/shared/hooks/useDebouncedValue';
import { useDashboardSummary, usePagedPurchases } from '@/src/shared/hooks/useAppQueries';
import { ListFooterLoader, loadMoreOnScroll } from '@/src/shared/ui/ListFooterLoader';
import { SkeletonList } from '@/src/shared/ui/Skeleton';
import { useAuthStore } from '@/src/stores/auth-store';
import { useTranslation } from '@/src/i18n';
import { usePalette } from '@/src/stores/theme-store';
import { radius, shadows, spacing, typography } from '@/src/theme';
import { useThemedStyles } from '@/src/theme/use-themed-styles';
import type { AppPalette } from '@/src/theme/app-palette';
import { buildExpenseReceipt, openReceiptPreview } from '@/src/shared/lib/receipt';

type MoneyFilter = 'all' | 'in' | 'out';

/** "All" totals still need a range for the summary endpoint; start well before any real data. */
const ALL_TIME_FROM = '2000-01-01';

export function PersonalMoneyScreen() {
  const colors = usePalette();
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ entry?: string | string[]; filter?: string | string[] }>();
  const currency = useAuthStore((state) => state.businessProfile?.currencyCode) || 'NPR';
  const [period, setPeriod] = useState<'month' | 'all'>('month');
  const [filter, setFilter] = useState<MoneyFilter>('all');
  const [search, setSearch] = useState('');
  const [entryKind, setEntryKind] = useState<MoneyEntryKind | null>(null);
  const debouncedSearch = useDebouncedValue(search);
  const range = useMemo(
    () => (period === 'month' ? getRangeForPeriod('this_month') : { from: ALL_TIME_FROM, to: todayIso() }),
    [period],
  );
  // The server filters, pages and totals; the phone only renders what has loaded so far.
  const listQuery = usePagedPurchases({
    entryType: filter === 'in' ? 'income' : filter === 'out' ? 'expense' : undefined,
    from: period === 'month' ? range.from : undefined,
    to: period === 'month' ? range.to : undefined,
    search: debouncedSearch,
  });
  const summaryQuery = useDashboardSummary(range);
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

  const rows = useMemo(() => {
    return listQuery.items
      .filter((item) => item.entryType === 'income' || item.entryType === 'expense')
      .filter((item) => (period === 'all' ? true : !item.purchaseDate || (item.purchaseDate >= range.from && item.purchaseDate <= range.to)))
      .map((item) => {
        const kind = item.entryType === 'income' ? ('in' as const) : ('out' as const);
        return {
          id: `${kind}-${item.id}`,
          kind,
          title: kind === 'in' ? moneyCategoryFromPurchase(item) : expenseCategory(item),
          note: moneyRemarkFromNote(item.notes),
          method: item.paymentMethod === 'bank' ? 'Bank' : 'Cash',
          date: item.purchaseDate,
          amount: Number(item.grandTotal || 0),
          due: kind === 'out' ? expenseDue(item) : 0,
          raw: item,
        };
      });
  }, [listQuery.items, period, range.from, range.to]);

  const handleOpenReceipt = (row: (typeof rows)[number]) => {
    const { input, html } = buildExpenseReceipt(row.raw, businessProfile);
    openReceiptPreview(router, input, html);
  };

  const visibleRows = useMemo(() => {
    // Older servers ignore `search`, so match locally as well.
    const query = debouncedSearch.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) => [row.title, row.note].some((value) => value.toLowerCase().includes(query)));
  }, [debouncedSearch, rows]);

  const totals = {
    income: Number(summaryQuery.data?.incomeTotal ?? 0),
    expense: Number(summaryQuery.data?.expenseTotal ?? 0),
  };

  async function handleRefresh() {
    await Promise.all([listQuery.refetch(), summaryQuery.refetch()]);
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
        {...loadMoreOnScroll(listQuery.loadMore)}
        refreshControl={
          <RefreshControl refreshing={listQuery.isRefreshing} onRefresh={() => void handleRefresh()} />
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

        {listQuery.isLoading ? (
          <SkeletonList count={5} />
        ) : !visibleRows.length ? (
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
                    color={colors.onPrimary}
                  />
                </View>
                <View style={styles.rowCopy}>
                  <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
                    {row.title}
                  </Text>
                  <Text
                    style={[styles.rowMeta, { color: colors.textMuted }]}
                    numberOfLines={1}
                    ellipsizeMode="tail">
                    {/* The note is the point; without one the line falls back to how it was paid. */}
                    {[prettyDate(row.date), row.note || row.method].filter(Boolean).join('  ·  ')}
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
        <ListFooterLoader list={listQuery} />
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
      // Never squeezed by a long note — the note truncates instead.
      flexShrink: 0,
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
