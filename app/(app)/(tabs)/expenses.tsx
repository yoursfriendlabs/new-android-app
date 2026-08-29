import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { purchasesApi } from '@/src/api';
import { ExpenseFormSheet } from '@/src/features/money/components/ExpenseFormSheet';
import { PersonalMoneyScreen } from '@/src/features/money/components/PersonalMoneyScreen';
import { isPersonalWorkspace } from '@/src/shared/lib/business';
import { BottomSheet } from '@/src/shared/feedback/BottomSheet';
import { FormField } from '@/src/shared/forms/FormField';
import { PaymentMethodSelector } from '@/src/shared/forms/PaymentMethodSelector';
import { Screen } from '@/src/shared/layout/Screen';
import { SearchField } from '@/src/shared/ui/SearchField';
import { SegmentedTabs } from '@/src/shared/ui/SegmentedTabs';
import { SurfaceCard } from '@/src/shared/ui/SurfaceCard';
import { StickyActionBar } from '@/src/shared/ui/StickyActionBar';
import {
  expenseCategory,
  expenseCategoryIcon,
  expenseDue,
  expenseTitle,
  isExpensePaid,
  isInCurrentMonth,
} from '@/src/features/money/lib/expense';
import { formatCurrency, prettyDate } from '@/src/shared/lib/format';
import { partyInitials } from '@/src/features/parties/lib/party';
import { buildExpenseReportHtml, shareHtmlAsPdf } from '@/src/shared/lib/report-pdf';
import { useBanks, usePurchaseById, usePurchases } from '@/src/shared/hooks/useAppQueries';
import { useDebouncedValue } from '@/src/shared/hooks/useDebouncedValue';
import { radius, shadows, spacing, typography } from '@/src/theme';
import type { Purchase } from '@/src/types/models';
import { useAuthStore } from '@/src/stores/auth-store';
import { usePalette } from '@/src/stores/theme-store';
import { useThemedStyles } from '@/src/theme/use-themed-styles';
import type { AppPalette } from '@/src/theme/app-palette';

type PeriodFilter = 'month' | 'all';
type DueFilter = 'all' | 'due' | 'paid';

const CHART_TONES = ['primary', 'info', 'warning', 'purple', 'success'] as const;

export default function ExpensesScreen() {
  const businessProfile = useAuthStore((state) => state.businessProfile);
  if (
    isPersonalWorkspace({
      businessType: String(businessProfile?.businessType ?? businessProfile?.type ?? ''),
    })
  ) {
    return <PersonalMoneyScreen />;
  }
  return <ShopExpensesScreen />;
}

function ShopExpensesScreen() {
  const colors = usePalette();
  const styles = useThemedStyles(createStyles);
  const queryClient = useQueryClient();
  const currency = useAuthStore((state) => state.businessProfile?.currencyCode) || 'NPR';
  const businessName = useAuthStore((state) => state.businessProfile?.businessName) || 'PasalManager';
  const expensesQuery = usePurchases('expense');
  const { data: banks } = useBanks();
  const activeBanks = useMemo(() => (banks ?? []).filter((bank) => bank.isActive), [banks]);
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState<PeriodFilter>('month');
  const [dueFilter, setDueFilter] = useState<DueFilter>('all');
  const [createVisible, setCreateVisible] = useState(false);
  const [selectedExpenseId, setSelectedExpenseId] = useState<string | null>(null);
  const [amountPaidDraft, setAmountPaidDraft] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank'>('cash');
  const [bankId, setBankId] = useState('');
  const [exporting, setExporting] = useState(false);
  const { data: expenseDetail } = usePurchaseById(selectedExpenseId ?? undefined);
  const debouncedSearch = useDebouncedValue(search);
  const expenses = expensesQuery.data ?? [];

  const periodExpenses = useMemo(() => {
    return expenses.filter((item) => (period === 'all' ? true : isInCurrentMonth(item.purchaseDate)));
  }, [expenses, period]);

  const visibleExpenses = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    return periodExpenses.filter((item) => {
      if (dueFilter === 'due' && isExpensePaid(item)) return false;
      if (dueFilter === 'paid' && !isExpensePaid(item)) return false;
      if (!query) return true;
      return [expenseTitle(item), expenseCategory(item), item.partyName, item.invoiceNo, item.notes]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [debouncedSearch, dueFilter, periodExpenses]);

  const totals = useMemo(() => {
    return periodExpenses.reduce(
      (acc, item) => {
        acc.total += Number(item.grandTotal || 0);
        acc.paid += Number(item.amountReceived || 0);
        acc.due += expenseDue(item);
        return acc;
      },
      { total: 0, paid: 0, due: 0 },
    );
  }, [periodExpenses]);

  const breakdown = useMemo(() => {
    const totalsByCategory: Record<string, number> = {};
    periodExpenses.forEach((item) => {
      const name = expenseCategory(item);
      totalsByCategory[name] = (totalsByCategory[name] || 0) + Number(item.grandTotal || 0);
    });
    return Object.entries(totalsByCategory)
      .map(([name, total]) => ({
        name,
        total,
        share: totals.total > 0 ? total / totals.total : 0,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [periodExpenses, totals.total]);

  function openExpense(item: Purchase) {
    setSelectedExpenseId(item.id);
    setAmountPaidDraft(String(item.amountReceived ?? 0));
    setPaymentMethod((item.paymentMethod as 'cash' | 'bank') ?? 'cash');
    setBankId(item.bankId ?? '');
  }

  async function saveExpenseUpdate() {
    if (!selectedExpenseId) return;
    try {
      await purchasesApi.update(selectedExpenseId, {
        amountReceived: Number(amountPaidDraft || 0),
        paymentMethod,
        bankId: paymentMethod === 'bank' ? bankId || undefined : undefined,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['purchases'] }),
        queryClient.invalidateQueries({ queryKey: ['purchase', selectedExpenseId] }),
        queryClient.invalidateQueries({ queryKey: ['recent-purchases'] }),
      ]);
      setSelectedExpenseId(null);
    } catch (error) {
      Alert.alert('Unable to update', error instanceof Error ? error.message : 'Please try again.');
    }
  }

  function confirmRemoveExpense() {
    Alert.alert('Delete this expense?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void removeExpense() },
    ]);
  }

  async function removeExpense() {
    if (!selectedExpenseId) return;
    try {
      await purchasesApi.remove(selectedExpenseId);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['purchases'] }),
        queryClient.invalidateQueries({ queryKey: ['recent-purchases'] }),
      ]);
      setSelectedExpenseId(null);
    } catch (error) {
      Alert.alert('Unable to delete', error instanceof Error ? error.message : 'Please try again.');
    }
  }

  const selectedDue = expenseDetail ? expenseDue(expenseDetail) : 0;
  const selectedPaid = expenseDetail ? isExpensePaid(expenseDetail) : false;
  const chartColors: Record<(typeof CHART_TONES)[number], string> = {
    primary: colors.primary,
    info: colors.info,
    warning: colors.warning,
    purple: colors.purple,
    success: colors.success,
  };

  async function handleShareReport() {
    try {
      setExporting(true);
      const visibleTotals = visibleExpenses.reduce(
        (acc, item) => {
          acc.total += Number(item.grandTotal || 0);
          acc.due += expenseDue(item);
          return acc;
        },
        { total: 0, due: 0 },
      );
      await shareHtmlAsPdf(
        buildExpenseReportHtml({
          businessName,
          currency,
          periodLabel: period === 'month' ? 'This month' : 'All time',
          items: visibleExpenses,
          total: visibleTotals.total,
          due: visibleTotals.due,
          title: 'Expense report',
          itemLabel: expenseTitle,
        }),
        'Share expense report',
      );
    } catch (error) {
      Alert.alert('Unable to share', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <Screen
      scrollable={false}
      padded={false}
      topBarTitle="Expenses"
      topBarRight={
        <View style={styles.headerActions}>
          <Pressable onPress={() => void handleShareReport()} hitSlop={8} style={styles.headerIcon} disabled={exporting}>
            {exporting ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <MaterialCommunityIcons color={colors.text} name="share-variant-outline" size={22} />
            )}
          </Pressable>
          <Pressable
            onPress={() => router.push('/(app)/expense-categories')}
            hitSlop={8}
            style={styles.headerIcon}>
            <MaterialCommunityIcons color={colors.text} name="shape-outline" size={22} />
          </Pressable>
        </View>
      }
      footer={<StickyActionBar primary={{ label: 'New expense', onPress: () => setCreateVisible(true) }} />}>
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={expensesQuery.isRefetching} onRefresh={() => void expensesQuery.refetch()} />
        }
        contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Track shop spending by category, with paid vs still due at a glance.
          </Text>
        </View>

        <SegmentedTabs
          value={period}
          onChange={setPeriod}
          options={[
            { label: 'This month', value: 'month' },
            { label: 'All time', value: 'all' },
          ]}
        />

        <View style={[styles.heroCard, { backgroundColor: colors.primary }]}>
          <Text style={styles.heroKicker}>{period === 'month' ? 'This month' : 'All spending'}</Text>
          <Text style={[styles.heroValue, { color: colors.white }]}>{formatCurrency(totals.total, currency)}</Text>
          <View style={styles.heroMetaRow}>
            <View style={styles.heroMetaChip}>
              <Text style={styles.heroMetaLabel}>Paid {formatCurrency(totals.paid, currency)}</Text>
            </View>
            <View style={styles.heroMetaChip}>
              <Text style={styles.heroMetaLabel}>Due {formatCurrency(totals.due, currency)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { backgroundColor: colors.successSoft, borderColor: colors.border }]}>
            <Text style={[styles.summaryLabel, { color: colors.success }]}>Paid</Text>
            <Text style={[styles.summaryValue, { color: colors.success }]}>{formatCurrency(totals.paid, currency)}</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: colors.dangerSoft, borderColor: colors.border }]}>
            <Text style={[styles.summaryLabel, { color: colors.danger }]}>Still due</Text>
            <Text style={[styles.summaryValue, { color: colors.danger }]}>{formatCurrency(totals.due, currency)}</Text>
          </View>
        </View>

        {breakdown.length ? (
          <View style={[styles.chartCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.chartTitle, { color: colors.text }]}>By category</Text>
            <View style={styles.chartList}>
              {breakdown.map((item, index) => {
                const tone = CHART_TONES[index % CHART_TONES.length];
                const percentage = Math.round(item.share * 100);
                return (
                  <View key={item.name} style={styles.chartRow}>
                    <View style={styles.chartRowHeader}>
                      <View style={styles.chartNameRow}>
                        <MaterialCommunityIcons
                          name={expenseCategoryIcon(item.name)}
                          size={16}
                          color={chartColors[tone]}
                        />
                        <Text style={[styles.chartCategoryName, { color: colors.text }]} numberOfLines={1}>
                          {item.name}
                        </Text>
                      </View>
                      <Text style={[styles.chartCategoryValue, { color: colors.textMuted }]}>
                        {formatCurrency(item.total, currency)} · {percentage}%
                      </Text>
                    </View>
                    <View style={[styles.progressBarBg, { backgroundColor: colors.surfaceMuted }]}>
                      <View
                        style={[
                          styles.progressBarFill,
                          {
                            width: `${Math.max(4, percentage)}%`,
                            backgroundColor: chartColors[tone],
                          },
                        ]}
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        <SearchField placeholder="Search category, person, or note" value={search} onChangeText={setSearch} />
        <SegmentedTabs
          value={dueFilter}
          onChange={setDueFilter}
          options={[
            { label: 'All', value: 'all' },
            { label: 'Due', value: 'due' },
            { label: 'Paid', value: 'paid' },
          ]}
        />

        {!expensesQuery.isLoading && !visibleExpenses.length ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.accentSoft }]}>
              <MaterialCommunityIcons name="wallet-plus-outline" size={28} color={colors.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {expenses.length ? 'No matching expenses' : 'No expenses yet'}
            </Text>
            <Text style={[styles.emptyCopy, { color: colors.textMuted }]}>
              {expenses.length
                ? 'Try a different search, period, or paid/due filter.'
                : 'Record rent, tea, fuel, and other shop spending in a few taps.'}
            </Text>
          </View>
        ) : null}

        <View style={styles.list}>
          {visibleExpenses.map((item) => {
            const due = expenseDue(item);
            const paid = due < 0.5;
            const category = expenseCategory(item);
            const title = expenseTitle(item);
            return (
              <Pressable
                key={item.id}
                onPress={() => openExpense(item)}
                style={({ pressed }) => [
                  styles.row,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                  pressed && styles.rowPressed,
                ]}>
                <View style={[styles.avatar, { backgroundColor: colors.dangerSoft }]}>
                  <MaterialCommunityIcons name={expenseCategoryIcon(category)} size={20} color={colors.danger} />
                </View>
                <View style={styles.rowCopy}>
                  <View style={styles.nameRow}>
                    <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
                      {title}
                    </Text>
                    <View style={[styles.badge, { backgroundColor: paid ? colors.successSoft : colors.dangerSoft }]}>
                      <Text style={[styles.badgeText, { color: paid ? colors.success : colors.danger }]}>
                        {paid ? 'Paid' : 'Due'}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.rowMeta, { color: colors.textMuted }]} numberOfLines={1}>
                    {[
                      category !== title ? category : null,
                      prettyDate(item.purchaseDate),
                      item.paymentMethod === 'bank' ? 'Bank' : 'Cash',
                    ]
                      .filter(Boolean)
                      .join('  ·  ')}
                  </Text>
                </View>
                <View style={styles.amountWrap}>
                  <Text style={[styles.amount, { color: paid ? colors.text : colors.danger }]}>
                    {formatCurrency(paid ? item.grandTotal : due, currency)}
                  </Text>
                  <Text style={[styles.rowMeta, { color: colors.textSoft }]}>{paid ? 'Spent' : 'To pay'}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <ExpenseFormSheet visible={createVisible} onClose={() => setCreateVisible(false)} />

      <BottomSheet
        visible={Boolean(selectedExpenseId)}
        title={expenseDetail ? expenseTitle(expenseDetail) : 'Expense details'}
        subtitle={
          expenseDetail
            ? `${expenseCategory(expenseDetail)} · ${prettyDate(expenseDetail.purchaseDate)}`
            : 'Update payment or remove this entry.'
        }
        onClose={() => setSelectedExpenseId(null)}
        fullHeight
        footer={
          <View style={styles.footerActions}>
            <Pressable style={styles.secondaryButton} onPress={confirmRemoveExpense}>
              <Text style={styles.secondaryLabel}>Delete</Text>
            </Pressable>
            <Pressable style={styles.primaryButton} onPress={() => void saveExpenseUpdate()}>
              <Text style={styles.primaryLabel}>Save update</Text>
            </Pressable>
          </View>
        }>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetContent}>
          <SurfaceCard
            title="Summary"
            subtitle={expenseDetail?.notes || 'No note added.'}>
            <Text style={styles.helperText}>
              Total {formatCurrency(Number(expenseDetail?.grandTotal ?? 0), currency)}
              {'  ·  '}
              Paid {formatCurrency(Number(expenseDetail?.amountReceived ?? 0), currency)}
              {'  ·  '}
              Due {formatCurrency(selectedDue, currency)}
            </Text>
            {expenseDetail?.partyName ? (
              <View style={styles.partyLine}>
                <View style={[styles.miniAvatar, { backgroundColor: colors.primary }]}>
                  <Text style={styles.miniAvatarText}>{partyInitials(expenseDetail.partyName)}</Text>
                </View>
                <Text style={styles.helperText}>Paid to {expenseDetail.partyName}</Text>
              </View>
            ) : null}
            <View
              style={[
                styles.statusPill,
                { backgroundColor: selectedPaid ? colors.successSoft : colors.dangerSoft },
              ]}>
              <Text style={{ color: selectedPaid ? colors.success : colors.danger, fontWeight: '800' }}>
                {selectedPaid ? 'Paid in full' : 'Outstanding'}
              </Text>
            </View>
          </SurfaceCard>
          <FormField label="Amount paid" value={amountPaidDraft} onChangeText={setAmountPaidDraft} keyboardType="numeric" />
          <PaymentMethodSelector value={paymentMethod} onChange={setPaymentMethod} />
          {paymentMethod === 'bank' ? (
            <View style={styles.bankWrap}>
              {activeBanks.length > 0 ? (
                activeBanks.map((bank) => (
                  <Pressable
                    key={bank.id}
                    style={[styles.bankChip, bankId === bank.id && styles.bankChipActive]}
                    onPress={() => setBankId(bank.id)}>
                    <Text style={[styles.bankChipLabel, bankId === bank.id && styles.bankChipLabelActive]}>
                      {bank.name}
                    </Text>
                  </Pressable>
                ))
              ) : (
                <Pressable style={styles.emptyBankInfo} onPress={() => router.push('/(app)/banks')}>
                  <MaterialCommunityIcons name="bank-plus" size={24} color={colors.textMuted} />
                  <Text style={styles.emptyBankText}>No active banks found. Tap to add one in settings.</Text>
                </Pressable>
              )}
            </View>
          ) : null}
        </ScrollView>
      </BottomSheet>
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
    headerIcon: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    hero: {
      gap: spacing.xs,
    },
    title: {
      fontSize: typography.hero,
      fontWeight: '800',
      letterSpacing: -0.4,
    },
    subtitle: {
      fontSize: typography.body,
      lineHeight: 22,
    },
    heroCard: {
      borderRadius: radius.lg,
      padding: spacing.lg,
      gap: spacing.sm,
      ...shadows.card,
    },
    heroKicker: {
      color: 'rgba(255,255,255,0.78)',
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    heroValue: {
      fontSize: 32,
      fontWeight: '800',
    },
    heroMetaRow: {
      flexDirection: 'row',
      gap: spacing.xs,
    },
    heroMetaChip: {
      flex: 1,
      borderRadius: radius.pill,
      backgroundColor: 'rgba(255,255,255,0.16)',
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      alignItems: 'center',
    },
    heroMetaLabel: {
      color: '#ffffff',
      fontSize: typography.caption,
      fontWeight: '700',
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
    chartCard: {
      borderRadius: radius.lg,
      borderWidth: 1,
      padding: spacing.md,
      gap: spacing.md,
    },
    chartTitle: {
      fontSize: typography.body,
      fontWeight: '800',
    },
    chartList: {
      gap: spacing.md,
    },
    chartRow: {
      gap: spacing.xxs,
    },
    chartRowHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: spacing.sm,
    },
    chartNameRow: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    chartCategoryName: {
      flex: 1,
      fontSize: typography.body,
      fontWeight: '600',
    },
    chartCategoryValue: {
      fontSize: typography.caption,
      fontWeight: '700',
    },
    progressBarBg: {
      height: 8,
      borderRadius: 4,
      overflow: 'hidden',
    },
    progressBarFill: {
      height: '100%',
      borderRadius: 4,
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
    rowPressed: {
      opacity: 0.92,
      transform: [{ scale: 0.995 }],
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowCopy: {
      flex: 1,
      gap: 3,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    rowTitle: {
      flexShrink: 1,
      fontSize: typography.body,
      fontWeight: '700',
    },
    rowMeta: {
      fontSize: typography.label,
    },
    badge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radius.pill,
    },
    badgeText: {
      fontSize: 10,
      fontWeight: '800',
    },
    amountWrap: {
      alignItems: 'flex-end',
      gap: 2,
    },
    amount: {
      fontSize: typography.body,
      fontWeight: '800',
    },
    emptyCard: {
      alignItems: 'center',
      borderRadius: radius.lg,
      borderWidth: 1,
      padding: spacing.xl,
      gap: spacing.sm,
    },
    emptyIcon: {
      width: 56,
      height: 56,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyTitle: {
      fontSize: typography.subheading,
      fontWeight: '800',
    },
    emptyCopy: {
      fontSize: typography.body,
      textAlign: 'center',
      lineHeight: 22,
    },
    footerActions: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    secondaryButton: {
      flex: 1,
      minHeight: 50,
      borderRadius: radius.md,
      backgroundColor: colors.dangerSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondaryLabel: {
      color: colors.danger,
      fontSize: typography.body,
      fontWeight: '800',
    },
    primaryButton: {
      flex: 1,
      minHeight: 50,
      borderRadius: radius.md,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryLabel: {
      color: colors.white,
      fontSize: typography.body,
      fontWeight: '800',
    },
    sheetContent: {
      gap: spacing.md,
      paddingBottom: spacing.xl,
    },
    helperText: {
      fontSize: typography.body,
      color: colors.textMuted,
      lineHeight: 22,
    },
    partyLine: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    miniAvatar: {
      width: 28,
      height: 28,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    miniAvatarText: {
      color: colors.white,
      fontSize: 11,
      fontWeight: '800',
    },
    statusPill: {
      alignSelf: 'flex-start',
      marginTop: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radius.pill,
    },
    bankWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    bankChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.pill,
      backgroundColor: colors.backgroundAlt,
    },
    bankChipActive: {
      backgroundColor: colors.primary,
    },
    bankChipLabel: {
      color: colors.text,
      fontWeight: '700',
    },
    bankChipLabelActive: {
      color: colors.white,
    },
    emptyBankInfo: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      padding: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.border,
      backgroundColor: colors.backgroundAlt,
    },
    emptyBankText: {
      flex: 1,
      fontSize: typography.body,
      color: colors.textMuted,
      fontWeight: '500',
    },
  });
