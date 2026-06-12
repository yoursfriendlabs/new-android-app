import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { banksApi } from '@/src/api';
import { BottomSheet } from '@/src/components/feedback/BottomSheet';
import { FormField } from '@/src/components/forms/FormField';
import { Screen } from '@/src/components/layout/Screen';
import { formatCurrency } from '@/src/lib/format';
import { useBanks } from '@/src/hooks/useAppQueries';
import { submitWithOfflineQueue } from '@/src/data/sync';
import { cacheBankRecord } from '@/src/data/cache';
import { generateId } from '@/src/lib/id';
import { palette, radius, spacing, typography } from '@/src/theme';
import type { BankAccount } from '@/src/types/models';

function createBankForm() {
  return {
    name: '',
    accountName: '',
    accountNumber: '',
    branchName: '',
    openingBalance: '0',
    currentBalance: '0',
    isActive: true,
    notes: '',
  };
}

function getAccountVisual(bankName: string) {
  const normalized = bankName.toLowerCase();
  if (normalized.includes('cash')) {
    return {
      icon: 'cash-multiple',
      color: palette.success,
      backgroundColor: palette.successSoft,
    };
  }

  if (normalized.includes('ime') || normalized.includes('esewa') || normalized.includes('pay')) {
    return {
      icon: 'wallet-outline',
      color: '#e44d74',
      backgroundColor: '#ffe8ef',
    };
  }

  return {
    icon: 'bank-outline',
    color: '#5b78d6',
    backgroundColor: '#edf2ff',
  };
}

export default function BanksScreen() {
  const queryClient = useQueryClient();
  const { data } = useBanks();
  const [sheetVisible, setSheetVisible] = useState(false);
  const [adjustSheetVisible, setAdjustSheetVisible] = useState(false);
  const [editingBank, setEditingBank] = useState<BankAccount | null>(null);
  const [adjustingBankId, setAdjustingBankId] = useState('');
  const [adjustAmount, setAdjustAmount] = useState('0');
  const [form, setForm] = useState(createBankForm());

  const totalBalance = useMemo(
    () => (data ?? []).reduce((sum, bank) => sum + Number(bank.currentBalance ?? 0), 0),
    [data],
  );

  const adjustingBank = (data ?? []).find((bank) => bank.id === adjustingBankId) ?? null;

  function openSheet(bank?: BankAccount) {
    setEditingBank(bank ?? null);
    setForm({
      name: bank?.name ?? '',
      accountName: bank?.accountName ?? '',
      accountNumber: bank?.accountNumber ?? '',
      branchName: bank?.branchName ?? '',
      openingBalance: String(bank?.openingBalance ?? 0),
      currentBalance: String(bank?.currentBalance ?? 0),
      isActive: bank?.isActive ?? true,
      notes: bank?.notes ?? '',
    });
    setSheetVisible(true);
  }

  async function handleSave() {
    const body = {
      name: form.name,
      accountName: form.accountName,
      accountNumber: form.accountNumber,
      branchName: form.branchName,
      openingBalance: Number(form.openingBalance),
      currentBalance: Number(form.currentBalance),
      isActive: form.isActive,
      notes: form.notes,
    };

    const response = await submitWithOfflineQueue<BankAccount, typeof body>({
      entityType: 'bank',
      method: editingBank ? 'PUT' : 'POST',
      path: editingBank ? `/api/banks/${editingBank.id}` : '/api/banks',
      body,
    });

    await cacheBankRecord({
      id: response.data?.id ?? editingBank?.id ?? generateId('bank'),
      ...body,
    });
    await queryClient.invalidateQueries({ queryKey: ['banks'] });
    setSheetVisible(false);
  }

  async function removeBank() {
    if (!editingBank?.id) return;
    await banksApi.remove(editingBank.id);
    await queryClient.invalidateQueries({ queryKey: ['banks'] });
    setSheetVisible(false);
  }

  async function saveAdjustedBalance() {
    if (!adjustingBank) return;

    const nextBalance = Number(adjustAmount || 0);
    await submitWithOfflineQueue({
      entityType: 'bank',
      method: 'PUT',
      path: `/api/banks/${adjustingBank.id}`,
      body: {
        name: adjustingBank.name,
        accountName: adjustingBank.accountName,
        accountNumber: adjustingBank.accountNumber,
        branchName: adjustingBank.branchName,
        openingBalance: adjustingBank.openingBalance ?? 0,
        currentBalance: nextBalance,
        isActive: adjustingBank.isActive,
        notes: adjustingBank.notes,
      },
    });
    await cacheBankRecord({ ...adjustingBank, currentBalance: nextBalance });
    await queryClient.invalidateQueries({ queryKey: ['banks'] });
    setAdjustSheetVisible(false);
  }

  return (
    <Screen
      scrollable={false}
      padded={false}
      topBarTitle="Cash & Bank Accounts"
      footer={
        <View style={styles.footer}>
          <Pressable style={styles.adjustButton} onPress={() => setAdjustSheetVisible(true)}>
            <Text style={styles.adjustButtonLabel}>Adjust Balance</Text>
          </Pressable>
        </View>
      }>
      <View style={styles.container}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}>
          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>Overall Account Balance</Text>
            <Text style={styles.balanceValue}>{formatCurrency(totalBalance)}</Text>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>All Accounts</Text>
            <Pressable style={styles.inlineAction} onPress={() => openSheet()}>
              <MaterialCommunityIcons color={palette.success} name="plus" size={22} />
              <Text style={styles.inlineActionLabel}>New Account</Text>
            </Pressable>
          </View>

          <View style={styles.accountsCard}>
            {(data ?? []).map((bank, index) => {
              const visual = getAccountVisual(bank.name);
              return (
                <Pressable
                  key={bank.id}
                  style={[styles.accountRow, index < (data?.length ?? 0) - 1 && styles.accountRowBorder]}
                  onPress={() => openSheet(bank)}>
                  <View style={[styles.accountIconWrap, { backgroundColor: visual.backgroundColor }]}>
                    <MaterialCommunityIcons
                      color={visual.color}
                      name={visual.icon as keyof typeof MaterialCommunityIcons.glyphMap}
                      size={28}
                    />
                  </View>
                  <View style={styles.accountCopy}>
                    <Text numberOfLines={1} style={styles.accountName}>{bank.name}</Text>
                    {!bank.isActive ? <Text style={styles.accountMeta}>Inactive</Text> : null}
                  </View>
                  <Text style={styles.accountAmount}>{formatCurrency(bank.currentBalance ?? 0)}</Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </View>

      <BottomSheet
        visible={sheetVisible}
        title={editingBank ? 'Edit Account' : 'New Account'}
        subtitle="Manage bank or wallet details without leaving this screen."
        onClose={() => setSheetVisible(false)}
        footer={
          <View style={styles.sheetFooter}>
            {editingBank ? (
              <Pressable style={styles.deleteButton} onPress={() => void removeBank()}>
                <Text style={styles.deleteButtonLabel}>Delete</Text>
              </Pressable>
            ) : null}
            <Pressable style={styles.sheetPrimaryButton} onPress={() => void handleSave()}>
              <Text style={styles.sheetPrimaryLabel}>
                {editingBank ? 'Save Changes' : 'Create Account'}
              </Text>
            </Pressable>
          </View>
        }>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetContent}>
          <FormField label="Account name" value={form.name} onChangeText={(name) => setForm((current) => ({ ...current, name }))} />
          <FormField label="Legal account name" value={form.accountName} onChangeText={(accountName) => setForm((current) => ({ ...current, accountName }))} />
          <FormField label="Account number" value={form.accountNumber} onChangeText={(accountNumber) => setForm((current) => ({ ...current, accountNumber }))} />
          <FormField label="Branch" value={form.branchName} onChangeText={(branchName) => setForm((current) => ({ ...current, branchName }))} />
          <FormField label="Opening balance" value={form.openingBalance} onChangeText={(openingBalance) => setForm((current) => ({ ...current, openingBalance }))} keyboardType="numeric" />
          <FormField label="Current balance" value={form.currentBalance} onChangeText={(currentBalance) => setForm((current) => ({ ...current, currentBalance }))} keyboardType="numeric" />
          <FormField label="Notes" value={form.notes} onChangeText={(notes) => setForm((current) => ({ ...current, notes }))} multiline />
        </ScrollView>
      </BottomSheet>

      <BottomSheet
        visible={adjustSheetVisible}
        title="Adjust Balance"
        subtitle="Choose the account and set the current balance you want to keep on mobile."
        onClose={() => setAdjustSheetVisible(false)}
        footer={
          <Pressable style={styles.sheetPrimaryButton} onPress={() => void saveAdjustedBalance()}>
            <Text style={styles.sheetPrimaryLabel}>Save Balance</Text>
          </Pressable>
        }>
        <View style={styles.chipWrap}>
          {(data ?? []).map((bank) => (
            <Pressable
              key={bank.id}
              style={[styles.bankChip, adjustingBankId === bank.id && styles.bankChipActive]}
              onPress={() => {
                setAdjustingBankId(bank.id);
                setAdjustAmount(String(bank.currentBalance ?? 0));
              }}>
              <Text style={[styles.bankChipLabel, adjustingBankId === bank.id && styles.bankChipLabelActive]}>
                {bank.name}
              </Text>
            </Pressable>
          ))}
        </View>
        <FormField label="Current balance" value={adjustAmount} onChangeText={setAdjustAmount} keyboardType="numeric" />
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.xl,
  },
  balanceCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    padding: spacing.xl,
    gap: spacing.md,
  },
  balanceLabel: {
    fontSize: 20,
    color: palette.textSoft,
  },
  balanceValue: {
    fontSize: 34,
    fontWeight: '800',
    color: palette.success,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: palette.text,
  },
  inlineAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  inlineActionLabel: {
    fontSize: typography.subheading,
    fontWeight: '700',
    color: palette.success,
  },
  accountsCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    overflow: 'hidden',
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  accountRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  accountIconWrap: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountCopy: {
    flex: 1,
    gap: spacing.xxs,
  },
  accountName: {
    fontSize: 22,
    fontWeight: '500',
    color: palette.text,
  },
  accountMeta: {
    fontSize: typography.label,
    color: palette.textSoft,
  },
  accountAmount: {
    fontSize: typography.heading,
    fontWeight: '800',
    color: palette.success,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: palette.background,
  },
  adjustButton: {
    minHeight: 58,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.success,
  },
  adjustButtonLabel: {
    color: palette.white,
    fontSize: typography.heading,
    fontWeight: '800',
  },
  sheetFooter: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  deleteButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.dangerSoft,
  },
  deleteButtonLabel: {
    color: palette.danger,
    fontSize: typography.body,
    fontWeight: '800',
  },
  sheetPrimaryButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.success,
  },
  sheetPrimaryLabel: {
    color: palette.white,
    fontSize: typography.body,
    fontWeight: '800',
  },
  sheetContent: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  bankChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: palette.backgroundAlt,
  },
  bankChipActive: {
    backgroundColor: palette.success,
  },
  bankChipLabel: {
    color: palette.text,
    fontWeight: '700',
  },
  bankChipLabelActive: {
    color: palette.white,
  },
});
