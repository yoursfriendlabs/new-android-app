import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { format, parseISO } from 'date-fns';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CoinChip } from '@/src/features/habits/components/CoinChip';
import { DailyMoneyReminderSheet } from '@/src/features/habits/components/DailyMoneyReminderSheet';
import { SaveGoalSheet } from '@/src/features/habits/components/SaveGoalSheet';
import { formatClockTime } from '@/src/features/habits/lib/daily-money-reminder';
import { uniqueLogDays } from '@/src/features/habits/lib/habits';
import { MoneyCharts } from '@/src/features/home/components/MoneyCharts';
import { PersonalPulseStrip } from '@/src/features/home/components/PersonalPulseStrip';
import { useMoneyActivity } from '@/src/features/home/hooks/useMoneyActivity';
import type { FlowPoint } from '@/src/features/home/lib/flow-series';
import type { PersonalPulse } from '@/src/features/home/lib/personal-pulse';
import { MoneyEntrySheet, type MoneyEntryKind } from '@/src/features/money/components/MoneyEntrySheet';
import { expenseCategory } from '@/src/features/money/lib/expense';
import { isHiddenMoneyParty, moneyCategoryFromPurchase, moneyPersonLabel, moneyRemarkFromNote } from '@/src/features/money/lib/money';
import { WorkspaceSwitchSheet } from '@/src/features/auth/components/WorkspaceSwitchSheet';
import { Avatar } from '@/src/shared/ui/Avatar';
import { EmptyState } from '@/src/shared/ui/EmptyState';
import { Screen } from '@/src/shared/layout/Screen';
import { canAccessSegment } from '@/src/shared/lib/business';
import { formatCurrency, getRangeForPeriod, prettyDate } from '@/src/shared/lib/format';
import { useDashboardSummary } from '@/src/shared/hooks/useAppQueries';
import { useAuthStore } from '@/src/stores/auth-store';
import { useHabitStore } from '@/src/stores/habit-store';
import { usePalette } from '@/src/stores/theme-store';
import { useTranslation } from '@/src/i18n';
import { radius, shadows, spacing, typography } from '@/src/theme';
import { useThemedStyles } from '@/src/theme/use-themed-styles';
import type { AppPalette } from '@/src/theme/app-palette';
import type { Party } from '@/src/types/models';

type Shortcut = {
  key: string;
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  segment: string;
  onPress: () => void;
};

function money(value: number, visible: boolean, currency?: string) {
  if (!visible) return '••••';
  return formatCurrency(value, currency || 'NPR');
}

export function PersonalHomeScreen() {
  const colors = usePalette();
  const styles = useThemedStyles(createStyles);
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

  const [refreshing, setRefreshing] = useState(false);
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [logKind, setLogKind] = useState<MoneyEntryKind>('expense');
  const [logVisible, setLogVisible] = useState(false);
  const [goalVisible, setGoalVisible] = useState(false);
  const [reminderVisible, setReminderVisible] = useState(false);
  const [workspaceSheetVisible, setWorkspaceSheetVisible] = useState(false);

  const coins = useHabitStore((state) => state.coins);
  const saveGoal = useHabitStore((state) => state.saveGoal);
  const storedLogDates = useHabitStore((state) => state.logDates);
  const dailyReminder = useHabitStore((state) => state.dailyMoneyReminder);

  // Chart, streak days, counts, party leaders and latest entries all come from
  // the server; month totals come from the dashboard summary.
  const activityQuery = useMoneyActivity(7);
  const activity = activityQuery.data;
  const monthRange = getRangeForPeriod('this_month');
  const summaryQuery = useDashboardSummary(monthRange);

  const currency = businessProfile?.currencyCode || 'NPR';
  const workspaceName = businessProfile?.businessName || 'PM';
  const greetingName = user?.name?.split(' ')[0] || 'there';

  useEffect(() => {
    void useHabitStore.getState().applyDailyMoneyReminder(true);
  }, []);

  const pulse = useMemo<PersonalPulse>(() => {
    const summary = summaryQuery.data;
    const monthIncome = Number(summary?.incomeTotal ?? 0);
    const monthExpense = Number(summary?.expenseTotal ?? 0);
    const balances = activity?.partyBalances;
    const topName = (parties?: Party[]) => parties?.find((party) => !isHiddenMoneyParty(party))?.name ?? null;
    return {
      todaySpent: activity?.flow.at(-1)?.expense ?? 0,
      monthIncome,
      monthExpense,
      monthSaved: monthIncome - monthExpense,
      theyOweYou: Number(summary?.toReceive ?? 0),
      youOweThem: Number(summary?.toPay ?? 0),
      oweCount: balances?.receiveCount ?? 0,
      payCount: balances?.payCount ?? 0,
      topOwedBy: topName(balances?.topReceive),
      topOwedTo: topName(balances?.topPay),
    };
  }, [activity, summaryQuery.data]);

  const activityDates = useMemo(
    () => uniqueLogDays([...storedLogDates, ...(activity?.activityDates ?? [])]),
    [activity?.activityDates, storedLogDates],
  );
  const allTimeCounts = useMemo(() => {
    const counts = activity?.counts;
    const incomeCount = counts?.incomeCount ?? 0;
    const expenseCount = counts?.expenseCount ?? 0;
    return {
      entryCount: incomeCount + expenseCount + (counts?.partyTransactionCount ?? 0),
      incomeCount,
      expenseCount,
    };
  }, [activity?.counts]);

  const personalWeekFlow = useMemo<FlowPoint[]>(
    () =>
      (activity?.flow ?? []).map((point) => ({
        key: point.date,
        label: format(parseISO(point.date), 'EEEEE'),
        income: point.income,
        expense: point.expense,
      })),
    [activity?.flow],
  );
  const personalWeekTotals = activity?.flowTotals ?? { income: 0, expense: 0 };

  const recentTransactions = useMemo(() => {
    const list = [
      ...(activity?.recentPurchases ?? []).filter((item) => item.entryType === 'expense').map((item) => ({
        id: `expense-${item.id}`,
        kind: t('home.expense'),
        icon: 'wallet-outline' as Shortcut['icon'],
        title: expenseCategory(item),
        subtitle: [prettyDate(item.purchaseDate), moneyRemarkFromNote(item.notes)].filter(Boolean).join('  ·  '),
        amount: Number(item.grandTotal ?? 0),
        positive: false,
        route: '/(app)/(tabs)/expenses',
        sort: item.purchaseDate || '',
      })),
      ...(activity?.recentPurchases ?? []).filter((item) => item.entryType === 'income').map((item) => ({
        id: `income-${item.id}`,
        kind: t('home.income'),
        icon: 'arrow-down-bold-circle-outline' as Shortcut['icon'],
        title: moneyCategoryFromPurchase(item),
        subtitle: [prettyDate(item.purchaseDate), moneyRemarkFromNote(item.notes)].filter(Boolean).join('  ·  '),
        amount: Number(item.grandTotal ?? 0),
        positive: true,
        route: '/(app)/(tabs)/expenses',
        sort: item.purchaseDate || '',
      })),
      ...(activity?.recentPartyTransactions ?? []).map((item) => ({
        id: `tx-${item.id}`,
        kind: item.direction === 'receive' ? t('parties.toReceive') : t('parties.toPay'),
        icon: (item.direction === 'receive' ? 'arrow-down-bold-circle-outline' : 'arrow-up-bold-circle-outline') as Shortcut['icon'],
        title: item.note || (item.direction === 'receive' ? t('parties.toReceive') : t('parties.toPay')),
        subtitle: `${prettyDate(item.txDate)}  ·  ${moneyPersonLabel(null, item.partyName)}`,
        amount: Number(item.amount ?? 0),
        positive: item.direction === 'receive',
        route: '/(app)/(tabs)/parties',
        sort: item.txDate || '',
      })),
    ];
    return list.sort((a, b) => b.sort.localeCompare(a.sort)).slice(0, 6);
  }, [activity?.recentPartyTransactions, activity?.recentPurchases, t]);

  const shortcuts = (
    [
      {
        key: 'income',
        label: t('home.income'),
        icon: 'arrow-down-bold-circle-outline',
        segment: 'expenses',
        onPress: () => {
          setLogKind('income');
          setLogVisible(true);
        },
      },
      {
        key: 'expense',
        label: t('home.expense'),
        icon: 'wallet-outline',
        segment: 'expenses',
        onPress: () => {
          setLogKind('expense');
          setLogVisible(true);
        },
      },
      {
        key: 'contact',
        label: t('home.contact'),
        icon: 'account-plus-outline',
        segment: 'parties',
        onPress: () => router.push('/(app)/(tabs)/parties'),
      },
      {
        key: 'note',
        label: t('home.notes'),
        icon: 'notebook-outline',
        segment: 'tasks',
        onPress: () => router.push('/(app)/tasks/inbox'),
      },
    ] satisfies Shortcut[]
  ).filter((item) => canAccessSegment(accessContext, item.segment));

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await Promise.all([
        activityQuery.refetch(),
        summaryQuery.refetch(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }

  function openLog(kind: MoneyEntryKind) {
    setLogKind(kind);
    setLogVisible(true);
  }

  return (
    <Screen padded={false} showTopBar={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} />}
        contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Pressable
            style={({ pressed }) => [styles.profile, pressed && { opacity: 0.78 }]}
            onPress={() => setWorkspaceSheetVisible(true)}>
            <Avatar
              uri={user?.avatarUrl}
              name={workspaceName || user?.name}
              size={44}
              shape="rounded"
            />
            <View style={styles.profileCopy}>
              <View style={styles.workspaceRow}>
                <Text numberOfLines={1} style={[styles.workspaceTitle, { color: colors.text }]}>
                  {workspaceName}
                </Text>
                <View style={[styles.chevronWrap, { backgroundColor: colors.backgroundAlt }]}>
                  <MaterialCommunityIcons name="chevron-down" size={16} color={colors.text} />
                </View>
              </View>
              <Text numberOfLines={1} style={[styles.greetingSubtitle, { color: colors.textMuted }]}>
                {t('home.hiGreeting', { name: greetingName })}
              </Text>
            </View>
          </Pressable>
          <View style={styles.headerActions}>
            <CoinChip coins={coins} compact />
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

        <PersonalPulseStrip
          pulse={pulse}
          currency={currency}
          hideAmounts={!balanceVisible}
          onPressIncome={() => router.push('/(app)/(tabs)/expenses?filter=in' as never)}
          onPressExpense={() => router.push('/(app)/(tabs)/expenses?filter=out' as never)}
          onPressReceive={() => router.push('/(app)/(tabs)/parties')}
          onPressPay={() => router.push('/(app)/(tabs)/parties')}
        />

        <Pressable style={styles.logButton} onPress={() => openLog('expense')}>
          <MaterialCommunityIcons name="plus" size={20} color={colors.onPrimary} />
          <Text style={styles.logLabel}>{t('home.logMoney')}</Text>
        </Pressable>
        <Text style={[styles.logHint, { color: colors.textMuted }]}>{t('home.logMoneyHint')}</Text>

        <Pressable
          style={[styles.reminderRow, { borderColor: colors.border, backgroundColor: colors.surface }]}
          onPress={() => setReminderVisible(true)}>
          <View style={[styles.reminderIcon, { backgroundColor: colors.accentSoft }]}>
            <MaterialCommunityIcons name="bell-outline" size={18} color={colors.primary} />
          </View>
          <View style={styles.reminderCopy}>
            <Text style={[styles.reminderTitle, { color: colors.text }]}>{t('home.dailyReminder')}</Text>
            <Text style={[styles.reminderHint, { color: colors.textMuted }]}>
              {dailyReminder.enabled
                ? t('home.dailyReminderOn', { time: formatClockTime(dailyReminder.hour, dailyReminder.minute) })
                : t('home.dailyReminderOff')}
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textSoft} />
        </Pressable>

        <MoneyCharts
          series={personalWeekFlow}
          incomeTotal={personalWeekTotals.income}
          expenseTotal={personalWeekTotals.expense}
          currency={currency}
          hideAmounts={!balanceVisible}
        />

        {shortcuts.length ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('home.shortcuts')}</Text>
              <Pressable onPress={() => router.push('/(app)/(tabs)/more')}>
                <Text style={[styles.sectionLink, { color: colors.primary }]}>{t('home.allTools')}</Text>
              </Pressable>
            </View>
            <View style={styles.shortcutRow}>
              {shortcuts.map((item) => (
                <Pressable key={item.key} style={styles.shortcut} onPress={item.onPress}>
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
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('home.recentActivity')}</Text>
            <Pressable onPress={() => router.push('/(app)/(tabs)/expenses')}>
              <Text style={[styles.sectionLink, { color: colors.primary }]}>{t('nav.money')}</Text>
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
                    <Text style={[styles.rowAmount, { color: item.positive ? colors.success : colors.danger }]}>
                      {item.positive ? '+' : '-'}
                      {money(item.amount, balanceVisible, currency)}
                    </Text>
                  </Pressable>
                </View>
              ))
            ) : (
              <EmptyState
                icon="notebook-outline"
                title={t('home.noActivityYet')}
                message={t('home.noActivityHint')}
              />
            )}
          </View>
        </View>
      </ScrollView>

      <MoneyEntrySheet
        visible={logVisible}
        kind={logKind}
        compact
        activityDates={activityDates}
        snapshot={{ ...allTimeCounts, savedThisMonth: pulse.monthSaved }}
        onClose={() => setLogVisible(false)}
      />
      <SaveGoalSheet
        visible={goalVisible}
        currency={currency}
        value={saveGoal}
        onClose={() => setGoalVisible(false)}
        onSave={(amount) => void useHabitStore.getState().setSaveGoal(amount)}
      />
      <DailyMoneyReminderSheet
        visible={reminderVisible}
        value={dailyReminder}
        onClose={() => setReminderVisible(false)}
        onSave={async (next) => {
          await useHabitStore.getState().setDailyMoneyReminder(next);
          await useHabitStore.getState().applyDailyMoneyReminder(true);
        }}
      />
      <WorkspaceSwitchSheet
        visible={workspaceSheetVisible}
        onClose={() => setWorkspaceSheetVisible(false)}
      />
    </Screen>
  );
}

const createStyles = (colors: AppPalette) =>
  StyleSheet.create({
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
      paddingRight: spacing.xs,
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      fontSize: 15,
      fontWeight: '800',
    },
    profileCopy: {
      flex: 1,
      gap: 1,
    },
    workspaceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    workspaceTitle: {
      fontSize: 18,
      fontWeight: '800',
      letterSpacing: -0.3,
      flexShrink: 1,
    },
    chevronWrap: {
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
    },
    greetingSubtitle: {
      fontSize: typography.caption,
      fontWeight: '500',
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
    logButton: {
      minHeight: 52,
      borderRadius: radius.md,
      backgroundColor: colors.primary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
    },
    logLabel: {
      color: colors.onPrimary,
      fontWeight: '800',
      fontSize: typography.body,
    },
    logHint: {
      marginTop: -spacing.sm,
      fontSize: typography.caption,
      textAlign: 'center',
    },
    reminderRow: {
      minHeight: 56,
      borderRadius: radius.md,
      borderWidth: 1,
      paddingHorizontal: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    reminderIcon: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    reminderCopy: {
      flex: 1,
      gap: 2,
    },
    reminderTitle: {
      fontSize: typography.body,
      fontWeight: '700',
    },
    reminderHint: {
      fontSize: typography.caption,
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
  });
