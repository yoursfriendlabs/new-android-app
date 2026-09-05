import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CoinChip } from '@/src/features/habits/components/CoinChip';
import { DailyMoneyReminderSheet } from '@/src/features/habits/components/DailyMoneyReminderSheet';
import { SaveGoalSheet } from '@/src/features/habits/components/SaveGoalSheet';
import { formatClockTime } from '@/src/features/habits/lib/daily-money-reminder';
import { uniqueLogDays } from '@/src/features/habits/lib/habits';
import { MoneyCharts } from '@/src/features/home/components/MoneyCharts';
import { PersonalPulseStrip } from '@/src/features/home/components/PersonalPulseStrip';
import { PersonalShareWidget } from '@/src/features/shares/components/PersonalShareWidget';
import { buildSevenDayFlow } from '@/src/features/home/lib/flow-series';
import { buildPersonalPulse } from '@/src/features/home/lib/personal-pulse';
import { MoneyEntrySheet, type MoneyEntryKind } from '@/src/features/money/components/MoneyEntrySheet';
import { expenseCategory } from '@/src/features/money/lib/expense';
import { moneyCategoryFromNote, moneyPersonLabel } from '@/src/features/money/lib/money';
import { Screen } from '@/src/shared/layout/Screen';
import { canAccessSegment } from '@/src/shared/lib/business';
import { formatCurrency, prettyDate } from '@/src/shared/lib/format';
import { useParties, usePartyTransactions, usePurchases } from '@/src/shared/hooks/useAppQueries';
import { useAuthStore } from '@/src/stores/auth-store';
import { useHabitStore } from '@/src/stores/habit-store';
import { usePalette } from '@/src/stores/theme-store';
import { useTranslation } from '@/src/i18n';
import { radius, shadows, spacing, typography } from '@/src/theme';
import { useThemedStyles } from '@/src/theme/use-themed-styles';
import type { AppPalette } from '@/src/theme/app-palette';

type Shortcut = {
  key: string;
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  segment: string;
  onPress: () => void;
};

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

  const coins = useHabitStore((state) => state.coins);
  const saveGoal = useHabitStore((state) => state.saveGoal);
  const storedLogDates = useHabitStore((state) => state.logDates);
  const dailyReminder = useHabitStore((state) => state.dailyMoneyReminder);

  const expensesQuery = usePurchases('expense');
  const partyTxQuery = usePartyTransactions();
  const partiesQuery = useParties('', 'both');

  const currency = businessProfile?.currencyCode || 'NPR';
  const workspaceName = businessProfile?.businessName || 'PM';
  const greetingName = user?.name?.split(' ')[0] || 'there';
  const partyById = useMemo(
    () => new Map((partiesQuery.data ?? []).map((party) => [party.id, party])),
    [partiesQuery.data],
  );

  useEffect(() => {
    void useHabitStore.getState().applyDailyMoneyReminder(true);
  }, []);

  const pulse = useMemo(
    () =>
      buildPersonalPulse({
        expenses: expensesQuery.data ?? [],
        payments: partyTxQuery.data ?? [],
        parties: partiesQuery.data ?? [],
      }),
    [expensesQuery.data, partiesQuery.data, partyTxQuery.data],
  );

  const activityDates = useMemo(
    () =>
      uniqueLogDays([
        ...storedLogDates,
        ...(expensesQuery.data ?? []).map((item) => item.purchaseDate),
        ...(partyTxQuery.data ?? []).map((item) => item.txDate),
      ]),
    [expensesQuery.data, partyTxQuery.data, storedLogDates],
  );
  const allTimeCounts = useMemo(() => {
    const expenseCount = expensesQuery.data?.length ?? 0;
    const incomeCount = (partyTxQuery.data ?? []).filter((item) => item.direction === 'receive').length;
    return {
      entryCount: expenseCount + (partyTxQuery.data?.length ?? 0),
      incomeCount,
      expenseCount,
    };
  }, [expensesQuery.data, partyTxQuery.data]);

  const personalWeekFlow = useMemo(
    () =>
      buildSevenDayFlow({
        expenses: expensesQuery.data ?? [],
        payments: partyTxQuery.data ?? [],
      }),
    [partyTxQuery.data, expensesQuery.data],
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

  const recentTransactions = useMemo(() => {
    const list = [
      ...(expensesQuery.data ?? []).map((item) => ({
        id: `expense-${item.id}`,
        kind: t('home.expense'),
        icon: 'wallet-outline' as Shortcut['icon'],
        title: expenseCategory(item),
        subtitle: `${prettyDate(item.purchaseDate)}  ·  ${moneyPersonLabel(null, item.partyName)}`,
        amount: Number(item.grandTotal ?? 0),
        positive: false,
        route: '/(app)/(tabs)/expenses',
        sort: item.purchaseDate || '',
      })),
      ...(partyTxQuery.data ?? []).map((item) => ({
        id: `tx-${item.id}`,
        kind: item.direction === 'receive' ? t('home.income') : t('common.paid'),
        icon: (item.direction === 'receive' ? 'arrow-down-bold-circle-outline' : 'arrow-up-bold-circle-outline') as Shortcut['icon'],
        title: moneyCategoryFromNote(item.note) || (item.direction === 'receive' ? t('home.income') : t('common.paid')),
        subtitle: `${prettyDate(item.txDate)}  ·  ${moneyPersonLabel(partyById.get(item.partyId) ?? null)}`,
        amount: Number(item.amount ?? 0),
        positive: item.direction === 'receive',
        route: '/(app)/(tabs)/expenses',
        sort: item.txDate || '',
      })),
    ];
    return list.sort((a, b) => b.sort.localeCompare(a.sort)).slice(0, 6);
  }, [expensesQuery.data, partyById, partyTxQuery.data, t]);

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
      {
        key: 'shares',
        label: t('home.stocks'),
        icon: 'chart-areaspline',
        segment: 'shares',
        onPress: () => router.push('/(app)/shares'),
      },
    ] satisfies Shortcut[]
  ).filter((item) => canAccessSegment(accessContext, item.segment));

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await Promise.all([expensesQuery.refetch(), partyTxQuery.refetch(), partiesQuery.refetch()]);
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
          <Pressable style={styles.profile} onPress={() => router.push('/(app)/(tabs)/more')}>
            <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
              <Text style={[styles.avatarText, { color: colors.onPrimary }]}>{initials(user?.name)}</Text>
            </View>
            <View style={styles.profileCopy}>
              <Text style={[styles.hello, { color: colors.text }]}>{t('home.hiGreeting', { name: greetingName })}</Text>
              <Text numberOfLines={1} style={[styles.workspace, { color: colors.textMuted }]}>
                {workspaceName}
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
          saveGoal={saveGoal}
          currency={currency}
          hideAmounts={!balanceVisible}
          onPressToday={() => openLog('expense')}
          onPressMonth={() => setGoalVisible(true)}
          onPressOwed={() => router.push('/(app)/(tabs)/parties')}
        />

        <PersonalShareWidget hideAmounts={!balanceVisible} />

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
              <View style={styles.empty}>
                <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('home.noActivityYet')}</Text>
                <Text style={[styles.emptyCopy, { color: colors.textMuted }]}>
                  {t('home.noActivityHint')}
                </Text>
              </View>
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
