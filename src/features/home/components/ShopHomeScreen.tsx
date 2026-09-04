import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/src/shared/layout/Screen';
import { canAccessSegment } from '@/src/shared/lib/business';
import { DatePeriod, formatCurrency, getRangeForPeriod, prettyDate } from '@/src/shared/lib/format';
import { useAuthStore } from '@/src/stores/auth-store';
import { usePalette } from '@/src/stores/theme-store';
import { useTranslation } from '@/src/i18n';
import {
  useBanks,
  useDashboardSummary,
  useRecentPurchases,
  useRecentServices,
} from '@/src/shared/hooks/useAppQueries';
import { radius, shadows, spacing, typography } from '@/src/theme';

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
  labelKey: string;
  fallbackLabel: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  route: string;
  segment: string;
};

const SHORTCUTS: Shortcut[] = [
  { key: 'pos', labelKey: 'nav.pos', fallbackLabel: 'Sale', icon: 'cash-register', route: '/(app)/(tabs)/pos', segment: 'pos' },
  { key: 'party', labelKey: 'parties.addParty', fallbackLabel: 'Add party', icon: 'account-plus-outline', route: '/(app)/(tabs)/parties', segment: 'parties' },
  { key: 'in', labelKey: 'parties.gotMoney', fallbackLabel: 'Payment in', icon: 'arrow-down-bold-circle-outline', route: '/(app)/ledger', segment: 'ledger' },
  { key: 'out', labelKey: 'parties.giveMoney', fallbackLabel: 'Payment out', icon: 'arrow-up-bold-circle-outline', route: '/(app)/ledger', segment: 'ledger' },
  { key: 'expense', labelKey: 'money.addExpense', fallbackLabel: 'Expense', icon: 'wallet-outline', route: '/(app)/(tabs)/expenses', segment: 'expenses' },
  { key: 'note', labelKey: 'tasks.addTask', fallbackLabel: 'Note', icon: 'note-plus-outline', route: '/(app)/tasks/form', segment: 'tasks' },
];

export function ShopHomeScreen() {
  const colors = usePalette();
  const { t } = useTranslation();
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

  const PERIODS: Array<{ value: DatePeriod; label: string }> = [
    { value: 'today', label: t('common.today') },
    { value: 'this_week', label: t('common.thisWeek') },
    { value: 'this_month', label: t('common.thisMonth') },
    { value: 'this_year', label: 'Year' },
  ];

  const [selectedPeriod, setSelectedPeriod] = useState<DatePeriod>('this_month');
  const [refreshing, setRefreshing] = useState(false);
  const [balanceVisible, setBalanceVisible] = useState(true);
  const range = useMemo(() => getRangeForPeriod(selectedPeriod), [selectedPeriod]);

  const summaryQuery = useDashboardSummary(range);
  const recentPurchasesQuery = useRecentPurchases();
  const recentServicesQuery = useRecentServices();
  const banksQuery = useBanks();

  const summary = summaryQuery.data;
  const salesTotal = Number(summary?.salesTotal ?? 0);
  const expenseTotalFromDashboard = Number(summary?.expenseTotal ?? 0);
  const serviceTotal = Number(summary?.serviceTotal ?? 0);
  const incomeTotal = salesTotal + serviceTotal;
  const expenseTotal = expenseTotalFromDashboard;
  const pendingReceivable = Number(summary?.pendingReceivable ?? 0);
  const pendingPayable = Number(summary?.pendingPayable ?? 0);
  const net = Number(summary?.profitOrLoss ?? incomeTotal - expenseTotal);
  const cashBankTotal = (banksQuery.data ?? []).reduce(
    (sum, bank) => sum + Number(bank.currentBalance ?? 0),
    0,
  );
  const currency = businessProfile?.currencyCode || 'NPR';
  const workspaceName = businessProfile?.businessName || 'PasalManager';
  const greetingName = user?.name?.split(' ')[0] || 'there';

  const shortcuts = SHORTCUTS.filter((item) => canAccessSegment(accessContext, item.segment));

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
      ...(recentPurchasesQuery.data ?? []).map((item) => ({
        id: `${item.entryType}-${item.id}`,
        kind: item.entryType === 'expense' ? 'Expense' : 'Purchase',
        icon: (item.entryType === 'expense' ? 'wallet-outline' : 'cart-outline') as Shortcut['icon'],
        title: item.partyName || item.notes || (item.entryType === 'expense' ? 'Expense' : 'Purchase'),
        subtitle: prettyDate(item.purchaseDate),
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
    ];

    return list.sort((a, b) => b.sort.localeCompare(a.sort)).slice(0, 6);
  }, [accessContext, recentPurchasesQuery.data, recentServicesQuery.data, summary]);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await Promise.all([
        summaryQuery.refetch(),
        recentPurchasesQuery.refetch(),
        recentServicesQuery.refetch(),
        banksQuery.refetch(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }

  const metrics = [
    {
      key: 'income',
      label: t('home.todayIncome'),
      value: incomeTotal,
      hint: PERIODS.find((item) => item.value === selectedPeriod)?.label,
      tone: 'success' as const,
      onPress: () =>
        router.push(canAccessSegment(accessContext, 'pos') ? '/(app)/(tabs)/pos' : '/(app)/ledger'),
    },
    {
      key: 'expense',
      label: t('home.todayExpenses'),
      value: expenseTotal,
      hint: PERIODS.find((item) => item.value === selectedPeriod)?.label,
      tone: 'danger' as const,
      onPress: () => router.push('/(app)/(tabs)/expenses'),
    },
    {
      key: 'receive',
      label: t('parties.youWillGet'),
      value: pendingReceivable,
      hint: t('nav.parties'),
      tone: 'neutral' as const,
      onPress: () => router.push('/(app)/ledger'),
    },
    {
      key: 'give',
      label: t('parties.youWillGive'),
      value: pendingPayable,
      hint: t('nav.parties'),
      tone: 'neutral' as const,
      onPress: () => router.push('/(app)/ledger'),
    },
    {
      key: 'balance',
      label: `${t('common.cash')} & ${t('common.bank')}`,
      value: cashBankTotal,
      hint: t('money.bankAccounts'),
      tone: 'neutral' as const,
      onPress: () => router.push('/(app)/banks'),
    },
    {
      key: 'net',
      label: net >= 0 ? t('home.netWorth') : 'Loss',
      value: Math.abs(net),
      hint: PERIODS.find((item) => item.value === selectedPeriod)?.label || t('common.thisMonth'),
      tone: net >= 0 ? ('success' as const) : ('danger' as const),
      onPress: () => router.push('/(app)/ledger'),
    },
  ];

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
              <Text style={[styles.hello, { color: colors.text }]}>{t('home.welcome')}, {greetingName}</Text>
              <Text numberOfLines={1} style={[styles.workspace, { color: colors.textMuted }]}>
                {workspaceName}
              </Text>
            </View>
          </Pressable>
          <View style={styles.headerActions}>
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

        <View style={styles.metricGrid}>
          {metrics.map((metric) => {
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
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('home.quickActions')}</Text>
              <Pressable onPress={() => router.push('/(app)/(tabs)/more')}>
                <Text style={[styles.sectionLink, { color: colors.primary }]}>{t('common.viewAll')}</Text>
              </Pressable>
            </View>
            <View style={styles.shortcutRow}>
              {shortcuts.map((item) => (
                <Pressable key={item.key} style={styles.shortcut} onPress={() => router.push(item.route as never)}>
                  <View style={[styles.shortcutIcon, { backgroundColor: colors.primary }]}>
                    <MaterialCommunityIcons name={item.icon} size={20} color={colors.onPrimary} />
                  </View>
                  <Text numberOfLines={2} style={[styles.shortcutLabel, { color: colors.textMuted }]}>
                    {t(item.labelKey) || item.fallbackLabel}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('home.recentActivity')}</Text>
            <Pressable onPress={() => router.push('/(app)/ledger')}>
              <Text style={[styles.sectionLink, { color: colors.primary }]}>{t('money.ledger')}</Text>
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
                <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('common.noData')}</Text>
                <Text style={[styles.emptyCopy, { color: colors.textMuted }]}>
                  {t('home.recentActivity')}
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
