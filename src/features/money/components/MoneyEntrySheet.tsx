import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { isInvalidSessionError } from '@/src/api/client';
import { quickExpensesApi } from '@/src/api';
import { Avatar } from '@/src/shared/ui/Avatar';
import { BottomSheet } from '@/src/shared/feedback/BottomSheet';
import { useToast } from '@/src/shared/feedback/ToastProvider';
import { FormField } from '@/src/shared/forms/FormField';
import { DatePickerField } from '@/src/shared/forms/DatePickerField';
import { PaymentMethodSelector } from '@/src/shared/forms/PaymentMethodSelector';
import { submitWithOfflineQueue } from '@/src/data/sync';
import { expenseCategoryIcon } from '@/src/features/money/lib/expense';
import { WinMoment } from '@/src/features/habits/components/WinMoment';
import { COIN_REWARDS, moneyClaimId } from '@/src/features/habits/lib/coins';
import { formatCurrency, todayIso } from '@/src/shared/lib/format';
import {
  buildWinMoment,
  computeStreak,
  unlockedBadges,
  type HabitSnapshot,
  type HabitWin,
} from '@/src/features/habits/lib/habits';
import { useHabitStore } from '@/src/stores/habit-store';
import { buildMoneyPurchasePayload } from '@/src/features/money/lib/money';
import { workspaceAccessMessage, firstNonEmptyId } from '@/src/shared/lib/workspace';
import { withWorkspaceRetry } from '@/src/shared/lib/workspace-retry';
import { useBanks, useQuickExpenses } from '@/src/shared/hooks/useAppQueries';
import { useDebouncedValue } from '@/src/shared/hooks/useDebouncedValue';
import { getCategoryVisual } from '@/src/features/money/lib/category-visuals';
import { usePalette, useThemeMode } from '@/src/stores/theme-store';
import { radius, spacing, typography } from '@/src/theme';
import type { AppPalette } from '@/src/theme/app-palette';
import { useThemedStyles } from '@/src/theme/use-themed-styles';
import type { PaymentMethod } from '@/src/types/models';

export type MoneyEntryKind = 'income' | 'expense';
type PaidMode = 'full' | 'due';

const INCOME_CATEGORIES = ['Salary', 'Investments', 'Allowance', 'Bonus', 'Freelance', 'Family', 'Refund', 'Other'];
const PERSONAL_EXPENSE_CATEGORIES = ['Food', 'Shopping', 'Transport', 'Housing', 'Bills', 'Entertainment', 'Education', 'Health', 'Other'];

const MONEY_KIND_OPTIONS = [
  { value: 'expense' as const, label: 'Expense', icon: 'arrow-up-bold-circle-outline' as const },
  { value: 'income' as const, label: 'Income', icon: 'arrow-down-bold-circle-outline' as const },
];

interface MoneyEntrySheetProps {
  visible: boolean;
  kind: MoneyEntryKind;
  onClose: () => void;
  activityDates?: string[];
  snapshot?: Omit<HabitSnapshot, 'dates'>;
  compact?: boolean;
}

function emptyForm(kind: MoneyEntryKind) {
  return {
    kind,
    category: kind === 'income' ? 'Salary' : 'Food',
    amount: '',
    paidMode: 'full' as PaidMode,
    amountPaid: '',
    paymentMethod: 'cash' as PaymentMethod,
    bankId: '',
    notes: '',
    date: todayIso(),
  };
}

export function MoneyEntrySheet({
  activityDates = [],
  compact = false,
  kind,
  onClose,
  snapshot,
  visible,
}: MoneyEntrySheetProps) {
  const colors = usePalette();
  const toast = useToast();
  const mode = useThemeMode();
  const styles = useThemedStyles(createStyles);
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm(kind));
  const [customCategory, setCustomCategory] = useState('');
  const [saving, setSaving] = useState(false);
  const [win, setWin] = useState<HabitWin | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(!compact);
  const { data: expenseCategories } = useQuickExpenses('', 'expense');
  const { data: incomeCategories } = useQuickExpenses('', 'income');
  const { data: banks } = useBanks();
  const activeBanks = useMemo(() => (banks ?? []).filter((bank) => bank.isActive), [banks]);

  useEffect(() => {
    if (form.paymentMethod !== 'bank' || form.bankId || activeBanks.length !== 1) return;
    setForm((current) => ({ ...current, bankId: activeBanks[0].id }));
  }, [activeBanks, form.bankId, form.paymentMethod]);

  useEffect(() => {
    if (visible) {
      setForm(emptyForm(kind));
      setCustomCategory('');
      setSaving(false);
      setDetailsOpen(!compact);
    }
  }, [compact, kind, visible]);

  const amount = Number(form.amount || 0);
  const amountPaid = form.paidMode === 'full' ? amount : Number(form.amountPaid || 0);
  const isIncome = form.kind === 'income';
  const categoryOptions = isIncome
    ? Array.from(new Set([...(incomeCategories ?? []).map((item) => item.name), ...INCOME_CATEGORIES])).filter(Boolean)
    : Array.from(new Set([...(expenseCategories ?? []).map((item) => item.name), ...PERSONAL_EXPENSE_CATEGORIES])).filter(Boolean);

  const [receiptImage, setReceiptImage] = useState<string | null>(null);

  async function handlePickReceipt() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        quality: 0.7,
        allowsMultipleSelection: false,
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        setReceiptImage(result.assets[0].uri);
      }
    } catch {
      // ignore
    }
  }

  async function handleSave(andContinue = false) {
    const effectiveCategory =
      form.category === 'Other' && customCategory.trim()
        ? customCategory.trim()
        : form.category.trim() || 'Other';

    if (!effectiveCategory) {
      toast.error('Pick what this money is for.');
      return;
    }
    if (amount <= 0) {
      toast.error('Enter an amount greater than zero.');
      return;
    }
    if (form.paymentMethod === 'bank' && !form.bankId) {
      toast.error('Choose a bank account for this payment.');
      return;
    }
    if (!isIncome && (amountPaid < 0 || amountPaid > amount)) {
      toast.error('Amount paid cannot be more than the total.');
      return;
    }

    setSaving(true);
    try {
      let moneySourceId = '';
      const payload = buildMoneyPurchasePayload({
        kind: form.kind,
        category: effectiveCategory,
        amount,
        amountPaid: isIncome ? amount : amountPaid,
        date: form.date,
        notes: form.notes,
        paymentMethod: form.paymentMethod,
        bankId: form.bankId,
        attachment: receiptImage,
      });
      const queued = await withWorkspaceRetry(() =>
        submitWithOfflineQueue<{ id?: string }, typeof payload>({
          entityType: isIncome ? 'income' : 'expense',
          method: 'POST',
          path: '/api/purchases',
          body: payload,
        }),
      );
      moneySourceId = firstNonEmptyId(queued.data);
      if (form.category === 'Other' && customCategory.trim()) {
        try {
          await quickExpensesApi.create({ name: customCategory.trim(), kind: form.kind });
        } catch {
          // Duplicate or offline is fine; the money entry still saved.
        }
      }
      await queryClient.invalidateQueries({ queryKey: ['purchases'] });
      await queryClient.invalidateQueries({ queryKey: ['recent-purchases'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      await queryClient.invalidateQueries({ queryKey: ['quick-expenses'] });

      const storedDates = await useHabitStore.getState().recordLog(form.date);
      const previous = computeStreak(activityDates, form.date, useHabitStore.getState().bestStreak);
      const nextDates = [...activityDates, ...storedDates, form.date];
      const next = computeStreak(nextDates, form.date, previous.best);
      const nextSnapshot: HabitSnapshot = {
        dates: nextDates,
        entryCount: (snapshot?.entryCount ?? 0) + 1,
        incomeCount: (snapshot?.incomeCount ?? 0) + (isIncome ? 1 : 0),
        expenseCount: (snapshot?.expenseCount ?? 0) + (isIncome ? 0 : 1),
        savedThisMonth: (snapshot?.savedThisMonth ?? 0) + (isIncome ? amount : -amount),
      };
      const already = new Set(useHabitStore.getState().unlockedBadgeIds);
      const freshBadges = unlockedBadges(nextSnapshot, next).filter((badge) => !already.has(badge.id));
      await useHabitStore.getState().markBadges(freshBadges.map((badge) => badge.id));
      await useHabitStore.getState().noteBestStreak(next.best);
      const coins = await useHabitStore.getState().awardCoins(COIN_REWARDS.moneyLog, {
        claimId: moneyClaimId(moneySourceId),
        reason: 'money',
        label: isIncome ? 'Logged income' : 'Logged expense',
      });
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {
        // Haptics are optional on web and simulators.
      }

      if (andContinue) {
        setForm((current) => ({
          ...current,
          amount: '',
          notes: '',
        }));
        setReceiptImage(null);
      } else {
        setWin(
          buildWinMoment({
            kind: isIncome ? 'income' : 'expense',
            amountLabel: formatCurrency(amount),
            previous,
            next,
            newBadges: freshBadges,
            coins,
          }),
        );
        setForm(emptyForm(kind));
        setReceiptImage(null);
      }
    } catch (error) {
      if (isInvalidSessionError(error)) return;
      toast.error(workspaceAccessMessage(error, 'Please try again.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <BottomSheet
        visible={visible && !win}
        title={compact ? 'New Transaction' : isIncome ? 'New Income' : 'New Expense'}
        subtitle="Quick, clean money logging"
        onClose={onClose}
        fullHeight
        footer={
          <View style={styles.dualFooter}>
            <Pressable
              style={[styles.continueBtn, { backgroundColor: colors.backgroundAlt, borderColor: colors.border }]}
              onPress={() => void handleSave(true)}
              disabled={saving}>
              <Text style={[styles.continueBtnText, { color: colors.text }]}>CONTINUE</Text>
            </Pressable>
            <Pressable
              style={[styles.saveBtn, { backgroundColor: colors.primary }]}
              onPress={() => void handleSave(false)}
              disabled={saving}>
              {saving ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <Text style={styles.saveBtnText}>SAVE</Text>
              )}
            </Pressable>
          </View>
        }>
        {/* Top Minimal Segmented Tabs */}
        <View style={[styles.tabContainer, { backgroundColor: colors.backgroundAlt }]}>
          {MONEY_KIND_OPTIONS.map((option) => {
            const active = form.kind === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => {
                  setForm((current) => ({ ...emptyForm(option.value), amount: current.amount, date: current.date }));
                  setCustomCategory('');
                }}
                style={[
                  styles.tabBtn,
                  active && [styles.tabBtnActive, { backgroundColor: colors.surface }],
                ]}>
                <Text
                  style={[
                    styles.tabBtnText,
                    { color: active ? colors.primary : colors.textMuted },
                    active && styles.tabBtnTextActive,
                  ]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Hero Big Bold Amount Card */}
        <View style={[styles.amountCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.amountKicker, { color: colors.textMuted }]}>Enter Amount</Text>
          <View style={styles.amountRow}>
            <Text style={[styles.amountPrefix, { color: colors.accent }]}>Rs</Text>
            <TextInput
              value={form.amount}
              onChangeText={(amountValue) => setForm((current) => ({ ...current, amount: amountValue }))}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={colors.textSoft}
              style={[styles.amountInput, { color: colors.text }]}
              autoFocus={compact}
            />
          </View>
        </View>

        {/* Visual Category Grid */}
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
          {isIncome ? 'Income Source' : 'Category'}
        </Text>

        <View style={styles.categoryGrid}>
          {categoryOptions.map((name) => {
            const active = form.category === name;
            const visual = getCategoryVisual(name, mode);

            return (
              <Pressable
                key={name}
                style={[
                  styles.categoryTile,
                  { backgroundColor: colors.surface, borderColor: active ? colors.primary : colors.border },
                  active && { borderWidth: 1.5, backgroundColor: colors.accentSoft },
                ]}
                onPress={() => setForm((current) => ({ ...current, category: name }))}>
                <View style={[styles.categoryIconBox, { backgroundColor: visual.background }]}>
                  <MaterialCommunityIcons name={visual.icon} size={16} color={visual.color} />
                </View>
                <Text
                  style={[
                    styles.categoryTileLabel,
                    { color: colors.text },
                    active && { fontWeight: '700', color: colors.primary },
                  ]}
                  numberOfLines={1}>
                  {name}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {form.category === 'Other' ? (
          <FormField
            label={isIncome ? 'Custom source (optional)' : 'Custom category (optional)'}
            value={customCategory}
            onChangeText={setCustomCategory}
            placeholder={isIncome ? 'e.g. Dividend, Bonus, Side project' : 'e.g. Repairs, Books, Subscriptions'}
          />
        ) : null}

        {/* Remarks / Notes Field with Camera Icon */}
        <View style={[styles.remarksCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <MaterialCommunityIcons name="note-text-outline" size={18} color={colors.textMuted} />
          <TextInput
            style={[styles.remarksInput, { color: colors.text }]}
            placeholder="Click to fill in the remarks"
            placeholderTextColor={colors.textSoft}
            value={form.notes}
            onChangeText={(notes) => setForm((c) => ({ ...c, notes }))}
          />
          <Pressable style={styles.cameraIconBtn} onPress={() => void handlePickReceipt()}>
            <MaterialCommunityIcons name="camera-outline" size={20} color={colors.primary} />
          </Pressable>
        </View>

        {receiptImage ? (
          <View style={[styles.receiptPreviewWrap, { borderColor: colors.border }]}>
            <Image source={{ uri: receiptImage }} style={styles.receiptPreviewImg} />
            <Pressable style={styles.removeReceiptBtn} onPress={() => setReceiptImage(null)}>
              <MaterialCommunityIcons name="close-circle" size={20} color={colors.danger} />
            </Pressable>
          </View>
        ) : null}

        {/* Payment Method Selector */}
        <PaymentMethodSelector
          value={form.paymentMethod}
          bankId={form.bankId}
          onChange={(paymentMethod, bankId) =>
            setForm((current) => ({
              ...current,
              paymentMethod,
              bankId: bankId ?? current.bankId,
            }))
          }
        />

        <DatePickerField label="Date" value={form.date} onChangeText={(date) => setForm((current) => ({ ...current, date }))} />
      </BottomSheet>

      <WinMoment
        win={win}
        onClose={() => {
          setWin(null);
          onClose();
        }}
        onAgain={() => setWin(null)}
      />
    </>
  );
}

const createStyles = (colors: AppPalette) =>
  StyleSheet.create({
    tabContainer: {
      flexDirection: 'row',
      borderRadius: radius.pill,
      padding: 4,
      gap: 4,
    },
    tabBtn: {
      flex: 1,
      minHeight: 40,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.md,
    },
    tabBtnActive: {
      shadowColor: '#000',
      shadowOpacity: 0.08,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    tabBtnText: {
      fontSize: typography.body,
      fontWeight: '600',
    },
    tabBtnTextActive: {
      fontWeight: '800',
    },
    amountCard: {
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.accentSoft,
      padding: spacing.md,
      gap: 2,
    },
    amountKicker: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: colors.primary,
    },
    amountRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: spacing.sm,
    },
    amountPrefix: {
      fontSize: 26,
      fontWeight: '800',
      color: colors.textMuted,
      paddingBottom: 4,
    },
    amountInput: {
      flex: 1,
      fontSize: 34,
      fontWeight: '800',
      color: colors.text,
      paddingVertical: 0,
    },
    sectionLabel: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: colors.textSoft,
      marginTop: 4,
      marginBottom: 2,
    },
    categoryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    categoryTile: {
      width: '48.5%',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: radius.md,
      borderWidth: 1,
      minHeight: 46,
    },
    categoryIconBox: {
      width: 30,
      height: 30,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    categoryTileLabel: {
      flex: 1,
      fontSize: 13,
      fontWeight: '600',
    },
    remarksCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderWidth: 1,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: Platform.OS === 'ios' ? spacing.sm : 2,
      minHeight: 46,
    },
    remarksInput: {
      flex: 1,
      fontSize: typography.body,
      paddingVertical: 4,
    },
    cameraIconBtn: {
      padding: 4,
    },
    receiptPreviewWrap: {
      position: 'relative',
      width: 70,
      height: 70,
      borderRadius: radius.md,
      borderWidth: 1,
      overflow: 'hidden',
    },
    receiptPreviewImg: {
      width: '100%',
      height: '100%',
    },
    removeReceiptBtn: {
      position: 'absolute',
      top: 2,
      right: 2,
      backgroundColor: 'rgba(255,255,255,0.85)',
      borderRadius: 10,
    },
    dualFooter: {
      flexDirection: 'row',
      gap: spacing.md,
      width: '100%',
    },
    continueBtn: {
      flex: 1,
      minHeight: 48,
      borderRadius: radius.md,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    continueBtnText: {
      fontSize: typography.body,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    saveBtn: {
      flex: 1,
      minHeight: 48,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOpacity: 0.12,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    saveBtnText: {
      fontSize: typography.body,
      fontWeight: '800',
      color: colors.onPrimary,
      letterSpacing: 0.5,
    },
  });
