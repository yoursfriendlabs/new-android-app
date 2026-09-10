import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
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
import { buildSevenDayFlow } from '@/src/features/home/lib/flow-series';
import { Screen } from '@/src/shared/layout/Screen';
import { PageHeading } from '@/src/shared/ui/PageHeading';
import { Avatar } from '@/src/shared/ui/Avatar';
import { SearchField } from '@/src/shared/ui/SearchField';
import { SegmentedTabs } from '@/src/shared/ui/SegmentedTabs';
import { expenseCategory, isInCurrentMonth } from '@/src/features/money/lib/expense';
import { formatCurrency, prettyDate } from '@/src/shared/lib/format';
import {
  moneyCategoryFromPurchase,
  moneyPersonLabel,
  moneyRemarkFromNote,
} from '@/src/features/money/lib/money';
import {
  getBalanceColor,
  getBalanceSoftColor,
  getPartyBalanceMeta,
  partyTypeLabel,
} from '@/src/features/parties/lib/party';
import {
  buildExpenseReceipt,
  buildPartyTransactionReceipt,
  buildSaleReceipt,
  openReceiptPreview,
} from '@/src/shared/lib/receipt';
import { isPersonalWorkspace } from '@/src/shared/lib/business';
import {
  useParties,
  usePartyTransactions,
  useBudgets,
  usePurchases,
  useSalesList,
} from '@/src/shared/hooks/useAppQueries';
import { useDebouncedValue } from '@/src/shared/hooks/useDebouncedValue';
import { useAuthStore } from '@/src/stores/auth-store';
import { useTranslation } from '@/src/i18n';
import { usePalette } from '@/src/stores/theme-store';
import { radius, shadows, spacing, typography } from '@/src/theme';
import { useThemedStyles } from '@/src/theme/use-themed-styles';
import type { AppPalette } from '@/src/theme/app-palette';
import type { Party, PartyTransaction, Purchase, Sale } from '@/src/types/models';

type PeriodFilter = 'month' | 'week' | 'all';
type TxFilter = 'all' | 'in' | 'out' | 'party';

interface UnifiedTransaction {
  id: string;
  kind: 'in' | 'out';
  category: string;
  title: string;
  subtitle: string;
  amount: number;
  date: string;
  paymentMethod?: string;
  partyId?: string;
  partyName?: string;
  rawPartyTx?: PartyTransaction;
  rawPurchase?: Purchase;
  rawSale?: Sale;
}

function isDateInPeriod(dateStr?: string, period?: PeriodFilter) {
  if (!dateStr || period === 'all') return true;
  if (period === 'month') return isInCurrentMonth(dateStr);
  if (period === 'week') {
    const d = new Date(dateStr).getTime();
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return d >= sevenDaysAgo;
  }
  return true;
}

export default function MoneyInsightsScreen() {
  const colors = usePalette();
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

  // Queries
  const expensesQuery = usePurchases('expense');
  const incomesQuery = usePurchases('income');
  const purchasesQuery = usePurchases('purchase');
  const salesQuery = useSalesList();
  const partyTxQuery = usePartyTransactions();
  const partiesQuery = useParties('', 'both');
  const budgetsQuery = useBudgets({ isActive: true });

  const parties = partiesQuery.data ?? [];
  const partyById = useMemo(
    () => new Map(parties.map((party) => [party.id, party])),
    [parties],
  );

  const isRefreshing =
    expensesQuery.isRefetching ||
    incomesQuery.isRefetching ||
    partyTxQuery.isRefetching ||
    partiesQuery.isRefetching ||
    salesQuery.isRefetching ||
    budgetsQuery.isRefetching;

  async function handleRefresh() {
    await Promise.all([
      expensesQuery.refetch(),
      incomesQuery.refetch(),
      purchasesQuery.refetch(),
      partyTxQuery.refetch(),
      partiesQuery.refetch(),
      salesQuery.refetch(),
      budgetsQuery.refetch(),
    ]);
  }

  // Unified list of all transactions
  const allTransactions = useMemo<UnifiedTransaction[]>(() => {
    const list: UnifiedTransaction[] = [];

    // 1. Direct Income entries
    (incomesQuery.data ?? []).forEach((item) => {
      const cat = moneyCategoryFromPurchase(item);
      const note = moneyRemarkFromNote(item.notes);
      list.push({
        id: `income-${item.id}`,
        kind: 'in',
        category: cat,
        title: cat,
        subtitle: [prettyDate(item.purchaseDate), note, item.paymentMethod === 'bank' ? 'Bank' : 'Cash']
          .filter(Boolean)
          .join('  ·  '),
        amount: Number(item.grandTotal || 0),
        date: item.purchaseDate || '',
        paymentMethod: item.paymentMethod,
        partyId: item.partyId || undefined,
        partyName: item.partyName || undefined,
        rawPurchase: item,
      });
    });

    // 2. Direct Expense entries
    (expensesQuery.data ?? []).forEach((item) => {
      const cat = expenseCategory(item);
      const note = moneyRemarkFromNote(item.notes);
      list.push({
        id: `expense-${item.id}`,
        kind: 'out',
        category: cat,
        title: cat,
        subtitle: [prettyDate(item.purchaseDate), note, item.paymentMethod === 'bank' ? 'Bank' : 'Cash']
          .filter(Boolean)
          .join('  ·  '),
        amount: Number(item.grandTotal || 0),
        date: item.purchaseDate || '',
        paymentMethod: item.paymentMethod,
        partyId: item.partyId || undefined,
        partyName: item.partyName || undefined,
        rawPurchase: item,
      });
    });

    // 3. Party Transactions (Receive = In, Give = Out)
    (partyTxQuery.data ?? []).forEach((tx) => {
      const party = partyById.get(tx.partyId);
      const isReceive = tx.direction === 'receive';
      const name = moneyPersonLabel(party, (tx as any).partyName);
      list.push({
        id: `tx-${tx.id}`,
        kind: isReceive ? 'in' : 'out',
        category: isReceive ? 'Money In' : 'Money Out',
        title: name || (isReceive ? 'Money Received' : 'Money Paid'),
        subtitle: [
          prettyDate(tx.txDate),
          tx.note || (isReceive ? 'Received' : 'Paid'),
          tx.paymentMethod === 'bank' ? 'Bank' : 'Cash',
        ]
          .filter(Boolean)
          .join('  ·  '),
        amount: Number(tx.amount || 0),
        date: tx.txDate || '',
        paymentMethod: tx.paymentMethod,
        partyId: tx.partyId || undefined,
        partyName: party?.name || undefined,
        rawPartyTx: tx,
      });
    });

    // 4. In Shop Workspace: Sales and Purchases
    if (!personal) {
      (salesQuery.data ?? []).forEach((sale) => {
        const party = sale.partyId ? partyById.get(sale.partyId) : null;
        const name = String(sale.partyName || party?.name || 'Walk-in Sale');
        list.push({
          id: `sale-${sale.id}`,
          kind: 'in',
          category: 'Sales',
          title: name,
          subtitle: [prettyDate(sale.saleDate), sale.invoiceNo ? `#${sale.invoiceNo}` : '', sale.paymentMethod === 'bank' ? 'Bank' : 'Cash']
            .filter(Boolean)
            .join('  ·  '),
          amount: Number(sale.grandTotal || 0),
          date: sale.saleDate || '',
          paymentMethod: sale.paymentMethod,
          partyId: sale.partyId || undefined,
          partyName: name,
          rawSale: sale,
        });
      });

      (purchasesQuery.data ?? []).forEach((purchase) => {
        const party = purchase.partyId ? partyById.get(purchase.partyId) : null;
        const name = String(purchase.partyName || party?.name || 'Supplier Purchase');
        list.push({
          id: `purchase-${purchase.id}`,
          kind: 'out',
          category: 'Purchases',
          title: name,
          subtitle: [prettyDate(purchase.purchaseDate), purchase.invoiceNo ? `#${purchase.invoiceNo}` : '', purchase.paymentMethod === 'bank' ? 'Bank' : 'Cash']
            .filter(Boolean)
            .join('  ·  '),
          amount: Number(purchase.grandTotal || 0),
          date: purchase.purchaseDate || '',
          paymentMethod: purchase.paymentMethod,
          partyId: purchase.partyId || undefined,
          partyName: name,
          rawPurchase: purchase,
        });
      });
    }

    return list.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }, [expensesQuery.data, incomesQuery.data, purchasesQuery.data, partyTxQuery.data, salesQuery.data, partyById, personal]);

  // Filtered transactions for selected period
  const periodTransactions = useMemo(
    () => allTransactions.filter((tx) => isDateInPeriod(tx.date, period)),
    [allTransactions, period],
  );

  // Category breakdown rows
  const breakdownRows: CategoryBreakdownItem[] = useMemo(() => {
    return periodTransactions.map((item) => ({
      id: item.id,
      kind: item.kind,
      title: item.category,
      amount: item.amount,
    }));
  }, [periodTransactions]);

  // Week Flow for the chart
  const weekFlow = useMemo(() => {
    const expenses = periodTransactions
      .filter((t) => t.kind === 'out')
      .map((t) => ({ purchaseDate: t.date, grandTotal: t.amount, entryType: 'expense' }));
    const incomes = periodTransactions
      .filter((t) => t.kind === 'in')
      .map((t) => ({ purchaseDate: t.date, grandTotal: t.amount, entryType: 'income' }));
    return buildSevenDayFlow({ expenses, incomes });
  }, [periodTransactions]);

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

  // Totals for the current period
  const periodTotals = useMemo(() => {
    const income = periodTransactions.filter((r) => r.kind === 'in').reduce((sum, r) => sum + r.amount, 0);
    const expense = periodTransactions.filter((r) => r.kind === 'out').reduce((sum, r) => sum + r.amount, 0);
    return { income, expense, saved: income - expense };
  }, [periodTransactions]);

  // Party summary / top contacts in this period
  const partyInsights = useMemo(() => {
    const map = new Map<string, { party: Party; totalIn: number; totalOut: number; txCount: number }>();

    periodTransactions.forEach((tx) => {
      if (!tx.partyId) return;
      const party = partyById.get(tx.partyId);
      if (!party) return;

      const existing = map.get(party.id) || { party, totalIn: 0, totalOut: 0, txCount: 0 };
      if (tx.kind === 'in') existing.totalIn += tx.amount;
      else existing.totalOut += tx.amount;
      existing.txCount += 1;
      map.set(party.id, existing);
    });

    // Also include parties with outstanding balances if none had recent transactions
    if (map.size === 0) {
      parties.forEach((p) => {
        if (Number(p.currentAmount || 0) !== 0) {
          map.set(p.id, { party: p, totalIn: 0, totalOut: 0, txCount: 0 });
        }
      });
    }

    return Array.from(map.values())
      .sort((a, b) => (b.totalIn + b.totalOut) - (a.totalIn + a.totalOut))
      .slice(0, 6);
  }, [parties, partyById, periodTransactions]);

  // Search & tab filtered transactions for list display
  const visibleTransactions = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    return periodTransactions.filter((tx) => {
      if (txFilter === 'in' && tx.kind !== 'in') return false;
      if (txFilter === 'out' && tx.kind !== 'out') return false;
      if (txFilter === 'party' && !tx.partyId && !tx.rawPartyTx) return false;

      if (!query) return true;
      return [tx.title, tx.category, tx.partyName, tx.subtitle]
        .filter(Boolean)
        .some((val) => String(val).toLowerCase().includes(query));
    });
  }, [debouncedSearch, periodTransactions, txFilter]);

  const handleOpenReceipt = (tx: UnifiedTransaction) => {
    if (tx.rawPartyTx) {
      const party = tx.partyId ? partyById.get(tx.partyId) : null;
      const { input, html } = buildPartyTransactionReceipt(tx.rawPartyTx, party, businessProfile);
      openReceiptPreview(router, input, html);
    } else if (tx.rawSale) {
      const { input, html } = buildSaleReceipt(tx.rawSale, businessProfile);
      openReceiptPreview(router, input, html);
    } else if (tx.rawPurchase) {
      const { input, html } = buildExpenseReceipt(tx.rawPurchase, businessProfile);
      openReceiptPreview(router, input, html);
    }
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
              {visibleTransactions.length} {visibleTransactions.length === 1 ? 'entry' : 'entries'}
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
