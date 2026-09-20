import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { format, parseISO, subDays } from 'date-fns';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { MoneyCharts } from '@/src/features/home/components/MoneyCharts';
import { CategoryBreakdown, type CategoryBreakdownItem } from '@/src/features/money/components/CategoryBreakdown';
import type { FlowPoint } from '@/src/features/home/lib/flow-series';
import { useMoneyFeed, useMoneyFeedSummary, type MoneyFeedFilters } from '@/src/features/money/hooks/useMoneyFeed';
import { openFeedReceipt } from '@/src/features/money/lib/feed-receipt';
import { ListFooterLoader, loadMoreOnScroll } from '@/src/shared/ui/ListFooterLoader';
import { Screen } from '@/src/shared/layout/Screen';
import { PageHeading } from '@/src/shared/ui/PageHeading';
import { Avatar } from '@/src/shared/ui/Avatar';
import { SearchField } from '@/src/shared/ui/SearchField';
import { SegmentedTabs } from '@/src/shared/ui/SegmentedTabs';
import { formatCurrency, getRangeForPeriod, localIsoDate, prettyDate } from '@/src/shared/lib/format';
import {
  moneyPersonLabel,
  moneyRemarkFromNote,
} from '@/src/features/money/lib/money';
import {
  getBalanceColor,
  getBalanceSoftColor,
  getPartyBalanceMeta,
  partyTypeLabel,
} from '@/src/features/parties/lib/party';
import { isPersonalWorkspace } from '@/src/shared/lib/business';
import { useBudgets } from '@/src/shared/hooks/useAppQueries';
import { useDebouncedValue } from '@/src/shared/hooks/useDebouncedValue';
import { useToast } from '@/src/shared/feedback/ToastProvider';
import { useAuthStore } from '@/src/stores/auth-store';
import { useTranslation } from '@/src/i18n';
import { usePalette } from '@/src/stores/theme-store';
import { radius, shadows, spacing, typography } from '@/src/theme';
import { useThemedStyles } from '@/src/theme/use-themed-styles';
import type { AppPalette } from '@/src/theme/app-palette';
import type { MoneyFeedItem } from '@/src/types/models';

type PeriodFilter = 'month' | 'week' | 'all';
type TxFilter = 'all' | 'in' | 'out' | 'party';

export function MoneyInsightsScreen() {
  const colors = usePalette();
  const toast = useToast();
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();
  const businessProfile = useAuthStore((state) => state.businessProfile);
  const currency = businessProfile?.currencyCode || 'NPR';
  const personal = isPersonalWorkspace({
    businessType: String(businessProfile?.businessType ?? businessProfile?.type ?? ''),
  });

  const [period, setPeriod] = useState<PeriodFilter>('month');
  const [txFilter, setTxFilter] = useState<TxFilter>('all');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);

  // Everything below is worked out by the server (GET /api/reports/money-feed):
  // one summary request for the period, one paged request for the list.
  const periodRange = useMemo(() => {
    const today = localIsoDate(new Date());
    if (period === 'month') return getRangeForPeriod('this_month');
    if (period === 'week') return { from: localIsoDate(subDays(new Date(), 6)), to: today };
    return { from: undefined, to: undefined };
  }, [period]);
  const sources = useMemo<MoneyFeedFilters['sources']>(
    () => (personal ? ['income', 'expense', 'party'] : undefined),
    [personal],
  );
  const summaryQuery = useMoneyFeedSummary({
    ...periodRange,
    sources,
    include: ['flow', 'categories', 'parties'],
    flowTo: localIsoDate(new Date()),
    flowDays: 7,
  });
  const listQuery = useMoneyFeed({
    ...periodRange,
    sources,
    direction: txFilter === 'in' || txFilter === 'out' ? txFilter : undefined,
    partyOnly: txFilter === 'party' || undefined,
    search: debouncedSearch.trim() || undefined,
  });
  const budgetsQuery = useBudgets({ isActive: true });

  const summary = summaryQuery.data;
  const isRefreshing = summaryQuery.isRefetching || listQuery.isRefreshing || budgetsQuery.isRefetching;

  async function handleRefresh() {
    await Promise.all([summaryQuery.refetch(), listQuery.refetch(), budgetsQuery.refetch()]);
  }

  const periodTotals = {
    income: summary?.totals.in ?? 0,
    expense: summary?.totals.out ?? 0,
    saved: summary?.totals.net ?? 0,
  };

  const breakdownRows: CategoryBreakdownItem[] = useMemo(
    () =>
      (summary?.categories ?? []).map((row) => ({
        id: `${row.kind}-${row.category}`,
        kind: row.kind,
        title: row.category,
        amount: row.total,
      })),
    [summary?.categories],
  );

  const weekFlow = useMemo<FlowPoint[]>(
    () =>
      (summary?.flow ?? []).map((point) => ({
        key: point.date,
        label: format(parseISO(point.date), 'EEEEE'),
        income: point.income,
        expense: point.expense,
      })),
    [summary?.flow],
  );
  const weekTotals = summary?.flowTotals ?? { income: 0, expense: 0 };

  const partyInsights = summary?.parties ?? [];

  const visibleTransactions = useMemo(
    () =>
      listQuery.items.map((item) => {
        const isParty = item.source === 'party';
        const title = isParty
          ? moneyPersonLabel(null, item.partyName) || (item.kind === 'in' ? 'Money Received' : 'Money Paid')
          : item.source === 'sale' || item.source === 'purchase'
            ? String(item.partyName || (item.source === 'sale' ? 'Walk-in Sale' : 'Supplier Purchase'))
            : item.category;
        const detail = isParty
          ? item.note || (item.kind === 'in' ? 'Received' : 'Paid')
          : item.invoiceNo
            ? `#${item.invoiceNo}`
            : moneyRemarkFromNote(item.note);
        return {
          ...item,
          title,
          subtitle: [prettyDate(item.date), detail, item.paymentMethod === 'bank' ? 'Bank' : 'Cash']
            .filter(Boolean)
            .join('  ·  '),
        };
      }),
    [listQuery.items],
  );

  const handleOpenReceipt = (item: MoneyFeedItem) => {
    void openFeedReceipt(item, businessProfile).catch((error) => {
      toast.error(error instanceof Error ? error.message : 'Could not load this receipt. Please try again.');
    });
  };

  return (
    <Screen
      scrollable={false}
      padded={false}
      topBarTitle={t('money.insights')}
      topBarLeading="back">
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        {...loadMoreOnScroll(listQuery.loadMore)}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => void handleRefresh()} />}>
        <PageHeading
          title={t('money.insights')}
          subtitle={t('money.insightsSubtitle')}
        />

        {/* Period Filter Tabs */}
        <SegmentedTabs
          value={period}
          onChange={setPeriod}
          options={[
            { label: t('common.thisMonth'), value: 'month' },
            { label: t('common.thisWeek'), value: 'week' },
            { label: t('common.all'), value: 'all' },
          ]}
        />

        {summaryQuery.isLoading ? <ActivityIndicator color={colors.primary} /> : null}
        {summaryQuery.isError || listQuery.isError ? (
          <Pressable onPress={() => void handleRefresh()}>
            <Text style={{ color: colors.danger }}>Could not refresh money records. Tap to retry.</Text>
          </Pressable>
        ) : null}
        {/* Overview Stats */}
        <View style={styles.overviewRow}>
          <View style={[styles.overviewCard, { backgroundColor: colors.successSoft, borderColor: colors.border }]}>
            <View style={styles.cardHeaderRow}>
              <Text style={[styles.overviewKicker, { color: colors.success }]}>{t('money.totalIncome')}</Text>
              <MaterialCommunityIcons name="arrow-down-circle-outline" size={16} color={colors.success} />
            </View>
            <Text style={[styles.overviewValue, { color: colors.success }]}>
              {formatCurrency(periodTotals.income, currency)}
            </Text>
          </View>
          <View style={[styles.overviewCard, { backgroundColor: colors.dangerSoft, borderColor: colors.border }]}>
            <View style={styles.cardHeaderRow}>
              <Text style={[styles.overviewKicker, { color: colors.danger }]}>{t('money.totalExpense')}</Text>
              <MaterialCommunityIcons name="arrow-up-circle-outline" size={16} color={colors.danger} />
            </View>
            <Text style={[styles.overviewValue, { color: colors.danger }]}>
              {formatCurrency(periodTotals.expense, currency)}
            </Text>
          </View>
        </View>

        {/* Net Saved Card */}
        <View style={[styles.netCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.netLabel, { color: colors.textMuted }]}>{t('money.netSaved')}</Text>
          <Text style={[styles.netValue, { color: periodTotals.saved >= 0 ? colors.success : colors.danger }]}>
            {formatCurrency(Math.abs(periodTotals.saved), currency)}
          </Text>
          <Text style={[styles.netHint, { color: periodTotals.saved >= 0 ? colors.success : colors.danger }]}>
            {periodTotals.saved >= 0 ? t('money.positiveSavings') : t('money.negativeSavings')}
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
          items={breakdownRows}
          currency={currency}
        />

        {/* Spending caps live beside the category breakdown they protect. */}
        <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={[styles.sectionKicker, { color: colors.primary }]}>BUDGETS</Text>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Spending plan</Text>
            </View>
            <Pressable onPress={() => router.push('/(app)/budgets' as any)} hitSlop={8}>
              <Text style={[styles.seeAllText, { color: colors.primary }]}>
                {budgetsQuery.data?.items.length ? 'Manage' : 'Set up'}
              </Text>
            </Pressable>
          </View>
          {budgetsQuery.data?.items.length ? budgetsQuery.data.items.slice(0, 2).map((budget) => {
            const tone = budget.status === 'over'
              ? colors.danger
              : budget.status === 'warning' || budget.projectedStatus === 'over'
                ? colors.warning
                : colors.success;
            const spent = budget.spent ?? 0;
            const remaining = budget.remaining ?? budget.amount - spent;
            return (
              <Pressable
                key={budget.id}
                onPress={() => router.push('/(app)/budgets' as any)}
                style={[styles.budgetRow, { borderColor: colors.border, backgroundColor: colors.backgroundAlt }]}>
                <View style={[styles.budgetIcon, { backgroundColor: tone === colors.success ? colors.successSoft : tone === colors.danger ? colors.dangerSoft : colors.warningSoft }]}>
                  <MaterialCommunityIcons name={budget.scope === 'total' ? 'wallet-outline' : 'target'} size={19} color={tone} />
                </View>
                <View style={styles.budgetCopy}>
                  <View style={styles.budgetTitleLine}>
                    <Text numberOfLines={1} style={[styles.budgetName, { color: colors.text }]}>{budget.name}</Text>
                    <Text style={[styles.budgetPercent, { color: tone }]}>{Math.round(budget.percentUsed ?? 0)}%</Text>
                  </View>
                  <View style={[styles.budgetTrack, { backgroundColor: colors.surfaceMuted }]}>
                    <View style={[styles.budgetFill, { width: `${Math.min(Math.max(budget.percentUsed ?? 0, 0), 100)}%`, backgroundColor: tone }]} />
                  </View>
                  <Text numberOfLines={1} style={[styles.budgetMeta, { color: colors.textMuted }]}>
                    {formatCurrency(spent, currency)} spent · {remaining >= 0 ? `${formatCurrency(remaining, currency)} left` : `${formatCurrency(Math.abs(remaining), currency)} over`}
                  </Text>
                </View>
              </Pressable>
            );
          }) : (
            <Pressable onPress={() => router.push('/(app)/budgets' as any)} style={[styles.budgetEmpty, { backgroundColor: colors.accentSoft }]}>
              <MaterialCommunityIcons name="target" size={20} color={colors.primary} />
              <Text style={[styles.budgetEmptyText, { color: colors.text }]}>Set a limit for a category or all spending.</Text>
            </Pressable>
          )}
        </View>

        {/* Contact / Party Insights Section */}
        {partyInsights.length > 0 && (
          <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={[styles.sectionKicker, { color: colors.primary }]}>
                  {personal ? 'Contacts Breakdown' : 'Parties & Customers'}
                </Text>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  {personal ? 'Top Contacts' : 'Party Activity'}
                </Text>
              </View>
              <Pressable
                onPress={() => router.push('/(app)/(tabs)/parties')}
                hitSlop={8}>
                <Text style={[styles.seeAllText, { color: colors.primary }]}>{t('common.viewAll')}</Text>
              </Pressable>
            </View>

            <View style={styles.partyList}>
              {partyInsights.map(({ party, totalIn, totalOut }) => {
                const balanceMeta = getPartyBalanceMeta(party, undefined, personal);
                const toneColor = getBalanceColor(balanceMeta.tone, colors);
                const toneSoft = getBalanceSoftColor(balanceMeta.tone, colors);

                return (
                  <Pressable
                    key={party.id}
                    onPress={() => router.push(`/(app)/parties/${party.id}` as any)}
                    style={({ pressed }) => [
                      styles.partyRow,
                      { borderColor: colors.border, backgroundColor: colors.backgroundAlt },
                      pressed && { opacity: 0.75 },
                    ]}>
                    <Avatar
                      uri={party.avatarUrl}
                      name={party.name}
                      size={40}
                    />
                    <View style={styles.partyInfo}>
                      <Text style={[styles.partyName, { color: colors.text }]} numberOfLines={1}>
                        {party.name}
                      </Text>
                      <Text style={[styles.partyMeta, { color: colors.textMuted }]}>
                        {party.phone || partyTypeLabel(party.type, personal)}
                      </Text>
                    </View>
                    <View style={styles.partyAmounts}>
                      {totalIn > 0 && (
                        <Text style={[styles.partyAmountIn, { color: colors.success }]}>
                          +{formatCurrency(totalIn, currency)}
                        </Text>
                      )}
                      {totalOut > 0 && (
                        <Text style={[styles.partyAmountOut, { color: colors.danger }]}>
                          -{formatCurrency(totalOut, currency)}
                        </Text>
                      )}
                      {balanceMeta.absoluteAmount > 0 && (
                        <View style={[styles.balanceBadge, { backgroundColor: toneSoft }]}>
                          <Text style={[styles.balanceBadgeText, { color: toneColor }]}>
                            {balanceMeta.label}: {formatCurrency(balanceMeta.absoluteAmount, currency)}
                          </Text>
                        </View>
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {/* Transactions List Section */}
        <View style={styles.txSection}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={[styles.sectionKicker, { color: colors.primary }]}>Entries</Text>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Transactions</Text>
            </View>
            <Text style={[styles.txCountBadge, { color: colors.textMuted }]}>
              {listQuery.total} {listQuery.total === 1 ? 'entry' : 'entries'}
            </Text>
          </View>

          <SearchField
            placeholder={t('common.search')}
            value={search}
            onChangeText={setSearch}
          />

          <SegmentedTabs
            value={txFilter}
            onChange={setTxFilter}
            options={[
              { label: t('common.all'), value: 'all' },
              { label: t('home.income'), value: 'in' },
              { label: t('home.expense'), value: 'out' },
              { label: personal ? 'Contacts' : 'Parties', value: 'party' },
            ]}
          />

          {visibleTransactions.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <MaterialCommunityIcons name="clipboard-text-outline" size={36} color={colors.textMuted} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('money.nothingRecordedYet')}</Text>
              <Text style={[styles.emptyCopy, { color: colors.textMuted }]}>
                {t('money.addMoneyHint')}
              </Text>
            </View>
          ) : (
            <View style={styles.txList}>
              {visibleTransactions.map((tx) => (
                <Pressable
                  key={tx.id}
                  onPress={() => handleOpenReceipt(tx)}
                  style={({ pressed }) => [
                    styles.txCard,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                    pressed && { opacity: 0.8 },
                  ]}>
                  <View
                    style={[
                      styles.txIconBox,
                      { backgroundColor: tx.kind === 'in' ? colors.successSoft : colors.dangerSoft },
                    ]}>
                    <MaterialCommunityIcons
                      name={tx.kind === 'in' ? 'arrow-down' : 'arrow-up'}
                      size={18}
                      color={tx.kind === 'in' ? colors.success : colors.danger}
                    />
                  </View>

                  <View style={styles.txContent}>
                    <Text style={[styles.txTitle, { color: colors.text }]} numberOfLines={1}>
                      {tx.title}
                    </Text>
                    <Text style={[styles.txSubtitle, { color: colors.textMuted }]} numberOfLines={1}>
                      {tx.subtitle}
                    </Text>
                  </View>

                  <View style={styles.txEnd}>
                    <Text
                      style={[
                        styles.txAmount,
                        { color: tx.kind === 'in' ? colors.success : colors.danger },
                      ]}>
                      {tx.kind === 'in' ? '+' : '-'}
                      {formatCurrency(tx.amount, currency)}
                    </Text>
                    <View style={styles.billTag}>
                      <MaterialCommunityIcons name="receipt-outline" size={12} color={colors.primary} />
                      <Text style={[styles.billTagText, { color: colors.primary }]}>Bill</Text>
                    </View>
                  </View>
                </Pressable>
              ))}
              <ListFooterLoader list={listQuery} />
            </View>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

const createStyles = (_colors: AppPalette) =>
  StyleSheet.create({
    scroll: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.xxl,
      gap: spacing.lg,
    },
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
    cardHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
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
    sectionCard: {
      borderRadius: radius.lg,
      borderWidth: 1,
      padding: spacing.md,
      gap: spacing.md,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    sectionKicker: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    sectionTitle: {
      fontSize: typography.subheading,
      fontWeight: '700',
    },
    seeAllText: {
      fontSize: typography.caption,
      fontWeight: '700',
    },
    budgetRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      padding: spacing.sm,
      borderWidth: 1,
      borderRadius: radius.md,
    },
    budgetIcon: {
      width: 38,
      height: 38,
      borderRadius: radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    budgetCopy: { flex: 1, gap: 5 },
    budgetTitleLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    budgetName: { flex: 1, fontSize: typography.caption, fontWeight: '800' },
    budgetPercent: { fontSize: typography.caption, fontWeight: '800' },
    budgetTrack: { height: 5, borderRadius: radius.pill, overflow: 'hidden' },
    budgetFill: { height: '100%', borderRadius: radius.pill },
    budgetMeta: { fontSize: 11 },
    budgetEmpty: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: radius.md },
    budgetEmptyText: { flex: 1, fontSize: typography.caption, fontWeight: '700' },
    partyList: {
      gap: spacing.sm,
    },
    partyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.sm,
      borderRadius: radius.md,
      borderWidth: 1,
      gap: spacing.sm,
    },
    partyInfo: {
      flex: 1,
      gap: 2,
    },
    partyName: {
      fontSize: typography.body,
      fontWeight: '700',
    },
    partyMeta: {
      fontSize: typography.caption,
    },
    partyAmounts: {
      alignItems: 'flex-end',
      gap: 2,
    },
    partyAmountIn: {
      fontSize: typography.caption,
      fontWeight: '700',
    },
    partyAmountOut: {
      fontSize: typography.caption,
      fontWeight: '700',
    },
    balanceBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: radius.sm,
      marginTop: 2,
    },
    balanceBadgeText: {
      fontSize: 10,
      fontWeight: '700',
    },
    txSection: {
      gap: spacing.md,
    },
    txCountBadge: {
      fontSize: typography.caption,
      fontWeight: '600',
    },
    txList: {
      gap: spacing.sm,
    },
    txCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      gap: spacing.md,
    },
    txIconBox: {
      width: 38,
      height: 38,
      borderRadius: radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    txContent: {
      flex: 1,
      gap: 2,
    },
    txTitle: {
      fontSize: typography.body,
      fontWeight: '700',
    },
    txSubtitle: {
      fontSize: typography.caption,
    },
    txEnd: {
      alignItems: 'flex-end',
      gap: 4,
    },
    txAmount: {
      fontSize: typography.body,
      fontWeight: '800',
    },
    billTag: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    billTagText: {
      fontSize: 10,
      fontWeight: '700',
    },
    emptyCard: {
      borderRadius: radius.lg,
      borderWidth: 1,
      padding: spacing.xl,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
    },
    emptyTitle: {
      fontSize: typography.subheading,
      fontWeight: '700',
    },
    emptyCopy: {
      fontSize: typography.caption,
      textAlign: 'center',
      maxWidth: 240,
    },
  });
