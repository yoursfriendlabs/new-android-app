import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { isInvalidSessionError } from '@/src/api/client';
import { partiesApi, partyTransactionsApi } from '@/src/api';
import { extractListItems, normalizeParty } from '@/src/api/normalize';
import { DeviceContactSheet } from '@/src/features/parties/components/DeviceContactSheet';
import { PartyFormSheet } from '@/src/features/parties/components/PartyFormSheet';
import { Avatar } from '@/src/shared/ui/Avatar';
import { BottomSheet } from '@/src/shared/feedback/BottomSheet';
import { FormField } from '@/src/shared/forms/FormField';
import { DatePickerField } from '@/src/shared/forms/DatePickerField';
import { PartyPickerSheet } from '@/src/shared/forms/PartyPickerSheet';
import { PaymentMethodSelector } from '@/src/shared/forms/PaymentMethodSelector';
import { submitWithOfflineQueue } from '@/src/data/sync';
import { pickNativeDeviceContact, type DeviceContactDraft } from '@/src/features/parties/lib/device-contacts';
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
import {
  isWalkInParty,
  moneyNote,
  moneyPersonLabel,
  visibleMoneyParties,
  WALK_IN_LABEL,
} from '@/src/features/money/lib/money';
import { partyInitials, partyTypeLabel } from '@/src/features/parties/lib/party';
import { workspaceAccessMessage, firstNonEmptyId } from '@/src/shared/lib/workspace';
import { withWorkspaceRetry } from '@/src/shared/lib/workspace-retry';
import { invalidatePartyQueries, useBanks, useParties, useQuickExpenses } from '@/src/shared/hooks/useAppQueries';
import { useDebouncedValue } from '@/src/shared/hooks/useDebouncedValue';
import { usePalette } from '@/src/stores/theme-store';
import { radius, spacing, typography } from '@/src/theme';
import type { AppPalette } from '@/src/theme/app-palette';
import { useThemedStyles } from '@/src/theme/use-themed-styles';
import type { Party, PaymentMethod } from '@/src/types/models';

export type MoneyEntryKind = 'income' | 'expense';
type PaidMode = 'full' | 'due';

const INCOME_CATEGORIES = ['Salary', 'Investments', 'Allowance', 'Bonus', 'Freelance', 'Family', 'Refund', 'Other'];
const PERSONAL_EXPENSE_CATEGORIES = ['Food', 'Shopping', 'Transport', 'Housing', 'Bills', 'Entertainment', 'Education', 'Health', 'Other'];

const CATEGORY_VISUALS: Record<string, { icon: keyof typeof MaterialCommunityIcons.glyphMap; color: string; bg: string }> = {
  'Food': { icon: 'food-fork-drink', color: '#d97706', bg: '#fef3c7' },
  'Shopping': { icon: 'shopping', color: '#e11d48', bg: '#ffe4e6' },
  'Transport': { icon: 'car', color: '#059669', bg: '#d1fae5' },
  'Housing': { icon: 'home', color: '#0284c7', bg: '#e0f2fe' },
  'Rent': { icon: 'home-city', color: '#0284c7', bg: '#e0f2fe' },
  'Entertainment': { icon: 'movie-open', color: '#7c3aed', bg: '#ede9fe' },
  'Education': { icon: 'school', color: '#2563eb', bg: '#dbeafe' },
  'Salary': { icon: 'briefcase', color: '#b45309', bg: '#fef3c7' },
  'Investments': { icon: 'chart-line', color: '#ca8a04', bg: '#fef9c3' },
  'Allowance': { icon: 'wallet-giftcard', color: '#059669', bg: '#d1fae5' },
  'Gift': { icon: 'gift', color: '#db2777', bg: '#fce7f3' },
  'Bonus': { icon: 'trophy', color: '#ea580c', bg: '#ffedd5' },
  'Health': { icon: 'heart-pulse', color: '#dc2626', bg: '#fee2e2' },
  'Bills': { icon: 'receipt', color: '#4f46e5', bg: '#e0e7ff' },
  'Freelance': { icon: 'laptop', color: '#0891b2', bg: '#cffafe' },
  'Family': { icon: 'account-child', color: '#0d9488', bg: '#ccfbf1' },
  'Refund': { icon: 'cash-refund', color: '#65a30d', bg: '#ecfccb' },
  'Other': { icon: 'dots-horizontal-circle-outline', color: '#475569', bg: '#f1f5f9' },
};

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
    party: null as Party | null,
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
  const styles = useThemedStyles(createStyles);
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm(kind));
  const [customCategory, setCustomCategory] = useState('');
  const [partySearch, setPartySearch] = useState('');
  const [partyPickerVisible, setPartyPickerVisible] = useState(false);
  const [createContactVisible, setCreateContactVisible] = useState(false);
  const [phoneSheetVisible, setPhoneSheetVisible] = useState(false);
  const [contactSeed, setContactSeed] = useState<DeviceContactDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [win, setWin] = useState<HabitWin | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(!compact);
  const debouncedPartySearch = useDebouncedValue(partySearch);
  const { data: categories } = useQuickExpenses();
  const { data: parties } = useParties(debouncedPartySearch, 'both');
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
      setPartySearch('');
      setSaving(false);
      setDetailsOpen(!compact);
      return;
    }
    setPartyPickerVisible(false);
    setCreateContactVisible(false);
    setPhoneSheetVisible(false);
  }, [compact, kind, visible]);

  const amount = Number(form.amount || 0);
  const amountPaid = form.paidMode === 'full' ? amount : Number(form.amountPaid || 0);
  const isIncome = form.kind === 'income';
  const categoryOptions = isIncome
    ? INCOME_CATEGORIES
    : Array.from(new Set([...(categories ?? []).map((item) => item.name), ...PERSONAL_EXPENSE_CATEGORIES])).filter(Boolean);

  const pickerParties = visibleMoneyParties(parties);

  async function ensureWalkInParty() {
    const local = (parties ?? []).find((item) => isWalkInParty(item));
    if (local) return local;
    const lookup = await partiesApi.lookup({ search: WALK_IN_LABEL, limit: 20 });
    const match = extractListItems<Party>(lookup).map(normalizeParty).find((item) => isWalkInParty(item));
    if (match) return match;
    const created = await withWorkspaceRetry(() =>
      partiesApi.create({
        name: WALK_IN_LABEL,
        type: 'both',
      }),
    );
    const saved = normalizeParty(created);
    await invalidatePartyQueries(queryClient, [saved.id]);
    return saved;
  }

  async function importFromPhone() {
    const native = await pickNativeDeviceContact();
    if (native) {
      setContactSeed(native);
      setPartyPickerVisible(false);
      setCreateContactVisible(true);
      return;
    }
    if (native === undefined) setPhoneSheetVisible(true);
  }

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
      Alert.alert('Category required', 'Pick what this money is for.');
      return;
    }
    if (amount <= 0) {
      Alert.alert('Amount required', 'Enter an amount greater than zero.');
      return;
    }
    if (form.paymentMethod === 'bank' && !form.bankId) {
      Alert.alert('Account required', 'Choose a bank account for this payment.');
      return;
    }
    if (!isIncome && (amountPaid < 0 || amountPaid > amount)) {
      Alert.alert('Paid amount', 'Amount paid cannot be more than the total.');
      return;
    }

    setSaving(true);
    try {
      const note = moneyNote(effectiveCategory, form.notes);
      let moneySourceId = '';
      if (isIncome) {
        const contact = form.party ?? (await ensureWalkInParty());
        const created = await withWorkspaceRetry(() =>
          partyTransactionsApi.create({
            partyId: contact.id,
            direction: 'receive',
            amount,
            txDate: form.date,
            paymentMethod: form.paymentMethod,
            bankId: form.paymentMethod === 'bank' ? form.bankId : undefined,
            note,
          }),
        );
        moneySourceId = firstNonEmptyId(created);
        if (!isWalkInParty(contact)) {
          await invalidatePartyQueries(queryClient, [contact.id]);
        } else {
          await queryClient.invalidateQueries({ queryKey: ['parties'] });
        }
        await queryClient.invalidateQueries({ queryKey: ['party-transactions'] });
        await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      } else {
        const payload = {
          entryType: 'expense' as const,
          partyId: form.party?.id || null,
          partyName: moneyPersonLabel(form.party),
          invoiceNo: `EXP-${Date.now().toString().slice(-6)}`,
          purchaseDate: form.date,
          status: amountPaid >= amount ? 'received' : 'pending',
          notes: note,
          attachment: receiptImage || undefined,
          amountReceived: amountPaid,
          paymentMethod: form.paymentMethod,
          bankId: form.paymentMethod === 'bank' ? form.bankId : undefined,
          paymentNote: '',
          subTotal: amount,
          taxTotal: 0,
          grandTotal: amount,
          items: [
            {
              description: effectiveCategory,
              quantity: 1,
              unitType: 'primary',
              unitPrice: amount,
              taxRate: 0,
              lineTotal: amount,
              itemType: 'expense',
            },
          ],
        };
        const queued = await withWorkspaceRetry(() =>
          submitWithOfflineQueue<{ id?: string }, typeof payload>({
            entityType: 'expense',
            method: 'POST',
            path: '/api/purchases',
            body: payload,
          }),
        );
        moneySourceId = firstNonEmptyId(queued.data);
        await queryClient.invalidateQueries({ queryKey: ['purchases'] });
        await queryClient.invalidateQueries({ queryKey: ['recent-purchases'] });
        await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        if (form.party?.id) await invalidatePartyQueries(queryClient, [form.party.id]);
      }

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
          party: null,
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
      Alert.alert(
        isIncome ? 'Unable to save income' : 'Unable to save expense',
        workspaceAccessMessage(error, 'Please try again.'),
      );
    } finally {
      setSaving(false);
    }
  }

  function closeAll() {
    setPartyPickerVisible(false);
    onClose();
  }

  return (
    <>
      <BottomSheet
        visible={visible && !win}
        title={compact ? 'New Transaction' : isIncome ? 'New Income' : 'New Expense'}
        subtitle="Quick, clean money logging"
        onClose={closeAll}
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
                <ActivityIndicator color={colors.white} />
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
            const visual = CATEGORY_VISUALS[name] || {
              icon: isIncome ? 'cash-plus' : 'tag-outline',
              color: colors.primary,
              bg: colors.accentSoft,
            };

            return (
              <Pressable
                key={name}
                style={[
                  styles.categoryTile,
                  { backgroundColor: colors.surface, borderColor: active ? colors.primary : colors.border },
                  active && { borderWidth: 1.5, backgroundColor: colors.accentSoft },
                ]}
                onPress={() => setForm((current) => ({ ...current, category: name }))}>
                <View style={[styles.categoryIconBox, { backgroundColor: visual.bg }]}>
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

        <Pressable
          style={[styles.selector, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => setPartyPickerVisible(true)}>
          {form.party ? (
            <Avatar
              uri={form.party.avatarUrl}
              name={form.party.name}
              size={36}
            />
          ) : (
            <View style={[styles.selectorAvatar, { backgroundColor: colors.backgroundAlt }]}>
              <MaterialCommunityIcons color={colors.textMuted} name="account-outline" size={18} />
            </View>
          )}
          <View style={styles.selectorCopy}>
            <Text style={[styles.selectorTitle, { color: colors.text }]}>
              {form.party?.name ?? WALK_IN_LABEL}
            </Text>
            <Text style={[styles.selectorSubtitle, { color: colors.textMuted }]}>
              {form.party?.phone
                ?? (isIncome ? 'From a contact, or skip' : 'Paid to a contact, or skip')}
            </Text>
          </View>
          {form.party ? (
            <Pressable hitSlop={8} onPress={() => setForm((current) => ({ ...current, party: null }))}>
              <MaterialCommunityIcons color={colors.textMuted} name="close-circle" size={20} />
            </Pressable>
          ) : (
            <MaterialCommunityIcons color={colors.textMuted} name="chevron-right" size={20} />
          )}
        </Pressable>

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

      <PartyPickerSheet
        visible={partyPickerVisible}
        search={partySearch}
        onSearchChange={setPartySearch}
        parties={pickerParties}
        allowWalkIn
        walkInLabel={WALK_IN_LABEL}
        walkInSubtitle={isIncome ? 'Income with no contact attached' : 'Paid someone who is not in contacts'}
        title={isIncome ? 'Who paid you?' : 'Who did you pay?'}
        subtitle="Contacts stay contacts. Walk-in is fine when there is no person to save."
        createLabel="New contact"
        onCreatePress={() => {
          setContactSeed(null);
          setPartyPickerVisible(false);
          setCreateContactVisible(true);
        }}
        phoneImportLabel="From phone"
        onPhoneImportPress={() => void importFromPhone()}
        typeLabel={(party) => partyTypeLabel(party.type, true)}
        onPick={(party) => {
          setForm((current) => ({ ...current, party }));
          setPartyPickerVisible(false);
        }}
        onClose={() => setPartyPickerVisible(false)}
      />

      <PartyFormSheet
        visible={createContactVisible}
        seed={contactSeed}
        onClose={() => {
          setCreateContactVisible(false);
          setContactSeed(null);
        }}
        onSaved={(party) => {
          setForm((current) => ({ ...current, party }));
          setCreateContactVisible(false);
          setContactSeed(null);
        }}
      />

      <DeviceContactSheet
        visible={phoneSheetVisible}
        onClose={() => setPhoneSheetVisible(false)}
        onPick={(draft) => {
          setContactSeed(draft);
          setPhoneSheetVisible(false);
          setCreateContactVisible(true);
        }}
      />

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
    selector: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      padding: spacing.md,
      backgroundColor: colors.surface,
    },
    selectorAvatar: {
      width: 38,
      height: 38,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    selectorAvatarText: {
      color: colors.white,
      fontWeight: '800',
    },
    selectorCopy: {
      flex: 1,
      gap: 2,
    },
    selectorTitle: {
      fontSize: typography.body,
      fontWeight: '700',
      color: colors.text,
    },
    selectorSubtitle: {
      fontSize: typography.caption,
      color: colors.textMuted,
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
      color: colors.white,
      letterSpacing: 0.5,
    },
  });
