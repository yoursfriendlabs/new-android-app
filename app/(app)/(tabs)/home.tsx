import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { CoinChip } from '@/src/features/habits/components/CoinChip';
import { MoneyCharts } from '@/src/features/home/components/MoneyCharts';
import { buildSevenDayFlow } from '@/src/features/home/lib/flow-series';
import { Screen } from '@/src/shared/layout/Screen';
import { canAccessSegment, isGeneralStaffUser, isPersonalWorkspace } from '@/src/shared/lib/business';
import { expenseCategory } from '@/src/features/money/lib/expense';
import { DatePeriod, formatCurrency, getRangeForPeriod, prettyDate } from '@/src/shared/lib/format';
import { moneyCategoryFromNote, moneyPersonLabel } from '@/src/features/money/lib/money';
import { useHabitStore } from '@/src/stores/habit-store';
import { useAuthStore } from '@/src/stores/auth-store';
import { usePalette } from '@/src/stores/theme-store';
import {
  useBanks,
  useDashboardSummary,
  useParties,
  usePartyTransactions,
  useRecentPurchases,
  useRecentServices,
} from '@/src/shared/hooks/useAppQueries';
import { radius, shadows, spacing, typography } from '@/src/theme';

const PERIODS: Array<{ value: DatePeriod; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: 'this_week', label: 'Week' },
  { value: 'this_month', label: 'Month' },
  { value: 'this_year', label: 'Year' },
];

function initials(name?: string | null) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return 'PM';
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function money(value: number, visible: boolean, currency?: string) {
  if (!visible) return '••••';
  return formatCurrency(value, currency || 'NPR');
}

type Shortcut = {
  key: string;
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  route: string;
  segment: string;
};

const SHORTCUTS: Shortcut[] = [
  { key: 'pos', label: 'Sale', icon: 'cash-register', route: '/(app)/(tabs)/pos', segment: 'pos' },
  { key: 'party', label: 'Add party', icon: 'account-plus-outline', route: '/(app)/(tabs)/parties', segment: 'parties' },
  { key: 'in', label: 'Payment in', icon: 'arrow-down-bold-circle-outline', route: '/(app)/ledger', segment: 'ledger' },
  { key: 'out', label: 'Payment out', icon: 'arrow-up-bold-circle-outline', route: '/(app)/ledger', segment: 'ledger' },
  { key: 'expense', label: 'Expense', icon: 'wallet-outline', route: '/(app)/(tabs)/expenses', segment: 'expenses' },
  { key: 'note', label: 'Note', icon: 'note-plus-outline', route: '/(app)/tasks/form', segment: 'tasks' },
];

const PERSONAL_SHORTCUTS: Shortcut[] = [
  { key: 'income', label: 'Income', icon: 'arrow-down-bold-circle-outline', route: '/(app)/(tabs)/expenses?entry=income', segment: 'expenses' },
  { key: 'expense', label: 'Expense', icon: 'wallet-outline', route: '/(app)/(tabs)/expenses?entry=expense', segment: 'expenses' },
  { key: 'contact', label: 'Contact', icon: 'account-plus-outline', route: '/(app)/(tabs)/parties', segment: 'parties' },
  { key: 'note', label: 'Notes', icon: 'notebook-outline', route: '/(app)/tasks/inbox', segment: 'tasks' },
];

function inDateRange(iso: string | undefined, range: { from: string; to: string }) {
  const day = String(iso || '').slice(0, 10);
  if (!day) return true;
  return day >= range.from && day <= range.to;
}

export default function HomeScreen() {
  const colors = usePalette();
  const user = useAuthStore((state) => state.user);
  const session = useAuthStore((state) => state.session);
  const accessControl = useAuthStore((state) => state.accessControl);
  const businessProfile = useAuthStore((state) => state.businessProfile);
  const accessContext = {
    role: session?.role ?? user?.role ?? undefined,
    permissions: accessControl?.permissions ?? user?.permissions,
    accessControl,
    enabledModules: businessProfile?.enabledModules,
    businessType: String(businessProfile?.businessType ?? businessProfile?.type ?? ''),
  };

  const isGeneralStaff = isGeneralStaffUser(accessContext);

  useEffect(() => {
    if (isGeneralStaff) {
      router.replace('/(app)/attendance');
    }
  }, [isGeneralStaff]);

  const [selectedPeriod, setSelectedPeriod] = useState<DatePeriod>('this_month');
  const [refreshing, setRefreshing] = useState(false);
  const [balanceVisible, setBalanceVisible] = useState(true);
  const coins = useHabitStore((state) => state.coins);
  const range = useMemo(() => getRangeForPeriod(selectedPeriod), [selectedPeriod]);

  const summaryQuery = useDashboardSummary(range);
  const recentPurchasesQuery = useRecentPurchases();
  const recentServicesQuery = useRecentServices();
  const banksQuery = useBanks();
  const partyTxQuery = usePartyTransactions();
  const partiesQuery = useParties('', 'both');
  const isPersonal = isPersonalWorkspace(accessContext);
  const partyById = useMemo(
    () => new Map((partiesQuery.data ?? []).map((party) => [party.id, party])),
    [partiesQuery.data],
  );

  const summary = summaryQuery.data;
  const salesTotal = Number(summary?.salesTotal ?? 0);
  const expenseTotalFromDashboard = Number(summary?.expenseTotal ?? 0);
  const serviceTotal = Number(summary?.serviceTotal ?? 0);
  const personalIncome = (partyTxQuery.data ?? [])
    .filter((item) => item.direction === 'receive' && inDateRange(item.txDate, range))
    .reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
  const personalExpense = (recentPurchasesQuery.data ?? [])
    .filter((item) => item.entryType === 'expense' && inDateRange(item.purchaseDate, range))
    .reduce((sum, item) => sum + Number(item.grandTotal ?? 0), 0);
  const incomeTotal = isPersonal ? personalIncome : salesTotal + serviceTotal;
  const expenseTotal = isPersonal ? (expenseTotalFromDashboard || personalExpense) : expenseTotalFromDashboard;
  const pendingReceivable = Number(summary?.pendingReceivable ?? 0);
  const pendingPayable = Number(summary?.pendingPayable ?? 0);
  const net = isPersonal ? incomeTotal - expenseTotal : Number(summary?.profitOrLoss ?? incomeTotal - expenseTotal);
  const cashBankTotal = (banksQuery.data ?? []).reduce(
    (sum, bank) => sum + Number(bank.currentBalance ?? 0),
    0,
  );
  const currency = businessProfile?.currencyCode || 'NPR';
  const workspaceName = businessProfile?.businessName || 'PasalManager';
  const greetingName = user?.name?.split(' ')[0] || 'there';

  const shortcuts = (isPersonal ? PERSONAL_SHORTCUTS : SHORTCUTS).filter((item) =>
    canAccessSegment(accessContext, item.segment),
  );

  const recentTransactions = useMemo(() => {
    const list = [
      ...(canAccessSegment(accessContext, 'pos')
        ? (summary?.recentSales ?? []).map((sale) => ({
            id: `sale-${sale.id}`,
            kind: 'Sale',
            icon: 'cash-plus' as Shortcut['icon'],
            title: String(sale.partyName || sale.customerName || 'Walk-in sale'),
            subtitle: sale.invoiceNo ? `#${sale.invoiceNo}` : prettyDate(sale.saleDate),
            amount: Number(sale.grandTotal ?? 0),
            positive: true,
            route: '/(app)/(tabs)/pos',
            sort: sale.saleDate || '',
          }))
        : []),
      ...(recentPurchasesQuery.data ?? [])
        .filter((item) => !isPersonal || item.entryType === 'expense')
        .map((item) => ({
          id: `${item.entryType}-${item.id}`,
          kind: item.entryType === 'expense' ? 'Expense' : 'Purchase',
          icon: (item.entryType === 'expense' ? 'wallet-outline' : 'cart-outline') as Shortcut['icon'],
          title: isPersonal ? expenseCategory(item) : item.partyName || item.notes || (item.entryType === 'expense' ? 'Expense' : 'Purchase'),
          subtitle: isPersonal
            ? `${prettyDate(item.purchaseDate)}  ·  ${moneyPersonLabel(null, item.partyName)}`
            : prettyDate(item.purchaseDate),
          amount: Number(item.grandTotal ?? 0),
          positive: false,
          route: item.entryType === 'expense' ? '/(app)/(tabs)/expenses' : '/(app)/purchases',
          sort: item.purchaseDate || '',
        })),
      ...(canAccessSegment(accessContext, 'services')
        ? (recentServicesQuery.data ?? []).map((service) => ({
            id: `service-${service.id}`,
            kind: 'Service',
            icon: 'briefcase-outline' as Shortcut['icon'],
            title: String(service.partyName || service.customerName || 'Service'),
            subtitle: prettyDate(service.deliveryDate),
            amount: Number(service.grandTotal ?? 0),
            positive: true,
            route: '/(app)/(tabs)/services',
            sort: service.deliveryDate || '',
          }))
        : []),
      ...(isPersonal
        ? (partyTxQuery.data ?? []).map((item) => ({
            id: `tx-${item.id}`,
            kind: item.direction === 'receive' ? 'Income' : 'Paid',
            icon: (item.direction === 'receive' ? 'arrow-down-bold-circle-outline' : 'arrow-up-bold-circle-outline') as Shortcut['icon'],
            title: moneyCategoryFromNote(item.note) || (item.direction === 'receive' ? 'Income' : 'Paid'),
            subtitle: `${prettyDate(item.txDate)}  ·  ${moneyPersonLabel(partyById.get(item.partyId) ?? null)}`,
            amount: Number(item.amount ?? 0),
            positive: item.direction === 'receive',
            route: '/(app)/(tabs)/expenses',
            sort: item.txDate || '',
          }))
        : []),
    ];

    return list.sort((a, b) => b.sort.localeCompare(a.sort)).slice(0, 6);
  }, [accessContext, isPersonal, partyById, partyTxQuery.data, recentPurchasesQuery.data, recentServicesQuery.data, summary]);

  const personalWeekFlow = useMemo(
    () =>
      buildSevenDayFlow({
        expenses: recentPurchasesQuery.data ?? [],
        payments: partyTxQuery.data ?? [],
      }),
    [partyTxQuery.data, recentPurchasesQuery.data],
  );
  const personalWeekTotals = useMemo(
    () =>
      personalWeekFlow.reduce(
        (acc, point) => {
          acc.income += point.income;
          acc.expense += point.expense;
          return acc;
        },
        { income: 0, expense: 0 },
      ),
    [personalWeekFlow],
  );

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await Promise.all([
        summaryQuery.refetch(),
        recentPurchasesQuery.refetch(),
        recentServicesQuery.refetch(),
        banksQuery.refetch(),
        partyTxQuery.refetch(),
        partiesQuery.refetch(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }

  if (isGeneralStaff) {
    return (
      <Screen scrollable={false} padded={false}>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Screen>
    );
  }

  const metrics = [
    {
      key: 'income',
      label: 'Income',
      value: incomeTotal,
      hint: PERIODS.find((item) => item.value === selectedPeriod)?.label,
      tone: 'success' as const,
      onPress: () =>
        router.push(
          isPersonal
            ? '/(app)/(tabs)/expenses?entry=income'
            : canAccessSegment(accessContext, 'pos')
              ? '/(app)/(tabs)/pos'
              : '/(app)/ledger',
        ),
    },
    {
      key: 'expense',
      label: 'Expense',
      value: expenseTotal,
      hint: PERIODS.find((item) => item.value === selectedPeriod)?.label,
      tone: 'danger' as const,
      onPress: () => router.push('/(app)/(tabs)/expenses'),
    },
    {
      key: 'receive',
      label: isPersonal ? 'They owe me' : 'To receive',
      value: pendingReceivable,
      hint: isPersonal ? 'Contacts' : 'Parties',
      tone: 'neutral' as const,
      onPress: () => router.push(isPersonal ? '/(app)/(tabs)/parties' : '/(app)/ledger'),
    },
    {
      key: 'give',
      label: isPersonal ? 'I owe them' : 'To give',
      value: pendingPayable,
      hint: isPersonal ? 'Contacts' : 'Parties',
      tone: 'neutral' as const,
      onPress: () => router.push(isPersonal ? '/(app)/(tabs)/parties' : '/(app)/ledger'),
    },
    {
      key: 'balance',
      label: 'Cash & bank',
      value: cashBankTotal,
      hint: 'Accounts',
      tone: 'neutral' as const,
      onPress: () => router.push('/(app)/banks'),
    },
    {
      key: 'net',
      label: isPersonal ? (net >= 0 ? 'Saved' : 'Overspent') : net >= 0 ? 'Profit' : 'Loss',
      value: Math.abs(net),
      hint: 'This period',
      tone: net >= 0 ? ('success' as const) : ('danger' as const),
      onPress: () => router.push('/(app)/ledger'),
    },
  ];
  const visibleMetrics = isPersonal
    ? metrics.filter((metric) => ['income', 'expense', 'receive', 'give'].includes(metric.key))
    : metrics;

  return (
    <Screen padded={false} showTopBar={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} />}
        contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Pressable style={styles.profile} onPress={() => router.push('/(app)/(tabs)/more')}>
            <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
              <Text style={[styles.avatarText, { color: colors.onPrimary }]}>{initials(user?.name)}</Text>
            </View>
            <View style={styles.profileCopy}>
              <Text style={[styles.hello, { color: colors.text }]}>Hi, {greetingName}</Text>
              <Text numberOfLines={1} style={[styles.workspace, { color: colors.textMuted }]}>
                {workspaceName}
              </Text>
            </View>
          </Pressable>
          <View style={styles.headerActions}>
            {isPersonal ? <CoinChip coins={coins} compact /> : null}
            <Pressable
              style={[styles.iconButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
              onPress={() => setBalanceVisible((current) => !current)}>
              <MaterialCommunityIcons
                name={balanceVisible ? 'eye-outline' : 'eye-off-outline'}
                size={20}
                color={colors.text}
              />
            </Pressable>
            {canAccessSegment(accessContext, 'tasks') ? (
            <Pressable
              style={[styles.iconButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
              onPress={() => router.push('/(app)/tasks/notifications')}>
              <MaterialCommunityIcons name="bell-outline" size={20} color={colors.text} />
            </Pressable>
            ) : null}
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.periodRow}>
          {PERIODS.map((period) => {
            const active = selectedPeriod === period.value;
            return (
              <Pressable
                key={period.value}
                onPress={() => setSelectedPeriod(period.value)}
                style={[
                  styles.periodChip,
                  {
                    backgroundColor: active ? colors.primary : colors.surface,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}>
                <Text style={[styles.periodLabel, { color: active ? colors.onPrimary : colors.textMuted }]}>
                  {period.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {isPersonal ? (
          <MoneyCharts
            series={personalWeekFlow}
            incomeTotal={personalWeekTotals.income}
            expenseTotal={personalWeekTotals.expense}
            currency={currency}
            hideAmounts={!balanceVisible}
          />
        ) : null}

        <View style={styles.metricGrid}>
          {visibleMetrics.map((metric) => {
            const backgroundColor =
              metric.tone === 'success'
                ? colors.successSoft
                : metric.tone === 'danger'
                  ? colors.dangerSoft
                  : colors.surface;
            const valueColor =
              metric.tone === 'success' ? colors.success : metric.tone === 'danger' ? colors.danger : colors.text;
            return (
              <Pressable
                key={metric.key}
                onPress={metric.onPress}
                style={[styles.metricCard, { backgroundColor, borderColor: colors.border }]}>
                <View style={styles.metricTop}>
                  <Text style={[styles.metricLabel, { color: colors.textMuted }]}>{metric.label}</Text>
                  <MaterialCommunityIcons name="chevron-right" size={16} color={colors.textSoft} />
                </View>
                <Text numberOfLines={1} style={[styles.metricValue, { color: valueColor }]}>
                  {money(metric.value, balanceVisible, currency)}
                </Text>
                <Text style={[styles.metricHint, { color: colors.textSoft }]}>{metric.hint}</Text>
              </Pressable>
            );
          })}
        </View>

        {shortcuts.length ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Shortcuts</Text>
              <Pressable onPress={() => router.push('/(app)/(tabs)/more')}>
                <Text style={[styles.sectionLink, { color: colors.primary }]}>All tools</Text>
              </Pressable>
            </View>
            <View style={styles.shortcutRow}>
              {shortcuts.map((item) => (
                <Pressable key={item.key} style={styles.shortcut} onPress={() => router.push(item.route as never)}>
                  <View style={[styles.shortcutIcon, { backgroundColor: colors.primary }]}>
                    <MaterialCommunityIcons name={item.icon} size={20} color={colors.onPrimary} />
                  </View>
                  <Text numberOfLines={2} style={[styles.shortcutLabel, { color: colors.textMuted }]}>
                    {item.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent activity</Text>
            <Pressable onPress={() => router.push(isPersonal ? '/(app)/(tabs)/expenses' : '/(app)/ledger')}>
              <Text style={[styles.sectionLink, { color: colors.primary }]}>{isPersonal ? 'Money' : 'Ledger'}</Text>
            </Pressable>
          </View>
          <View style={[styles.listCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {recentTransactions.length ? (
              recentTransactions.map((item, index) => (
                <View key={item.id}>
                  {index > 0 ? <View style={[styles.divider, { backgroundColor: colors.border }]} /> : null}
                  <Pressable style={styles.row} onPress={() => router.push(item.route as never)}>
                    <View style={[styles.rowIcon, { backgroundColor: colors.accentSoft }]}>
                      <MaterialCommunityIcons name={item.icon} size={18} color={colors.primary} />
                    </View>
                    <View style={styles.rowCopy}>
                      <Text numberOfLines={1} style={[styles.rowTitle, { color: colors.text }]}>
                        {item.title}
                      </Text>
                      <Text numberOfLines={1} style={[styles.rowSubtitle, { color: colors.textMuted }]}>
                        {item.kind} · {item.subtitle}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.rowAmount,
                        { color: item.positive ? colors.success : colors.danger },
                      ]}>
                      {item.positive ? '+' : '-'}
                      {money(item.amount, balanceVisible, currency)}
                    </Text>
                  </Pressable>
                </View>
              ))
            ) : (
              <View style={styles.empty}>
                <Text style={[styles.emptyTitle, { color: colors.text }]}>No activity yet</Text>
                <Text style={[styles.emptyCopy, { color: colors.textMuted }]}>
                  {isPersonal
                    ? 'Income, expenses, and payments to contacts will show up here.'
                    : 'Sales, expenses, and party payments will show up here.'}
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '800',
  },
  profileCopy: {
    flex: 1,
    gap: 2,
  },
  hello: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  workspace: {
    fontSize: typography.label,
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodRow: {
    gap: spacing.xs,
  },
  periodChip: {
    minHeight: 34,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: 'center',
  },
  periodLabel: {
    fontSize: typography.label,
    fontWeight: '700',
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  metricCard: {
    width: '48%',
    flexGrow: 1,
    minWidth: 148,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    gap: 6,
    ...shadows.card,
  },
  metricTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metricLabel: {
    fontSize: typography.caption,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  metricHint: {
    fontSize: 11,
  },
  section: {
    gap: spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: typography.subheading,
    fontWeight: '700',
  },
  sectionLink: {
    fontSize: typography.label,
    fontWeight: '700',
  },
  shortcutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  shortcut: {
    alignItems: 'center',
    width: 64,
    gap: spacing.xs,
  },
  shortcutIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcutLabel: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 14,
  },
  listCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    ...shadows.card,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
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
  rowSubtitle: {
    fontSize: typography.caption,
  },
  rowAmount: {
    fontSize: typography.body,
    fontWeight: '700',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  empty: {
    paddingVertical: spacing.xl,
    gap: spacing.xs,
  },
  emptyTitle: {
    fontSize: typography.body,
    fontWeight: '700',
  },
  emptyCopy: {
    fontSize: typography.caption,
    lineHeight: 18,
  },
});
