import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Haptics from 'expo-haptics';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { isInvalidSessionError } from '@/src/api/client';
import { partiesApi, partyTransactionsApi } from '@/src/api';
import { extractListItems, normalizeParty } from '@/src/api/normalize';
import { DeviceContactSheet } from '@/src/features/parties/components/DeviceContactSheet';
import { PartyFormSheet } from '@/src/features/parties/components/PartyFormSheet';
import { BottomSheet } from '@/src/shared/feedback/BottomSheet';
import { FormField } from '@/src/shared/forms/FormField';
import { PartyPickerSheet } from '@/src/shared/forms/PartyPickerSheet';
import { PaymentMethodSelector } from '@/src/shared/forms/PaymentMethodSelector';
import { SegmentedTabs } from '@/src/shared/ui/SegmentedTabs';
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

const INCOME_CATEGORIES = ['Salary', 'Freelance', 'Family', 'Gift', 'Refund', 'Other'];
const PERSONAL_EXPENSE_CATEGORIES = ['Food', 'Rent', 'Transport', 'Shopping', 'Bills', 'Health', 'Other'];

interface MoneyEntrySheetProps {
  visible: boolean;
  kind: MoneyEntryKind;
  onClose: () => void;
  activityDates?: string[];
  snapshot?: Omit<HabitSnapshot, 'dates'>;
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

export function MoneyEntrySheet({ activityDates = [], kind, onClose, snapshot, visible }: MoneyEntrySheetProps) {
  const colors = usePalette();
  const styles = useThemedStyles(createStyles);
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm(kind));
  const [partySearch, setPartySearch] = useState('');
  const [partyPickerVisible, setPartyPickerVisible] = useState(false);
  const [createContactVisible, setCreateContactVisible] = useState(false);
  const [phoneSheetVisible, setPhoneSheetVisible] = useState(false);
  const [contactSeed, setContactSeed] = useState<DeviceContactDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [win, setWin] = useState<HabitWin | null>(null);
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
      setPartySearch('');
      setSaving(false);
      return;
    }
    setPartyPickerVisible(false);
    setCreateContactVisible(false);
    setPhoneSheetVisible(false);
  }, [kind, visible]);

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

  async function handleSave() {
    if (!form.category.trim()) {
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
      const note = moneyNote(form.category, form.notes);
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
          amountReceived: amountPaid,
          paymentMethod: form.paymentMethod,
          bankId: form.paymentMethod === 'bank' ? form.bankId : undefined,
          paymentNote: '',
          subTotal: amount,
          taxTotal: 0,
          grandTotal: amount,
          items: [
            {
              description: form.category,
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
        title={isIncome ? 'Money in' : 'Money out'}
        subtitle={
          isIncome
            ? 'Category is what the money is for. Contact is optional.'
            : 'Save who you paid, or keep it as walk-in.'
        }
        onClose={closeAll}
        fullHeight
        footer={
          <Pressable style={styles.saveButton} onPress={() => void handleSave()} disabled={saving}>
            {saving ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.saveLabel}>{isIncome ? 'Save income' : 'Save expense'}</Text>
            )}
          </Pressable>
        }>
        <SegmentedTabs
          value={form.kind}
          onChange={(nextKind) => setForm((current) => ({ ...emptyForm(nextKind), amount: current.amount, date: current.date }))}
          options={[
            { label: 'Income', value: 'income' },
            { label: 'Expense', value: 'expense' },
          ]}
        />

        <View style={styles.amountCard}>
          <Text style={styles.amountKicker}>Amount</Text>
          <View style={styles.amountRow}>
            <Text style={styles.amountPrefix}>Rs</Text>
            <TextInput
              value={form.amount}
              onChangeText={(amountValue) => setForm((current) => ({ ...current, amount: amountValue }))}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={colors.textSoft}
              style={styles.amountInput}
            />
          </View>
        </View>

        <Text style={styles.sectionLabel}>{isIncome ? 'Source' : 'Category'}</Text>
        <View style={styles.chipWrap}>
          {categoryOptions.map((name) => {
            const active = form.category === name;
            return (
              <Pressable
                key={name}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setForm((current) => ({ ...current, category: name }))}>
                <MaterialCommunityIcons
                  name={isIncome ? 'cash-plus' : expenseCategoryIcon(name)}
                  size={16}
                  color={active ? colors.white : colors.primary}
                />
                <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{name}</Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable style={styles.selector} onPress={() => setPartyPickerVisible(true)}>
          <View style={[styles.selectorAvatar, { backgroundColor: form.party ? colors.primary : colors.backgroundAlt }]}>
            {form.party ? (
              <Text style={styles.selectorAvatarText}>{partyInitials(form.party.name)}</Text>
            ) : (
              <MaterialCommunityIcons color={colors.textMuted} name="account-outline" size={18} />
            )}
          </View>
          <View style={styles.selectorCopy}>
            <Text style={styles.selectorTitle}>
              {form.party?.name ?? WALK_IN_LABEL}
            </Text>
            <Text style={styles.selectorSubtitle}>
              {form.party?.phone
                ?? (isIncome ? 'From a contact, or walk-in if nobody is attached' : 'Paid to a contact, or walk-in')}
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

        <PaymentMethodSelector
          value={form.paymentMethod}
          onChange={(paymentMethod) => setForm((current) => ({ ...current, paymentMethod }))}
        />
        {form.paymentMethod === 'bank' ? (
          <View style={styles.bankWrap}>
            {activeBanks.length ? (
              activeBanks.map((bank) => {
                const active = form.bankId === bank.id;
                return (
                  <Pressable
                    key={bank.id}
                    style={[styles.bankChip, active && styles.bankChipActive]}
                    onPress={() => setForm((current) => ({ ...current, bankId: bank.id }))}>
                    <Text style={[styles.bankChipLabel, active && styles.bankChipLabelActive]}>{bank.name}</Text>
                  </Pressable>
                );
              })
            ) : (
              <Text style={styles.helper}>No bank accounts yet. Add one under More → Banks.</Text>
            )}
          </View>
        ) : null}

        <FormField label="Date" value={form.date} onChangeText={(date) => setForm((current) => ({ ...current, date }))} />
        <FormField
          label="Note"
          value={form.notes}
          onChangeText={(notes) => setForm((current) => ({ ...current, notes }))}
          placeholder="Optional"
          multiline
        />
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
    amountCard: {
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.accentSoft,
      padding: spacing.lg,
      gap: spacing.xs,
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
      fontSize: typography.heading,
      fontWeight: '800',
      color: colors.textMuted,
      paddingBottom: 6,
    },
    amountInput: {
      flex: 1,
      fontSize: 40,
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
      marginTop: spacing.sm,
    },
    chipWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: 36,
      paddingHorizontal: spacing.md,
      borderRadius: radius.pill,
      backgroundColor: colors.backgroundAlt,
      borderWidth: 1,
      borderColor: colors.border,
    },
    chipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    chipLabel: {
      fontSize: typography.label,
      fontWeight: '700',
      color: colors.text,
    },
    chipLabelActive: {
      color: colors.white,
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
      width: 40,
      height: 40,
      borderRadius: 14,
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
    bankWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    bankChip: {
      minHeight: 36,
      paddingHorizontal: spacing.md,
      borderRadius: radius.pill,
      backgroundColor: colors.backgroundAlt,
      justifyContent: 'center',
    },
    bankChipActive: {
      backgroundColor: colors.primary,
    },
    bankChipLabel: {
      fontSize: typography.label,
      fontWeight: '700',
      color: colors.text,
    },
    bankChipLabelActive: {
      color: colors.white,
    },
    helper: {
      fontSize: typography.label,
      color: colors.textMuted,
    },
    saveButton: {
      minHeight: 52,
      borderRadius: radius.md,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveLabel: {
      color: colors.white,
      fontWeight: '800',
      fontSize: typography.body,
    },
  });
