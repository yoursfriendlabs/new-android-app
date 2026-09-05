import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import { banksApi } from '@/src/api';
import { BottomSheet } from '@/src/shared/feedback/BottomSheet';
import { FormField } from '@/src/shared/forms/FormField';
import { Screen } from '@/src/shared/layout/Screen';
import { StickyActionBar } from '@/src/shared/ui/StickyActionBar';
import { cacheBankRecord } from '@/src/data/cache';
import { submitWithOfflineQueue } from '@/src/data/sync';
import { formatCurrency, prettyDate } from '@/src/shared/lib/format';
import { generateId } from '@/src/shared/lib/id';
import { workspaceAccessMessage } from '@/src/shared/lib/workspace';
import { withWorkspaceRetry } from '@/src/shared/lib/workspace-retry';
import {
  useBanks,
  usePartyTransactions,
  usePurchases,
  useSalesList,
} from '@/src/shared/hooks/useAppQueries';
import { radius, shadows, spacing, typography } from '@/src/theme';
import type { BankAccount, PartyTransaction, Purchase, Sale } from '@/src/types/models';
import { useAuthStore } from '@/src/stores/auth-store';
import { usePalette } from '@/src/stores/theme-store';
import { useThemedStyles } from '@/src/theme/use-themed-styles';
import type { AppPalette } from '@/src/theme/app-palette';
import {
  buildExpenseReceipt,
  buildPartyTransactionReceipt,
  buildSaleReceipt,
  openReceiptPreview,
} from '@/src/shared/lib/receipt';

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
  const normalized = (bankName || '').toLowerCase();
  if (normalized.includes('cash')) {
    return {
      icon: 'cash' as const,
      color: colors.success,
      backgroundColor: colors.successSoft,
      typeLabel: 'Cash in Hand',
    };
  }
  if (
    normalized.includes('ime') ||
    normalized.includes('esewa') ||
    normalized.includes('khalti') ||
    normalized.includes('pay') ||
    normalized.includes('wallet')
  ) {
    return {
      icon: 'wallet-outline' as const,
      color: colors.warning,
      backgroundColor: colors.warningSoft,
      typeLabel: 'Digital Wallet',
    };
  }
  return {
    icon: 'bank-outline' as const,
    color: colors.primary,
    backgroundColor: colors.accentSoft,
    typeLabel: 'Bank Account',
  };
}

export interface BankTxItem {
  id: string;
  source: 'party_tx' | 'purchase' | 'sale';
  date: string;
  direction: 'in' | 'out';
  type: string;
  partyName: string;
  note: string;
  amount: number;
  raw: PartyTransaction | Purchase | Sale;
}

export default function BanksScreen() {
  const router = useRouter();
  const colors = usePalette();
  const styles = useThemedStyles(createStyles);
  const queryClient = useQueryClient();
  const businessProfile = useAuthStore((state) => state.businessProfile);
  const currency = businessProfile?.currencyCode || 'NPR';

  const { data, isRefetching, refetch } = useBanks();
  const partyTxQuery = usePartyTransactions();
  const purchasesQuery = usePurchases();
  const salesQuery = useSalesList();

  const accounts = data ?? [];
  const totalBalance = useMemo(
    () => accounts.reduce((sum, bank) => sum + Number(bank.currentBalance ?? 0), 0),
    [accounts]
  );

  const [sheetVisible, setSheetVisible] = useState(false);
  const [editingBank, setEditingBank] = useState<BankAccount | null>(null);
  const [form, setForm] = useState(createBankForm());
  const [saving, setSaving] = useState(false);
  const [adjustingBank, setAdjustingBank] = useState<BankAccount | null>(null);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjusting, setAdjusting] = useState(false);
  const [selectedBank, setSelectedBank] = useState<BankAccount | null>(null);
  const [txSearch, setTxSearch] = useState('');

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

  function openBankDetail(bank: BankAccount) {
    setSelectedBank(bank);
    setTxSearch('');
  }

  // Aggregate transactions for the selected bank/wallet
  const bankTransactions = useMemo(() => {
    if (!selectedBank) return [];
    const bId = selectedBank.id;
    const isCashAccount = (selectedBank.name || '').toLowerCase().includes('cash');

    const list: BankTxItem[] = [];

    // 1. Party Transactions
    for (const pt of partyTxQuery.data ?? []) {
      const match =
        pt.bankId === bId ||
        (!pt.bankId && isCashAccount && pt.paymentMethod === 'cash');
      if (match) {
        list.push({
          id: `pt-${pt.id}`,
          source: 'party_tx',
          date: pt.txDate ? String(pt.txDate) : pt.createdAt ? String(pt.createdAt) : '',
          direction: pt.direction === 'receive' ? 'in' : 'out',
          type: pt.direction === 'receive' ? 'Received (Income)' : 'Paid (Expense)',
          partyName: (pt as any).partyName ? String((pt as any).partyName) : 'Contact',
          note: pt.note ? String(pt.note) : '',
          amount: Number(pt.amount || 0),
          raw: pt,
        });
      }
    }

    // 2. Purchases & Expenses
    for (const pu of purchasesQuery.data ?? []) {
      const match =
        pu.bankId === bId ||
        (!pu.bankId && isCashAccount && pu.paymentMethod === 'cash');
      if (match) {
        list.push({
          id: `pu-${pu.id}`,
          source: 'purchase',
          date: pu.purchaseDate ? String(pu.purchaseDate) : pu.createdAt ? String(pu.createdAt) : '',
          direction: 'out',
          type: pu.entryType === 'expense' ? 'Expense' : 'Purchase',
          partyName: pu.partyName ? String(pu.partyName) : 'Vendor / Expense',
          note: pu.notes ? String(pu.notes) : pu.invoiceNo ? String(pu.invoiceNo) : '',
          amount: Number(pu.amountReceived || pu.grandTotal || 0),
          raw: pu,
        });
      }
    }

    // 3. Sales
    for (const s of salesQuery.data ?? []) {
      const match =
        s.bankId === bId ||
        (!s.bankId && isCashAccount && s.paymentMethod === 'cash');
      if (match) {
        list.push({
          id: `s-${s.id}`,
          source: 'sale',
          date: s.saleDate ? String(s.saleDate) : s.createdAt ? String(s.createdAt) : '',
          direction: 'in',
          type: 'Sale Bill',
          partyName: (s as any).party?.name ? String((s as any).party.name) : s.partyName ? String(s.partyName) : 'Customer',
          note: s.invoiceNo ? String(s.invoiceNo) : '',
          amount: Number(s.amountReceived || s.grandTotal || 0),
          raw: s,
        });
      }
    }

    // Sort by date desc
    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [selectedBank, partyTxQuery.data, purchasesQuery.data, salesQuery.data]);

  const filteredBankTransactions = useMemo(() => {
    if (!txSearch.trim()) return bankTransactions;
    const q = txSearch.toLowerCase().trim();
    return bankTransactions.filter(
      (tx) =>
        tx.partyName.toLowerCase().includes(q) ||
        tx.note.toLowerCase().includes(q) ||
        tx.type.toLowerCase().includes(q)
    );
  }, [bankTransactions, txSearch]);

  const handleTransactionBill = (item: BankTxItem) => {
    if (item.source === 'party_tx') {
      const receipt = buildPartyTransactionReceipt(
        item.raw as PartyTransaction,
        null,
        businessProfile,
        selectedBank?.name
      );
      openReceiptPreview(router, receipt.input, receipt.html);
    } else if (item.source === 'purchase') {
      const receipt = buildExpenseReceipt(
        item.raw as Purchase,
        businessProfile,
        selectedBank?.name
      );
      openReceiptPreview(router, receipt.input, receipt.html);
    } else if (item.source === 'sale') {
      const receipt = buildSaleReceipt(
        item.raw as Sale,
        businessProfile,
        selectedBank?.name
      );
      openReceiptPreview(router, receipt.input, receipt.html);
    }
  };

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
        })
      );
      await cacheBankRecord({
        id: response.data?.id ?? editingBank?.id ?? generateId('bank'),
        ...body,
        isActive: body.isActive,
      });
      await queryClient.invalidateQueries({ queryKey: ['banks'] });
      setSheetVisible(false);
      if (selectedBank && editingBank && selectedBank.id === editingBank.id) {
        setSelectedBank({ ...selectedBank, ...body });
      }
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
              if (selectedBank?.id === editingBank.id) {
                setSelectedBank(null);
              }
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
        })
      );
      await cacheBankRecord({ ...adjustingBank, currentBalance: nextBalance });
      await queryClient.invalidateQueries({ queryKey: ['banks'] });
      if (selectedBank && selectedBank.id === adjustingBank.id) {
        setSelectedBank({ ...selectedBank, currentBalance: nextBalance });
      }
      setAdjustingBank(null);
    } catch (error) {
      Alert.alert('Unable to update balance', workspaceAccessMessage(error, 'Please try again.'));
    } finally {
      setSaving(false);
    }
  }

  async function handleRefreshAll() {
    await Promise.all([
      refetch(),
      partyTxQuery.refetch(),
      purchasesQuery.refetch(),
      salesQuery.refetch(),
    ]);
  }

  return (
    <Screen
      scrollable={false}
      padded={false}
      topBarTitle="Banks & Wallets"
      footer={<StickyActionBar primary={{ label: '+ Add Account', onPress: openCreate }} />}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void handleRefreshAll()} />}
        contentContainerStyle={styles.scroll}
      >
        <View style={styles.hero}>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Track Cash, Bank accounts, and Digital Wallets with realtime balances and transaction logs.
          </Text>
        </View>

        {/* Total Aggregated Balance Hero */}
        <View style={[styles.totalCard, { backgroundColor: colors.successSoft, borderColor: colors.border }]}>
          <Text style={[styles.totalLabel, { color: colors.success }]}>Total Net Balance</Text>
          <Text style={[styles.totalValue, { color: colors.success }]}>{formatCurrency(totalBalance, currency)}</Text>
        </View>

        {!accounts.length ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <MaterialCommunityIcons name="bank-plus" size={40} color={colors.primary} style={{ marginBottom: 8 }} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No accounts added yet</Text>
            <Text style={[styles.emptyCopy, { color: colors.textMuted }]}>
              Add Cash in hand, Bank accounts (Nabil, Global IME), or Wallets (eSewa, Khalti).
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {accounts.map((bank) => {
              const visual = getAccountVisual(bank.name, colors);
              return (
                <Pressable
                  key={bank.id}
                  style={({ pressed }) => [
                    styles.row,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                    pressed && { opacity: 0.9 },
                  ]}
                  onPress={() => openBankDetail(bank)}
                >
                  <View style={styles.rowMain}>
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
                          : visual.typeLabel}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.rowSide}>
                    <Text style={[styles.rowAmount, { color: colors.text }]}>
                      {formatCurrency(bank.currentBalance ?? 0, currency)}
                    </Text>
                    <View style={styles.actionRowBtn}>
                      <Pressable
                        hitSlop={8}
                        onPress={(e) => {
                          e.stopPropagation();
                          openAdjust(bank);
                        }}
                        style={[styles.adjustChip, { backgroundColor: colors.backgroundAlt }]}
                      >
                        <Text style={[styles.adjustChipLabel, { color: colors.primary }]}>Set bal</Text>
                      </Pressable>
                      <Pressable
                        hitSlop={8}
                        onPress={(e) => {
                          e.stopPropagation();
                          openEdit(bank);
                        }}
                        style={[styles.editChip, { backgroundColor: colors.backgroundAlt }]}
                      >
                        <MaterialCommunityIcons name="pencil-outline" size={14} color={colors.textMuted} />
                      </Pressable>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Account Detail & Transaction List Sheet */}
      <BottomSheet
        visible={Boolean(selectedBank)}
        title={selectedBank ? selectedBank.name : 'Account Detail'}
        subtitle={
          selectedBank
            ? `${getAccountVisual(selectedBank.name, colors).typeLabel} • ${formatCurrency(selectedBank.currentBalance ?? 0, currency)}`
            : undefined
        }
        onClose={() => setSelectedBank(null)}
        footer={
          selectedBank ? (
            <View style={styles.detailSheetFooter}>
              <Pressable
                style={[styles.detailActionBtn, { backgroundColor: colors.backgroundAlt }]}
                onPress={() => {
                  if (selectedBank) openAdjust(selectedBank);
                }}
              >
                <MaterialCommunityIcons name="currency-usd" size={18} color={colors.primary} />
                <Text style={[styles.detailActionBtnText, { color: colors.primary }]}>Set Balance</Text>
              </Pressable>

              <Pressable
                style={[styles.detailActionBtn, { backgroundColor: colors.backgroundAlt }]}
                onPress={() => {
                  if (selectedBank) openEdit(selectedBank);
                }}
              >
                <MaterialCommunityIcons name="pencil-outline" size={18} color={colors.text} />
                <Text style={[styles.detailActionBtnText, { color: colors.text }]}>Edit Account</Text>
              </Pressable>
            </View>
          ) : null
        }
      >
        {selectedBank ? (
          <View style={styles.detailContent}>
            {/* Balance Overview Card */}
            <View style={[styles.detailBalanceCard, { backgroundColor: colors.backgroundAlt }]}>
              <View>
                <Text style={[styles.detailCardLabel, { color: colors.textMuted }]}>Current Balance</Text>
                <Text style={[styles.detailCardAmount, { color: colors.text }]}>
                  {formatCurrency(selectedBank.currentBalance ?? 0, currency)}
                </Text>
              </View>
              {selectedBank.accountNumber ? (
                <View style={styles.accountNumberPill}>
                  <Text style={[styles.accountNumberPillText, { color: colors.textMuted }]}>
                    A/C: {selectedBank.accountNumber}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Transactions Header & Search */}
            <View style={styles.txSectionHeader}>
              <Text style={[styles.txSectionTitle, { color: colors.text }]}>
                Transactions ({filteredBankTransactions.length})
              </Text>
            </View>

            <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <MaterialCommunityIcons name="magnify" size={18} color={colors.textMuted} />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                placeholder="Search transactions..."
                placeholderTextColor={colors.textMuted}
                value={txSearch}
                onChangeText={setTxSearch}
              />
              {txSearch ? (
                <Pressable onPress={() => setTxSearch('')} hitSlop={8}>
                  <MaterialCommunityIcons name="close-circle" size={16} color={colors.textMuted} />
                </Pressable>
              ) : null}
            </View>

            {/* Transactions List */}
            {filteredBankTransactions.length > 0 ? (
              <View style={styles.txListContainer}>
                {filteredBankTransactions.map((tx) => (
                  <Pressable
                    key={tx.id}
                    onPress={() => handleTransactionBill(tx)}
                    style={({ pressed }) => [
                      styles.txRowCard,
                      { backgroundColor: colors.surface, borderColor: colors.border },
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <View style={styles.txLeft}>
                      <View
                        style={[
                          styles.txIconDot,
                          {
                            backgroundColor:
                              tx.direction === 'in' ? colors.successSoft : colors.dangerSoft,
                          },
                        ]}
                      >
                        <MaterialCommunityIcons
                          name={tx.direction === 'in' ? 'arrow-down-left' : 'arrow-up-right'}
                          size={16}
                          color={tx.direction === 'in' ? colors.success : colors.danger}
                        />
                      </View>
                      <View style={styles.txTexts}>
                        <Text numberOfLines={1} style={[styles.txParty, { color: colors.text }]}>
                          {tx.partyName}
                        </Text>
                        <Text style={[styles.txMeta, { color: colors.textMuted }]}>
                          {tx.type} • {prettyDate(tx.date)}
                        </Text>
                        {tx.note ? (
                          <Text numberOfLines={1} style={[styles.txNote, { color: colors.textSoft }]}>
                            {tx.note}
                          </Text>
                        ) : null}
                      </View>
                    </View>

                    <View style={styles.txRight}>
                      <Text
                        style={[
                          styles.txAmount,
                          { color: tx.direction === 'in' ? colors.success : colors.danger },
                        ]}
                      >
                        {tx.direction === 'in' ? '+' : '-'}
                        {formatCurrency(tx.amount, currency)}
                      </Text>

                      <View style={[styles.billBtn, { backgroundColor: colors.accentSoft }]}>
                        <MaterialCommunityIcons name="receipt" size={12} color={colors.primary} />
                        <Text style={[styles.billBtnText, { color: colors.primary }]}>Bill / Print</Text>
                      </View>
                    </View>
                  </Pressable>
                ))}
              </View>
            ) : (
              <View style={styles.emptyTxBox}>
                <MaterialCommunityIcons name="text-box-search-outline" size={32} color={colors.textMuted} />
                <Text style={[styles.emptyTxTitle, { color: colors.text }]}>No transactions yet</Text>
                <Text style={[styles.emptyTxSubtitle, { color: colors.textMuted }]}>
                  Transactions recorded using this account will appear here.
                </Text>
              </View>
            )}
          </View>
        ) : null}
      </BottomSheet>

      {/* New / Edit Account Modal */}
      <BottomSheet
        visible={sheetVisible}
        title={editingBank ? 'Edit Account' : 'New Bank / Wallet'}
        subtitle={
          editingBank
            ? 'Change the name or account number.'
            : 'Add Cash, a Bank account (Nabil, Global IME) or a Digital Wallet (eSewa, Khalti).'
        }
        onClose={() => setSheetVisible(false)}
        footer={
          <View style={styles.sheetFooter}>
            {editingBank ? (
              <Pressable
                style={[styles.deleteButton, { backgroundColor: colors.dangerSoft }]}
                onPress={confirmDelete}
                disabled={saving}
              >
                <Text style={[styles.deleteLabel, { color: colors.danger }]}>Remove</Text>
              </Pressable>
            ) : null}
            <Pressable
              style={[styles.saveButton, { backgroundColor: colors.primary, flex: 1.4 }]}
              onPress={() => void handleSave()}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={[styles.saveLabel, { color: colors.white }]}>
                  {editingBank ? 'Save Changes' : 'Add Account'}
                </Text>
              )}
            </Pressable>
          </View>
        }
      >
        {!editingBank ? (
          <View style={styles.chipWrap}>
            {QUICK_NAMES.map((name) => {
              const active = form.name === name;
              return (
                <Pressable
                  key={name}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: active ? colors.primary : colors.backgroundAlt,
                      borderColor: active ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => setForm((current) => ({ ...current, name }))}
                >
                  <Text style={[styles.chipLabel, { color: active ? colors.white : colors.text }]}>{name}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
        <FormField
          label="Account Name"
          value={form.name}
          onChangeText={(name) => setForm((current) => ({ ...current, name }))}
          placeholder="e.g. Nabil Bank, eSewa, Cash"
          autoCapitalize="words"
        />
        {!editingBank ? (
          <FormField
            label="Opening Balance"
            value={form.openingBalance}
            onChangeText={(openingBalance) => setForm((current) => ({ ...current, openingBalance }))}
            keyboardType="numeric"
            placeholder="0"
          />
        ) : null}
        {form.showDetails ? (
          <FormField
            label="Account Number / Phone"
            value={form.accountNumber}
            onChangeText={(accountNumber) => setForm((current) => ({ ...current, accountNumber }))}
            keyboardType="number-pad"
            placeholder="Optional account or wallet number"
          />
        ) : (
          <Pressable onPress={() => setForm((current) => ({ ...current, showDetails: true }))}>
            <Text style={[styles.moreLink, { color: colors.primary }]}>+ Add account number / ID</Text>
          </Pressable>
        )}
      </BottomSheet>

      {/* Set Balance Sheet */}
      <BottomSheet
        visible={Boolean(adjustingBank)}
        title="Set Current Balance"
        subtitle={adjustingBank ? `Update current balance for ${adjustingBank.name}` : undefined}
        onClose={() => setAdjustingBank(null)}
        footer={
          <Pressable
            style={[styles.saveButton, { backgroundColor: colors.primary }]}
            onPress={() => void saveAdjustedBalance()}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={[styles.saveLabel, { color: colors.white }]}>Save Balance</Text>
            )}
          </Pressable>
        }
      >
        <FormField
          label="Current Balance Amount"
          value={adjustAmount}
          onChangeText={setAdjustAmount}
          keyboardType="numeric"
          placeholder="0"
          autoFocus
        />
      </BottomSheet>
    </Screen>
  );
}

const createStyles = (colors: AppPalette) =>
  StyleSheet.create({
    scroll: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: 100,
      gap: spacing.md,
    },
    hero: {
      gap: 4,
    },
    subtitle: {
      fontSize: typography.caption,
      lineHeight: 18,
    },
    totalCard: {
      borderRadius: radius.lg,
      borderWidth: 1,
      padding: spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    totalLabel: {
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    totalValue: {
      fontSize: 24,
      fontWeight: '800',
      marginTop: 2,
    },
    list: {
      gap: spacing.xs + 2,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderRadius: radius.md,
      borderWidth: 1,
      padding: spacing.md,
      ...shadows.card,
    },
    rowMain: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      flex: 1,
    },
    iconWrap: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowCopy: {
      flex: 1,
      gap: 2,
    },
    rowTitle: {
      fontSize: typography.body,
      fontWeight: '800',
    },
    rowMeta: {
      fontSize: 11,
    },
    rowSide: {
      alignItems: 'flex-end',
      gap: 6,
    },
    rowAmount: {
      fontSize: typography.body,
      fontWeight: '800',
    },
    actionRowBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    adjustChip: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radius.sm,
    },
    adjustChipLabel: {
      fontSize: 10,
      fontWeight: '700',
    },
    editChip: {
      padding: 4,
      borderRadius: radius.sm,
    },
    emptyCard: {
      borderRadius: radius.lg,
      borderWidth: 1,
      padding: spacing.xl,
      alignItems: 'center',
      marginVertical: spacing.md,
    },
    emptyTitle: {
      fontSize: typography.body,
      fontWeight: '800',
      marginBottom: 4,
    },
    emptyCopy: {
      fontSize: typography.caption,
      textAlign: 'center',
      lineHeight: 18,
    },
    detailContent: {
      gap: spacing.sm,
    },
    detailBalanceCard: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: spacing.md,
      borderRadius: radius.md,
    },
    detailCardLabel: {
      fontSize: 11,
      fontWeight: '600',
    },
    detailCardAmount: {
      fontSize: 20,
      fontWeight: '800',
      marginTop: 2,
    },
    accountNumberPill: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: radius.sm,
      backgroundColor: 'rgba(0,0,0,0.05)',
    },
    accountNumberPillText: {
      fontSize: 11,
      fontWeight: '700',
    },
    txSectionHeader: {
      marginTop: spacing.xs,
    },
    txSectionTitle: {
      fontSize: typography.label,
      fontWeight: '800',
    },
    searchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderRadius: radius.md,
      paddingHorizontal: spacing.sm,
      paddingVertical: 6,
      gap: 6,
    },
    searchInput: {
      flex: 1,
      fontSize: 13,
      paddingVertical: 0,
    },
    txListContainer: {
      gap: spacing.xs,
      marginTop: 4,
    },
    txRowCard: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: spacing.sm,
      borderRadius: radius.md,
      borderWidth: 1,
    },
    txLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs + 2,
      flex: 1,
    },
    txIconDot: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    txTexts: {
      flex: 1,
      gap: 1,
    },
    txParty: {
      fontSize: typography.label,
      fontWeight: '700',
    },
    txMeta: {
      fontSize: 10,
    },
    txNote: {
      fontSize: 10,
    },
    txRight: {
      alignItems: 'flex-end',
      gap: 4,
    },
    txAmount: {
      fontSize: typography.label,
      fontWeight: '800',
    },
    billBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: radius.sm,
      gap: 3,
    },
    billBtnText: {
      fontSize: 9,
      fontWeight: '800',
    },
    emptyTxBox: {
      alignItems: 'center',
      paddingVertical: spacing.xl,
      gap: 6,
    },
    emptyTxTitle: {
      fontSize: typography.label,
      fontWeight: '800',
    },
    emptyTxSubtitle: {
      fontSize: typography.caption,
      textAlign: 'center',
    },
    detailSheetFooter: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    detailActionBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.sm + 2,
      borderRadius: radius.md,
      gap: 6,
    },
    detailActionBtnText: {
      fontSize: typography.label,
      fontWeight: '700',
    },
    chipWrap: {
      flexDirection: 'row',
      gap: spacing.xs,
      flexWrap: 'wrap',
      marginBottom: spacing.sm,
    },
    chip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radius.pill,
      borderWidth: 1,
    },
    chipLabel: {
      fontSize: typography.caption,
      fontWeight: '700',
    },
    moreLink: {
      fontSize: typography.caption,
      fontWeight: '700',
      paddingVertical: spacing.xs,
    },
    sheetFooter: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    deleteButton: {
      flex: 1,
      minHeight: 46,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    deleteLabel: {
      fontSize: typography.label,
      fontWeight: '800',
    },
    saveButton: {
      minHeight: 46,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveLabel: {
      fontSize: typography.label,
      fontWeight: '800',
    },
  });
