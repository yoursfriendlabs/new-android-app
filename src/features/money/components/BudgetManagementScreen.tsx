import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { budgetsApi } from '@/src/api';
import { isInvalidSessionError } from '@/src/api/client';
import { BottomSheet } from '@/src/shared/feedback/BottomSheet';
import { useConfirm } from '@/src/shared/feedback/ConfirmProvider';
import { useToast } from '@/src/shared/feedback/ToastProvider';
import { FormField } from '@/src/shared/forms/FormField';
import { Screen } from '@/src/shared/layout/Screen';
import { formatCurrency } from '@/src/shared/lib/format';
import { workspaceAccessMessage } from '@/src/shared/lib/workspace';
import { withWorkspaceRetry } from '@/src/shared/lib/workspace-retry';
import { useBudgets, useQuickExpenses } from '@/src/shared/hooks/useAppQueries';
import { PageHeading } from '@/src/shared/ui/PageHeading';
import { SegmentedTabs } from '@/src/shared/ui/SegmentedTabs';
import { useAuthStore } from '@/src/stores/auth-store';
import { usePalette } from '@/src/stores/theme-store';
import { radius, spacing, typography } from '@/src/theme';
import type { AppPalette } from '@/src/theme/app-palette';
import { useThemedStyles } from '@/src/theme/use-themed-styles';
import type { Budget, BudgetPeriod, BudgetScope } from '@/src/types/models';

const PERIOD_OPTIONS: Array<{ value: BudgetPeriod; label: string }> = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];

function emptyBudgetForm() {
  return {
    name: '',
    scope: 'category' as BudgetScope,
    categoryName: '',
    amount: '',
    period: 'monthly' as BudgetPeriod,
  };
}

function budgetForm(budget?: Budget | null) {
  if (!budget) return emptyBudgetForm();
  return {
    name: budget.name,
    scope: budget.scope,
    categoryName: budget.categoryName || '',
    amount: String(budget.amount || ''),
    period: budget.period,
  };
}

function toneFor(budget: Budget, colors: AppPalette) {
  if (budget.status === 'over') return { color: colors.danger, soft: colors.dangerSoft, label: 'Over budget' };
  if (budget.status === 'warning') return { color: colors.warning, soft: colors.warningSoft, label: 'Nearly used' };
  if (budget.projectedStatus === 'over') return { color: colors.warning, soft: colors.warningSoft, label: 'Pacing over' };
  return { color: colors.success, soft: colors.successSoft, label: 'On track' };
}

function progressWidth(percent = 0) {
  return `${Math.min(Math.max(percent, 0), 100)}%` as const;
}

export function BudgetManagementScreen() {
  const colors = usePalette();
  const styles = useThemedStyles(createStyles);
  const toast = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const businessProfile = useAuthStore((state) => state.businessProfile);
  const currency = businessProfile?.currencyCode || 'NPR';
  const budgetsQuery = useBudgets({ isActive: true });
  const categoriesQuery = useQuickExpenses('', 'expense');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Budget | null>(null);
  const [form, setForm] = useState(emptyBudgetForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const categories = useMemo(
    () => Array.from(new Set((categoriesQuery.data ?? []).map((category) => category.name.trim()).filter(Boolean))).sort(),
    [categoriesQuery.data],
  );
  const budgets = budgetsQuery.data?.items ?? [];
  const summary = budgetsQuery.data?.summary;

  useEffect(() => {
    if (!sheetOpen) return;
    setForm(budgetForm(editing));
    setFormError('');
  }, [editing, sheetOpen]);

  const openCreate = () => {
    setEditing(null);
    setSheetOpen(true);
  };

  const openEdit = (budget: Budget) => {
    setEditing(budget);
    setSheetOpen(true);
  };

  const invalidate = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['budgets'] }),
    queryClient.invalidateQueries({ queryKey: ['budget-summary'] }),
  ]);

  async function saveBudget() {
    const amount = Number(form.amount);
    const categoryName = form.categoryName.trim();
    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError('Enter a budget amount greater than zero.');
      return;
    }
    if (form.scope === 'category' && !categoryName) {
      setFormError('Choose the expense category this budget covers.');
      return;
    }

    const name = form.name.trim() || (form.scope === 'total' ? 'Overall spending' : `${categoryName} spending`);
    const payload = {
      name,
      scope: form.scope,
      amount,
      period: form.period,
      categoryName: form.scope === 'category' ? categoryName : null,
      categoryKey: form.scope === 'category' ? categoryName.toLowerCase() : null,
    };

    setSaving(true);
    setFormError('');
    try {
      if (editing?.id) {
        await withWorkspaceRetry(() => budgetsApi.update(editing.id, payload));
        toast.success('Budget updated.');
      } else {
        await withWorkspaceRetry(() => budgetsApi.create(payload));
        toast.success('Budget created.');
      }
      await invalidate();
      setSheetOpen(false);
    } catch (error) {
      if (isInvalidSessionError(error)) return;
      setFormError(workspaceAccessMessage(error, 'Unable to save this budget.'));
    } finally {
      setSaving(false);
    }
  }

  async function deleteBudget() {
    if (!editing?.id) return;
    const accepted = await confirm({
      title: 'Delete budget',
      message: `Remove the ${editing.name} budget? Its past spending stays in your records.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!accepted) return;

    setSaving(true);
    try {
      await budgetsApi.remove(editing.id);
      await invalidate();
      setSheetOpen(false);
      toast.success('Budget deleted.');
    } catch (error) {
      if (isInvalidSessionError(error)) return;
      setFormError(workspaceAccessMessage(error, 'Unable to delete this budget.'));
    } finally {
      setSaving(false);
    }
  }

  const refreshing = budgetsQuery.isRefetching || categoriesQuery.isRefetching;

  return (
    <Screen scrollable={false} padded={false} topBarTitle="Budgets" topBarLeading="back">
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void Promise.all([budgetsQuery.refetch(), categoriesQuery.refetch()])} />}>
        <PageHeading title="Budgets" subtitle="Set spending limits and spot trouble before the month ends." />

        {summary?.budgetCount ? (
          <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.summaryTop}>
              <View>
                <Text style={[styles.summaryKicker, { color: colors.textMuted }]}>CURRENT CAPS</Text>
                <Text style={[styles.summaryValue, { color: colors.text }]}>{formatCurrency(summary.totalRemaining, currency)} left</Text>
              </View>
              <View style={[styles.summaryBadge, { backgroundColor: summary.overCount ? colors.dangerSoft : colors.successSoft }]}>
                <Text style={[styles.summaryBadgeText, { color: summary.overCount ? colors.danger : colors.success }]}>
                  {summary.overCount ? `${summary.overCount} over` : 'On track'}
                </Text>
              </View>
            </View>
            <View style={[styles.progressTrack, { backgroundColor: colors.backgroundAlt }]}>
              <View style={[styles.progressFill, { width: progressWidth(summary.percentUsed), backgroundColor: summary.overCount ? colors.danger : colors.primary }]} />
            </View>
            <Text style={[styles.summaryHint, { color: colors.textMuted }]}>
              {formatCurrency(summary.totalSpent, currency)} of {formatCurrency(summary.totalBudgeted, currency)} planned · {Math.round(summary.percentUsed)}% used
            </Text>
          </View>
        ) : null}

        <View style={styles.listHeader}>
          <View>
            <Text style={[styles.sectionKicker, { color: colors.primary }]}>SPENDING PLAN</Text>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Active budgets</Text>
          </View>
          <Pressable style={[styles.addButton, { backgroundColor: colors.primary }]} onPress={openCreate}>
            <MaterialCommunityIcons name="plus" size={18} color={colors.onPrimary} />
            <Text style={[styles.addButtonText, { color: colors.onPrimary }]}>Add</Text>
          </Pressable>
        </View>

        {budgetsQuery.isLoading ? (
          <View style={styles.loading}><ActivityIndicator color={colors.primary} /></View>
        ) : budgets.length ? budgets.map((budget) => {
          const tone = toneFor(budget, colors);
          const spent = budget.spent ?? 0;
          const remaining = budget.remaining ?? budget.amount - spent;
          return (
            <Pressable
              key={budget.id}
              onPress={() => openEdit(budget)}
              style={({ pressed }) => [styles.budgetCard, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && { opacity: 0.78 }]}>
              <View style={styles.budgetTop}>
                <View style={[styles.iconBox, { backgroundColor: tone.soft }]}>
                  <MaterialCommunityIcons name={budget.scope === 'total' ? 'wallet-outline' : 'shape-outline'} size={21} color={tone.color} />
                </View>
                <View style={styles.budgetTitleWrap}>
                  <Text numberOfLines={1} style={[styles.budgetName, { color: colors.text }]}>{budget.name}</Text>
                  <Text numberOfLines={1} style={[styles.budgetMeta, { color: colors.textMuted }]}>{budget.periodLabel || budget.period} · {budget.scope === 'total' ? 'All spending' : budget.categoryName}</Text>
                </View>
                <View style={[styles.statusPill, { backgroundColor: tone.soft }]}>
                  <Text style={[styles.statusText, { color: tone.color }]}>{tone.label}</Text>
                </View>
              </View>
              <View style={styles.amountRow}>
                <Text style={[styles.spentText, { color: colors.text }]}>{formatCurrency(spent, currency)} spent</Text>
                <Text style={[styles.remainingText, { color: tone.color }]}>{remaining >= 0 ? `${formatCurrency(remaining, currency)} left` : `${formatCurrency(Math.abs(remaining), currency)} over`}</Text>
              </View>
              <View style={[styles.progressTrack, { backgroundColor: colors.backgroundAlt }]}>
                <View style={[styles.progressFill, { width: progressWidth(budget.percentUsed), backgroundColor: tone.color }]} />
              </View>
              <View style={styles.budgetFooter}>
                <Text style={[styles.budgetHint, { color: colors.textMuted }]}>{Math.round(budget.percentUsed ?? 0)}% of {formatCurrency(budget.amount, currency)}</Text>
                {budget.projectedStatus === 'over' ? <Text style={[styles.budgetHint, { color: colors.warning }]}>At this pace: {formatCurrency(budget.projectedSpend ?? 0, currency)}</Text> : <Text style={[styles.budgetHint, { color: colors.textMuted }]}>{budget.daysLeft ?? 0} days left</Text>}
              </View>
            </Pressable>
          );
        }) : (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.accentSoft }]}><MaterialCommunityIcons name="target" size={28} color={colors.primary} /></View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Give every rupee a limit</Text>
            <Text style={[styles.emptyCopy, { color: colors.textMuted }]}>Start with a monthly total or the category you want to keep closest to hand.</Text>
            <Pressable style={[styles.emptyButton, { backgroundColor: colors.primary }]} onPress={openCreate}><Text style={[styles.emptyButtonText, { color: colors.onPrimary }]}>Set your first budget</Text></Pressable>
          </View>
        )}
      </ScrollView>

      <BottomSheet
        visible={sheetOpen}
        title={editing ? 'Edit budget' : 'New budget'}
        subtitle="Actual spending is counted automatically from your expenses."
        onClose={() => setSheetOpen(false)}
        fullHeight
        footer={<View style={styles.sheetFooter}>
          {editing ? <Pressable disabled={saving} style={[styles.deleteButton, { backgroundColor: colors.dangerSoft }]} onPress={() => void deleteBudget()}><Text style={[styles.deleteButtonText, { color: colors.danger }]}>Delete</Text></Pressable> : null}
          <Pressable disabled={saving} style={[styles.saveButton, { backgroundColor: colors.primary }]} onPress={() => void saveBudget()}><Text style={[styles.saveButtonText, { color: colors.onPrimary }]}>{saving ? 'Saving…' : editing ? 'Save budget' : 'Create budget'}</Text></Pressable>
        </View>}>
        <View style={styles.form}>
          {formError ? <Text style={[styles.formError, { color: colors.danger }]}>{formError}</Text> : null}
          <SegmentedTabs value={form.scope} onChange={(scope) => setForm((current) => ({ ...current, scope, categoryName: scope === 'total' ? '' : current.categoryName }))} options={[{ label: 'Category', value: 'category' }, { label: 'Overall', value: 'total' }]} />
          {form.scope === 'category' ? <View style={styles.categoryBlock}>
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>EXPENSE CATEGORY</Text>
            <View style={styles.categoryChips}>
              {categories.map((category) => {
                const selected = form.categoryName === category;
                return <Pressable key={category} onPress={() => setForm((current) => ({ ...current, categoryName: category }))} style={[styles.categoryChip, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.accentSoft : colors.backgroundAlt }]}><Text style={[styles.categoryChipText, { color: selected ? colors.primary : colors.text }]}>{category}</Text></Pressable>;
              })}
            </View>
            {!categories.length ? <Text style={[styles.categoryEmpty, { color: colors.textMuted }]}>Add an expense category first, then come back to set its limit.</Text> : null}
          </View> : null}
          <SegmentedTabs value={form.period} onChange={(period) => setForm((current) => ({ ...current, period }))} options={PERIOD_OPTIONS} />
          <FormField label="Budget amount" value={form.amount} onChangeText={(amount) => setForm((current) => ({ ...current, amount }))} placeholder="0" keyboardType="decimal-pad" icon="cash" />
          <FormField label="Name (optional)" value={form.name} onChangeText={(name) => setForm((current) => ({ ...current, name }))} placeholder={form.scope === 'total' ? 'Overall spending' : 'For example, Food spending'} maxLength={80} />
        </View>
      </BottomSheet>
    </Screen>
  );
}

const createStyles = (_colors: AppPalette) => StyleSheet.create({
  scroll: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  summaryCard: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  summaryTop: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm, alignItems: 'center' },
  summaryKicker: { fontSize: 11, letterSpacing: 0.7, fontWeight: '800' },
  summaryValue: { fontSize: typography.subheading, fontWeight: '800', marginTop: 2 },
  summaryBadge: { paddingHorizontal: spacing.sm, paddingVertical: 5, borderRadius: radius.pill },
  summaryBadgeText: { fontSize: typography.caption, fontWeight: '800' },
  progressTrack: { height: 8, borderRadius: radius.pill, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: radius.pill },
  summaryHint: { fontSize: typography.caption, lineHeight: 18 },
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  sectionKicker: { fontSize: 11, letterSpacing: 0.7, fontWeight: '800' },
  sectionTitle: { fontSize: typography.subheading, fontWeight: '800', marginTop: 2 },
  addButton: { flexDirection: 'row', gap: 3, alignItems: 'center', borderRadius: radius.pill, paddingVertical: 8, paddingHorizontal: spacing.sm },
  addButtonText: { fontSize: typography.caption, fontWeight: '800' },
  loading: { minHeight: 140, justifyContent: 'center' },
  budgetCard: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  budgetTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconBox: { width: 42, height: 42, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  budgetTitleWrap: { flex: 1, gap: 2 },
  budgetName: { fontSize: typography.body, fontWeight: '800' },
  budgetMeta: { fontSize: typography.caption },
  statusPill: { paddingHorizontal: 7, paddingVertical: 4, borderRadius: radius.pill },
  statusText: { fontSize: 10, fontWeight: '800' },
  amountRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  spentText: { fontSize: typography.caption, fontWeight: '700' },
  remainingText: { fontSize: typography.caption, fontWeight: '800', textAlign: 'right' },
  budgetFooter: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  budgetHint: { fontSize: 11, flex: 1 },
  emptyCard: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.xl, gap: spacing.sm, alignItems: 'center' },
  emptyIcon: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: typography.subheading, fontWeight: '800', textAlign: 'center' },
  emptyCopy: { fontSize: typography.caption, lineHeight: 19, textAlign: 'center', maxWidth: 290 },
  emptyButton: { borderRadius: radius.pill, paddingVertical: 11, paddingHorizontal: spacing.lg, marginTop: spacing.xs },
  emptyButtonText: { fontSize: typography.caption, fontWeight: '800' },
  sheetFooter: { flexDirection: 'row', gap: spacing.sm },
  deleteButton: { minHeight: 48, paddingHorizontal: spacing.md, borderRadius: radius.md, justifyContent: 'center', alignItems: 'center' },
  deleteButtonText: { fontSize: typography.body, fontWeight: '800' },
  saveButton: { flex: 1, minHeight: 48, borderRadius: radius.md, justifyContent: 'center', alignItems: 'center' },
  saveButtonText: { fontSize: typography.body, fontWeight: '800' },
  form: { gap: spacing.lg, paddingBottom: spacing.md },
  formError: { fontSize: typography.caption, fontWeight: '700' },
  categoryBlock: { gap: spacing.sm },
  fieldLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.7 },
  categoryChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  categoryChip: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 9 },
  categoryChipText: { fontSize: typography.caption, fontWeight: '700' },
  categoryEmpty: { fontSize: typography.caption, lineHeight: 18 },
});
