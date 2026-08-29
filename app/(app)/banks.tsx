import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { banksApi } from '@/src/api';
import { BottomSheet } from '@/src/shared/feedback/BottomSheet';
import { FormField } from '@/src/shared/forms/FormField';
import { Screen } from '@/src/shared/layout/Screen';
import { StickyActionBar } from '@/src/shared/ui/StickyActionBar';
import { cacheBankRecord } from '@/src/data/cache';
import { submitWithOfflineQueue } from '@/src/data/sync';
import { formatCurrency } from '@/src/shared/lib/format';
import { generateId } from '@/src/shared/lib/id';
import { workspaceAccessMessage } from '@/src/shared/lib/workspace';
import { withWorkspaceRetry } from '@/src/shared/lib/workspace-retry';
import { useBanks } from '@/src/shared/hooks/useAppQueries';
import { radius, shadows, spacing, typography } from '@/src/theme';
import type { BankAccount } from '@/src/types/models';
import { useAuthStore } from '@/src/stores/auth-store';
import { usePalette } from '@/src/stores/theme-store';
import { useThemedStyles } from '@/src/theme/use-themed-styles';
import type { AppPalette } from '@/src/theme/app-palette';

const QUICK_NAMES = ['Cash', 'Bank', 'eSewa', 'Khalti'] as const;

function createBankForm(bank?: BankAccount | null) {
  return {
    name: bank?.name ?? '',
    accountNumber: bank?.accountNumber ?? '',
    openingBalance: String(bank?.openingBalance ?? 0),
    showDetails: Boolean(bank?.accountNumber),
  };
}

function getAccountVisual(bankName: string, colors: AppPalette) {
  const normalized = bankName.toLowerCase();
  if (normalized.includes('cash')) {
    return { icon: 'cash' as const, color: colors.success, backgroundColor: colors.successSoft };
  }
  if (normalized.includes('ime') || normalized.includes('esewa') || normalized.includes('khalti') || normalized.includes('pay')) {
    return { icon: 'wallet-outline' as const, color: colors.warning, backgroundColor: colors.warningSoft };
  }
  return { icon: 'bank-outline' as const, color: colors.primary, backgroundColor: colors.accentSoft };
}

export default function BanksScreen() {
  const colors = usePalette();
  const styles = useThemedStyles(createStyles);
  const queryClient = useQueryClient();
  const currency = useAuthStore((state) => state.businessProfile?.currencyCode) || 'NPR';
  const { data, isRefetching, refetch } = useBanks();
  const [sheetVisible, setSheetVisible] = useState(false);
  const [editingBank, setEditingBank] = useState<BankAccount | null>(null);
  const [form, setForm] = useState(createBankForm());
  const [saving, setSaving] = useState(false);
  const [adjustingBank, setAdjustingBank] = useState<BankAccount | null>(null);
  const [adjustAmount, setAdjustAmount] = useState('');

  const accounts = data ?? [];
  const totalBalance = useMemo(
    () => accounts.reduce((sum, bank) => sum + Number(bank.currentBalance ?? 0), 0),
    [accounts],
  );

  function openCreate() {
    setEditingBank(null);
    setForm(createBankForm());
    setSheetVisible(true);
  }

  function openEdit(bank: BankAccount) {
    setEditingBank(bank);
    setForm(createBankForm(bank));
    setSheetVisible(true);
  }

  function openAdjust(bank: BankAccount) {
    setAdjustingBank(bank);
    setAdjustAmount(String(bank.currentBalance ?? 0));
  }

  async function handleSave() {
    const name = form.name.trim();
    if (!name) {
      Alert.alert('Name required', 'Give this account a short name, like Cash or Nabil.');
      return;
    }

    const opening = Number(form.openingBalance || 0);
    const body = {
      name,
      accountName: name,
      accountNumber: form.accountNumber.trim() || undefined,
      openingBalance: editingBank ? Number(editingBank.openingBalance ?? opening) : opening,
      currentBalance: editingBank ? Number(editingBank.currentBalance ?? 0) : opening,
      isActive: editingBank?.isActive ?? true,
    };

    setSaving(true);
    try {
      const response = await withWorkspaceRetry(() =>
        submitWithOfflineQueue<BankAccount, typeof body>({
          entityType: 'bank',
          method: editingBank ? 'PUT' : 'POST',
          path: editingBank ? `/api/banks/${editingBank.id}` : '/api/banks',
          body,
        }),
      );
      await cacheBankRecord({
        id: response.data?.id ?? editingBank?.id ?? generateId('bank'),
        ...body,
        isActive: body.isActive,
      });
      await queryClient.invalidateQueries({ queryKey: ['banks'] });
      setSheetVisible(false);
    } catch (error) {
      Alert.alert('Unable to save account', workspaceAccessMessage(error, 'Please try again.'));
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete() {
    if (!editingBank?.id) return;
    Alert.alert('Remove account', `Remove ${editingBank.name}? This does not delete past transactions.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setSaving(true);
            try {
              await withWorkspaceRetry(() => banksApi.remove(editingBank.id));
              await queryClient.invalidateQueries({ queryKey: ['banks'] });
              setSheetVisible(false);
            } catch (error) {
              Alert.alert('Unable to remove', workspaceAccessMessage(error, 'Please try again.'));
            } finally {
              setSaving(false);
            }
          })();
        },
      },
    ]);
  }

  async function saveAdjustedBalance() {
    if (!adjustingBank) return;
    const nextBalance = Number(adjustAmount || 0);
    setSaving(true);
    try {
      await withWorkspaceRetry(() =>
        submitWithOfflineQueue({
          entityType: 'bank',
          method: 'PUT',
          path: `/api/banks/${adjustingBank.id}`,
          body: {
            name: adjustingBank.name,
            accountName: adjustingBank.accountName || adjustingBank.name,
            accountNumber: adjustingBank.accountNumber,
            branchName: adjustingBank.branchName,
            openingBalance: adjustingBank.openingBalance ?? 0,
            currentBalance: nextBalance,
            isActive: adjustingBank.isActive,
            notes: adjustingBank.notes,
          },
        }),
      );
      await cacheBankRecord({ ...adjustingBank, currentBalance: nextBalance });
      await queryClient.invalidateQueries({ queryKey: ['banks'] });
      setAdjustingBank(null);
    } catch (error) {
      Alert.alert('Unable to update balance', workspaceAccessMessage(error, 'Please try again.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen
      scrollable={false}
      padded={false}
      topBarTitle="Banks"
      footer={<StickyActionBar primary={{ label: 'Add account', onPress: openCreate }} />}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />}
        contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Keep the accounts you actually use. Name and balance are enough.
          </Text>
        </View>

        <View style={[styles.totalCard, { backgroundColor: colors.successSoft, borderColor: colors.border }]}>
          <Text style={[styles.totalLabel, { color: colors.success }]}>Together</Text>
          <Text style={[styles.totalValue, { color: colors.success }]}>{formatCurrency(totalBalance, currency)}</Text>
        </View>

        {!accounts.length ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No accounts yet</Text>
            <Text style={[styles.emptyCopy, { color: colors.textMuted }]}>
              Add Cash, a bank, or a wallet. You can set the balance later.
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {accounts.map((bank) => {
              const visual = getAccountVisual(bank.name, colors);
              return (
                <View key={bank.id} style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Pressable style={styles.rowMain} onPress={() => openEdit(bank)}>
                    <View style={[styles.iconWrap, { backgroundColor: visual.backgroundColor }]}>
                      <MaterialCommunityIcons color={visual.color} name={visual.icon} size={22} />
                    </View>
                    <View style={styles.rowCopy}>
                      <Text numberOfLines={1} style={[styles.rowTitle, { color: colors.text }]}>
                        {bank.name}
                      </Text>
                      <Text style={[styles.rowMeta, { color: colors.textMuted }]}>
                        {bank.accountNumber
                          ? `•••• ${String(bank.accountNumber).slice(-4)}`
                          : bank.isActive
                            ? 'Tap to edit'
                            : 'Inactive'}
                      </Text>
                    </View>
                  </Pressable>
                  <View style={styles.rowSide}>
                    <Text style={[styles.rowAmount, { color: colors.text }]}>
                      {formatCurrency(bank.currentBalance ?? 0, currency)}
                    </Text>
                    <Pressable
                      hitSlop={8}
                      onPress={() => openAdjust(bank)}
                      style={[styles.adjustChip, { backgroundColor: colors.backgroundAlt }]}>
                      <Text style={[styles.adjustChipLabel, { color: colors.primary }]}>Set balance</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      <BottomSheet
        visible={sheetVisible}
        title={editingBank ? 'Edit account' : 'New account'}
        subtitle={editingBank ? 'Change the name or number. Use Set balance on the list for the amount.' : 'A name is enough. Add a number only if you want it.'}
        onClose={() => setSheetVisible(false)}
        footer={
          <View style={styles.sheetFooter}>
            {editingBank ? (
              <Pressable style={[styles.deleteButton, { backgroundColor: colors.dangerSoft }]} onPress={confirmDelete} disabled={saving}>
                <Text style={[styles.deleteLabel, { color: colors.danger }]}>Remove</Text>
              </Pressable>
            ) : null}
            <Pressable
              style={[styles.saveButton, { backgroundColor: colors.primary, flex: 1.4 }]}
              onPress={() => void handleSave()}
              disabled={saving}>
              {saving ? <ActivityIndicator color={colors.white} /> : <Text style={[styles.saveLabel, { color: colors.white }]}>{editingBank ? 'Save' : 'Add account'}</Text>}
            </Pressable>
          </View>
        }>
        {!editingBank ? (
          <View style={styles.chipWrap}>
            {QUICK_NAMES.map((name) => {
              const active = form.name === name;
              return (
                <Pressable
                  key={name}
                  style={[styles.chip, { backgroundColor: active ? colors.primary : colors.backgroundAlt, borderColor: active ? colors.primary : colors.border }]}
                  onPress={() => setForm((current) => ({ ...current, name }))}>
                  <Text style={[styles.chipLabel, { color: active ? colors.white : colors.text }]}>{name}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
        <FormField
          label="Name"
          value={form.name}
          onChangeText={(name) => setForm((current) => ({ ...current, name }))}
          placeholder="Cash, Nabil, eSewa"
          autoCapitalize="words"
        />
        {!editingBank ? (
          <FormField
            label="Opening balance"
            value={form.openingBalance}
            onChangeText={(openingBalance) => setForm((current) => ({ ...current, openingBalance }))}
            keyboardType="numeric"
            placeholder="0"
          />
        ) : null}
        {form.showDetails ? (
          <FormField
            label="Account number"
            value={form.accountNumber}
            onChangeText={(accountNumber) => setForm((current) => ({ ...current, accountNumber }))}
            keyboardType="number-pad"
            placeholder="Optional"
          />
        ) : (
          <Pressable onPress={() => setForm((current) => ({ ...current, showDetails: true }))}>
            <Text style={[styles.moreLink, { color: colors.primary }]}>Add account number</Text>
          </Pressable>
        )}
      </BottomSheet>

      <BottomSheet
        visible={Boolean(adjustingBank)}
        title="Set balance"
        subtitle={adjustingBank ? `Update what ${adjustingBank.name} shows today.` : undefined}
        onClose={() => setAdjustingBank(null)}
        footer={
          <Pressable style={[styles.saveButton, { backgroundColor: colors.primary }]} onPress={() => void saveAdjustedBalance()} disabled={saving}>
            {saving ? <ActivityIndicator color={colors.white} /> : <Text style={[styles.saveLabel, { color: colors.white }]}>Save balance</Text>}
          </Pressable>
        }>
        <FormField label="Current balance" value={adjustAmount} onChangeText={setAdjustAmount} keyboardType="numeric" />
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
    hero: {
      gap: spacing.xs,
    },
    title: {
      fontSize: typography.heading,
      fontWeight: '800',
    },
    subtitle: {
      fontSize: typography.body,
      lineHeight: 22,
    },
    totalCard: {
      borderRadius: radius.md,
      borderWidth: 1,
      padding: spacing.md,
    },
    totalLabel: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    totalValue: {
      marginTop: 4,
      fontSize: typography.heading,
      fontWeight: '800',
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
    rowMain: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    iconWrap: {
      width: 44,
      height: 44,
      borderRadius: 14,
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
    rowMeta: {
      fontSize: typography.caption,
    },
    rowSide: {
      alignItems: 'flex-end',
      gap: 6,
    },
    rowAmount: {
      fontSize: typography.body,
      fontWeight: '800',
    },
    adjustChip: {
      borderRadius: radius.pill,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    adjustChipLabel: {
      fontSize: 11,
      fontWeight: '800',
    },
    emptyCard: {
      borderRadius: radius.lg,
      borderWidth: 1,
      padding: spacing.lg,
      gap: spacing.xs,
    },
    emptyTitle: {
      fontSize: typography.body,
      fontWeight: '800',
    },
    emptyCopy: {
      fontSize: typography.body,
      lineHeight: 22,
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
    },
    deleteLabel: {
      fontSize: typography.body,
      fontWeight: '800',
    },
    saveButton: {
      flex: 1,
      minHeight: 52,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveLabel: {
      fontSize: typography.body,
      fontWeight: '800',
    },
    chipWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    chip: {
      minHeight: 36,
      paddingHorizontal: spacing.md,
      borderRadius: radius.pill,
      borderWidth: 1,
      justifyContent: 'center',
    },
    chipLabel: {
      fontSize: typography.label,
      fontWeight: '700',
    },
    moreLink: {
      fontSize: typography.body,
      fontWeight: '700',
    },
  });
