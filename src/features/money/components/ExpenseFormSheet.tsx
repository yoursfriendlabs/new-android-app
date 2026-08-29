import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { isInvalidSessionError } from '@/src/api/client';
import { quickExpensesApi } from '@/src/api';
import { addQuickExpenseLocally } from '@/src/data/cache';
import { submitWithOfflineQueue } from '@/src/data/sync';
import { workspaceAccessMessage } from '@/src/shared/lib/workspace';
import { withWorkspaceRetry } from '@/src/shared/lib/workspace-retry';
import { BottomSheet } from '@/src/shared/feedback/BottomSheet';
import { SuccessSheet } from '@/src/shared/feedback/SuccessSheet';
import { FormField } from '@/src/shared/forms/FormField';
import { PartyPickerSheet } from '@/src/shared/forms/PartyPickerSheet';
import { PaymentMethodSelector } from '@/src/shared/forms/PaymentMethodSelector';
import { SegmentedTabs } from '@/src/shared/ui/SegmentedTabs';
import { useBanks, useParties, useQuickExpenses } from '@/src/shared/hooks/useAppQueries';
import { useDebouncedValue } from '@/src/shared/hooks/useDebouncedValue';
import { formatCurrency, todayIso } from '@/src/shared/lib/format';
import { expenseCategoryIcon } from '@/src/features/money/lib/expense';
import { partyInitials } from '@/src/features/parties/lib/party';
import { usePalette } from '@/src/stores/theme-store';
import { radius, spacing, typography } from '@/src/theme';
import type { AppPalette } from '@/src/theme/app-palette';
import { useThemedStyles } from '@/src/theme/use-themed-styles';
import type { Party, PaymentMethod } from '@/src/types/models';

type PaidMode = 'full' | 'due';

interface ExpenseFormSheetProps {
  visible: boolean;
  onClose: () => void;
}

function emptyForm() {
  return {
    category: '',
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

export function ExpenseFormSheet({ onClose, visible }: ExpenseFormSheetProps) {
  const colors = usePalette();
  const styles = useThemedStyles(createStyles);
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [partySearch, setPartySearch] = useState('');
  const [partyPickerVisible, setPartyPickerVisible] = useState(false);
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState({ visible: false, queued: false, message: '' });
  const debouncedPartySearch = useDebouncedValue(partySearch);
  const { data: categories } = useQuickExpenses();
  const { data: parties } = useParties(debouncedPartySearch, 'both');
  const { data: banks } = useBanks();
  const activeBanks = useMemo(() => (banks ?? []).filter((bank) => bank.isActive), [banks]);

  useEffect(() => {
    if (visible) {
      setForm(emptyForm());
      setAddingCategory(false);
      setNewCategoryName('');
      setPartySearch('');
      setSaving(false);
      return;
    }
    setPartyPickerVisible(false);
  }, [visible]);

  const amount = Number(form.amount || 0);
  const amountPaid = form.paidMode === 'full' ? amount : Number(form.amountPaid || 0);

  async function handleAddCategory() {
    const name = newCategoryName.trim();
    if (!name) return;

    try {
      let savedName = name;
      try {
        const created = await quickExpensesApi.create({ name });
        savedName = created.name || name;
      } catch {
        const local = await addQuickExpenseLocally(name);
        savedName = local.name;
      }
      await queryClient.invalidateQueries({ queryKey: ['quick-expenses'] });
      setForm((current) => ({ ...current, category: savedName }));
      setNewCategoryName('');
      setAddingCategory(false);
    } catch (error) {
      Alert.alert('Unable to add category', error instanceof Error ? error.message : 'Please try again.');
    }
  }

  async function handleSave() {
    if (!form.category.trim()) {
      Alert.alert('Category required', 'Pick or add a category first.');
      return;
    }
    if (amount <= 0) {
      Alert.alert('Amount required', 'Enter an amount greater than zero.');
      return;
    }
    if (form.paymentMethod === 'bank' && !form.bankId) {
      Alert.alert('Bank required', 'Choose a bank account for this payment.');
      return;
    }
    if (amountPaid < 0 || amountPaid > amount) {
      Alert.alert('Paid amount', 'Amount paid cannot be more than the expense total.');
      return;
    }

    setSaving(true);
    const payload = {
      entryType: 'expense' as const,
      partyId: form.party?.id || null,
      partyName: form.party?.name || form.category,
      invoiceNo: `EXP-${Date.now().toString().slice(-6)}`,
      purchaseDate: form.date,
      status: amountPaid >= amount ? 'received' : 'pending',
      notes: form.notes,
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

    try {
      const result = await withWorkspaceRetry(() =>
        submitWithOfflineQueue<{ id?: string }, typeof payload>({
          entityType: 'expense',
          method: 'POST',
          path: '/api/purchases',
          body: payload,
        }),
      );
      await queryClient.invalidateQueries({ queryKey: ['purchases'] });
      await queryClient.invalidateQueries({ queryKey: ['recent-purchases'] });
      setSuccess({
        visible: true,
        queued: result.queued,
        message: `${formatCurrency(amount)} saved under ${form.category}.`,
      });
      setForm(emptyForm());
    } catch (error) {
      if (isInvalidSessionError(error)) return;
      Alert.alert('Unable to save expense', workspaceAccessMessage(error, 'Please try again.'));
    } finally {
      setSaving(false);
    }
  }

  function closeAll() {
    setPartyPickerVisible(false);
    setSuccess({ visible: false, queued: false, message: '' });
    onClose();
  }

  return (
    <>
      <BottomSheet
        visible={visible && !success.visible}
        title="New expense"
        subtitle="Category, amount, and how it was paid."
        onClose={closeAll}
        fullHeight
        footer={
          <Pressable style={styles.saveButton} onPress={() => void handleSave()} disabled={saving}>
            {saving ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.saveLabel}>Save expense</Text>
            )}
          </Pressable>
        }>
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

        <Text style={styles.sectionLabel}>Category</Text>
        <View style={styles.chipWrap}>
          {(categories ?? []).map((category) => {
            const active = form.category === category.name;
            return (
              <Pressable
                key={category.id}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setForm((current) => ({ ...current, category: category.name }))}>
                <MaterialCommunityIcons
                  name={expenseCategoryIcon(category.name)}
                  size={16}
                  color={active ? colors.white : colors.primary}
                />
                <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{category.name}</Text>
              </Pressable>
            );
          })}
          <Pressable style={styles.chipAdd} onPress={() => setAddingCategory((current) => !current)}>
            <MaterialCommunityIcons color={colors.primary} name="plus" size={16} />
            <Text style={styles.chipAddLabel}>New</Text>
          </Pressable>
        </View>
        {addingCategory ? (
          <View style={styles.addCategoryRow}>
            <View style={{ flex: 1 }}>
              <FormField
                label="New category"
                value={newCategoryName}
                placeholder="e.g. Rent, Tea, Fuel"
                onChangeText={setNewCategoryName}
              />
            </View>
            <Pressable
              style={[styles.addCategoryBtn, !newCategoryName.trim() && styles.addCategoryBtnDisabled]}
              onPress={() => void handleAddCategory()}
              disabled={!newCategoryName.trim()}>
              <Text style={styles.addCategoryBtnLabel}>Add</Text>
            </Pressable>
          </View>
        ) : null}

        <Pressable style={styles.selector} onPress={() => setPartyPickerVisible(true)}>
          <View
            style={[
              styles.selectorAvatar,
              { backgroundColor: form.party ? colors.primary : colors.backgroundAlt },
            ]}>
            {form.party ? (
              <Text style={styles.selectorAvatarText}>{partyInitials(form.party.name)}</Text>
            ) : (
              <MaterialCommunityIcons color={colors.textMuted} name="account-outline" size={18} />
            )}
          </View>
          <View style={styles.selectorCopy}>
            <Text style={styles.selectorTitle}>{form.party?.name ?? 'Paid to (optional)'}</Text>
            <Text style={styles.selectorSubtitle}>
              {form.party?.phone ?? 'Link a supplier or staff member if you want it on their statement'}
            </Text>
          </View>
          {form.party ? (
            <Pressable
              hitSlop={8}
              onPress={() => setForm((current) => ({ ...current, party: null }))}>
              <MaterialCommunityIcons color={colors.textMuted} name="close-circle" size={20} />
            </Pressable>
          ) : (
            <MaterialCommunityIcons color={colors.textMuted} name="chevron-right" size={20} />
          )}
        </Pressable>

        <SegmentedTabs
          value={form.paidMode}
          onChange={(paidMode) => setForm((current) => ({ ...current, paidMode }))}
          options={[
            { label: 'Paid in full', value: 'full' },
            { label: 'Still due', value: 'due' },
          ]}
        />
        {form.paidMode === 'due' ? (
          <FormField
            label="Amount paid now"
            value={form.amountPaid}
            onChangeText={(amountPaidValue) => setForm((current) => ({ ...current, amountPaid: amountPaidValue }))}
            keyboardType="decimal-pad"
            placeholder="0"
          />
        ) : null}

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
              <Text style={styles.helper}>No active banks yet. Add one under More → Banks.</Text>
            )}
          </View>
        ) : null}

        <FormField
          label="Date"
          value={form.date}
          onChangeText={(date) => setForm((current) => ({ ...current, date }))}
        />
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
        parties={parties ?? []}
        allowWalkIn={false}
        title="Paid to"
        subtitle="Optional. Skip this for a simple cash expense."
        onPick={(party) => {
          setForm((current) => ({ ...current, party }));
          setPartyPickerVisible(false);
        }}
        onClose={() => setPartyPickerVisible(false)}
      />

      <SuccessSheet
        visible={success.visible}
        queued={success.queued}
        title="Expense saved"
        message={success.message}
        onClose={() => {
          setSuccess({ visible: false, queued: false, message: '' });
          onClose();
        }}
        actions={[
          {
            label: 'Done',
            primary: true,
            onPress: () => {
              setSuccess({ visible: false, queued: false, message: '' });
              onClose();
            },
          },
          {
            label: 'Add another',
            onPress: () => setSuccess({ visible: false, queued: false, message: '' }),
          },
        ]}
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
    chipAdd: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      minHeight: 36,
      paddingHorizontal: spacing.md,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.primary,
      backgroundColor: colors.accentSoft,
    },
    chipAddLabel: {
      fontSize: typography.label,
      fontWeight: '800',
      color: colors.primary,
    },
    addCategoryRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: spacing.sm,
    },
    addCategoryBtn: {
      minHeight: 50,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.md,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addCategoryBtnDisabled: {
      backgroundColor: colors.backgroundAlt,
    },
    addCategoryBtnLabel: {
      color: colors.white,
      fontWeight: '800',
    },
    selector: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.backgroundAlt,
      padding: spacing.md,
    },
    selectorAvatar: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    selectorAvatarText: {
      color: colors.white,
      fontSize: 13,
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
    helper: {
      fontSize: typography.body,
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
      fontSize: typography.body,
      fontWeight: '800',
    },
  });
