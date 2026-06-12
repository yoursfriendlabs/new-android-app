import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { isInvalidSessionError } from '@/src/api/client';
import { partiesApi, partyTransactionsApi } from '@/src/api';
import { cachePartyRecord } from '@/src/data/cache';
import { generateId } from '@/src/lib/id';
import { todayIso } from '@/src/lib/format';
import { BottomSheet } from '@/src/components/feedback/BottomSheet';
import { FormField } from '@/src/components/forms/FormField';
import { PartyPickerSheet } from '@/src/components/forms/PartyPickerSheet';
import { PaymentMethodSelector } from '@/src/components/forms/PaymentMethodSelector';
import { Screen } from '@/src/components/layout/Screen';
import { SearchField } from '@/src/components/ui/SearchField';
import { PageHeading } from '@/src/components/ui/PageHeading';
import { SegmentedTabs } from '@/src/components/ui/SegmentedTabs';
import { SurfaceCard } from '@/src/components/ui/SurfaceCard';
import { StickyActionBar } from '@/src/components/ui/StickyActionBar';
import { formatCurrency, prettyDate } from '@/src/lib/format';
import { useDebouncedValue } from '@/src/hooks/useDebouncedValue';
import {
  useBanks,
  useParties,
  usePartyById,
  usePartyDetailReport,
  usePartyStatement,
  usePartyTransactions,
} from '@/src/hooks/useAppQueries';
import { palette, radius, spacing, typography } from '@/src/theme';
import type { Party, PartyTransaction } from '@/src/types/models';

function createPartyForm() {
  return {
    name: '',
    phone: '',
    email: '',
    address: '',
    type: 'customer',
    openingBalance: '0',
    balanceType: 'receive',
  };
}

function createTransactionForm(party: Party | null = null) {
  return {
    party,
    direction: 'receive' as PartyTransaction['direction'],
    amount: '0',
    txDate: todayIso(),
    paymentMethod: 'cash' as PartyTransaction['paymentMethod'],
    bankId: '',
    note: '',
  };
}

export default function PartiesScreen() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [type, setType] = useState<'customer' | 'supplier' | 'both'>('both');
  const [sheetVisible, setSheetVisible] = useState(false);
  const [editingParty, setEditingParty] = useState<Party | null>(null);
  const [form, setForm] = useState(createPartyForm());
  const [message, setMessage] = useState('');
  const [transactionSheetVisible, setTransactionSheetVisible] = useState(false);
  const [editingTransaction, setEditingTransaction] =
    useState<PartyTransaction | null>(null);
  const [transactionForm, setTransactionForm] = useState(createTransactionForm());
  const [transactionError, setTransactionError] = useState('');
  const [transactionPartySearch, setTransactionPartySearch] = useState('');
  const [transactionPartyPickerVisible, setTransactionPartyPickerVisible] =
    useState(false);
  const debouncedSearch = useDebouncedValue(search);
  const debouncedTransactionPartySearch =
    useDebouncedValue(transactionPartySearch);
  const { data: parties } = useParties(debouncedSearch, type);
  const { data: transactionParties } = useParties(
    debouncedTransactionPartySearch,
    'both',
  );
  const { data: banks } = useBanks();
  const activeBanks = useMemo(
    () => (banks ?? []).filter((bank) => bank.isActive),
    [banks],
  );
  const { data: partyDetail } = usePartyById(editingParty?.id);
  const { data: partyStatement } = usePartyStatement(editingParty?.id);
  const { data: partyReport } = usePartyDetailReport(editingParty?.id);
  const { data: partyTransactions } = usePartyTransactions(editingParty?.id);

  const orderedParties = useMemo(() => parties ?? [], [parties]);
  const summaryBits = useMemo(() => {
    if (!partyReport) return [];
    return Object.entries(partyReport.summary ?? {})
      .slice(0, 4)
      .map(([key, value]) => `${key}: ${String(value)}`);
  }, [partyReport]);

  function openSheet(party?: Party) {
    setEditingParty(party ?? null);
    setForm({
      name: party?.name ?? '',
      phone: party?.phone ?? '',
      email: String(party?.email ?? ''),
      address: String(party?.address ?? ''),
      type: String(party?.type ?? 'customer'),
      openingBalance: String(party?.openingBalance ?? 0),
      balanceType: String(party?.balanceType ?? 'receive'),
    });
    setSheetVisible(true);
  }

  function openTransactionSheet(transaction?: PartyTransaction) {
    const defaultParty =
      transaction?.partyId && transaction.partyId !== editingParty?.id
        ? (transactionParties ?? orderedParties).find(
            (party) => party.id === transaction.partyId,
          ) ?? editingParty
        : editingParty;

    setEditingTransaction(transaction ?? null);
    setTransactionError('');
    setTransactionForm({
      party: defaultParty ?? null,
      direction: transaction?.direction ?? 'receive',
      amount: String(transaction?.amount ?? 0),
      txDate: transaction?.txDate ?? todayIso(),
      paymentMethod: transaction?.paymentMethod ?? 'cash',
      bankId: String(transaction?.bankId ?? ''),
      note: String(transaction?.note ?? ''),
    });
    setTransactionSheetVisible(true);
  }

  async function invalidatePartyData(partyIds: string[]) {
    const uniquePartyIds = Array.from(new Set(partyIds.filter(Boolean)));
    const invalidations: Array<Promise<unknown>> = [
      queryClient.invalidateQueries({ queryKey: ['parties'] }),
      queryClient.invalidateQueries({ queryKey: ['party-report'] }),
    ];

    uniquePartyIds.forEach((partyId) => {
      invalidations.push(
        queryClient.invalidateQueries({ queryKey: ['party', partyId] }),
        queryClient.invalidateQueries({
          queryKey: ['party-detail-report', partyId],
        }),
        queryClient.invalidateQueries({ queryKey: ['party-statement', partyId] }),
        queryClient.invalidateQueries({
          queryKey: ['party-transactions', partyId],
        }),
      );
    });

    await Promise.all(invalidations);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      setMessage('Party name is required.');
      return;
    }

    setMessage('');
    const payload = {
      name: form.name,
      phone: form.phone || undefined,
      email: form.email || undefined,
      address: form.address || undefined,
      type: form.type,
      openingBalance: Number(form.openingBalance || 0),
      balanceType: form.balanceType,
    };

    try {
      const response = editingParty?.id
        ? await partiesApi.update(editingParty.id, payload)
        : await partiesApi.create(payload);

      const normalizedParty = {
        id: (response as Party).id ?? editingParty?.id ?? generateId('party'),
        ...payload,
        receiveBalance: editingParty?.receiveBalance ?? 0,
        giveBalance: editingParty?.giveBalance ?? 0,
      } as Party;

      await cachePartyRecord(normalizedParty);
      await invalidatePartyData([editingParty?.id ?? normalizedParty.id]);
      setForm(createPartyForm());
      setSheetVisible(false);
      setMessage(editingParty ? 'Party updated.' : 'Party created.');
    } catch (error) {
      if (isInvalidSessionError(error)) {
        return;
      }

      setMessage(error instanceof Error ? error.message : 'Unable to save the party.');
    }
  }

  async function handleDelete() {
    if (!editingParty?.id) return;
    setMessage('');

    try {
      await partiesApi.remove(editingParty.id);
      await invalidatePartyData([editingParty.id]);
      setSheetVisible(false);
      setEditingParty(null);
      setMessage('Party removed.');
    } catch (error) {
      if (isInvalidSessionError(error)) {
        return;
      }

      setMessage(error instanceof Error ? error.message : 'Unable to remove the party.');
    }
  }

  async function saveTransaction() {
    if (!transactionForm.party?.id) {
      setTransactionError('Choose the customer or supplier for this transaction.');
      return;
    }

    if (Number(transactionForm.amount || 0) <= 0) {
      setTransactionError('Enter an amount greater than zero.');
      return;
    }

    if (
      transactionForm.paymentMethod === 'bank' &&
      !transactionForm.bankId.trim()
    ) {
      setTransactionError('Choose the bank account used for this transaction.');
      return;
    }

    setTransactionError('');
    const payload = {
      partyId: transactionForm.party.id,
      direction: transactionForm.direction,
      amount: Number(transactionForm.amount || 0),
      txDate: transactionForm.txDate,
      paymentMethod: transactionForm.paymentMethod,
      bankId:
        transactionForm.paymentMethod === 'bank'
          ? transactionForm.bankId || undefined
          : undefined,
      note: transactionForm.note || undefined,
    };

    try {
      if (editingTransaction?.id) {
        await partyTransactionsApi.update(editingTransaction.id, payload);
      } else {
        await partyTransactionsApi.create(payload);
      }

      await invalidatePartyData([
        editingParty?.id ?? '',
        editingTransaction?.partyId ?? '',
        payload.partyId,
      ]);
      setTransactionSheetVisible(false);
      setEditingTransaction(null);
      setTransactionForm(createTransactionForm(editingParty));
      setTransactionPartySearch('');
      setMessage(
        editingTransaction
          ? 'Party transaction updated.'
          : 'Party transaction recorded.',
      );
    } catch (error) {
      if (isInvalidSessionError(error)) {
        return;
      }

      setTransactionError(
        error instanceof Error
          ? error.message
          : 'Unable to save the party transaction.',
      );
    }
  }

  return (
    <Screen
      footer={<StickyActionBar primary={{ label: 'New party', onPress: () => openSheet() }} />}>
      <PageHeading
        title="Parties"
        subtitle="Keep this fast on mobile: add a party, search them quickly, and correct dues or transactions from one place."
      />
      {message ? (
        <SurfaceCard>
          <Text style={styles.message}>{message}</Text>
        </SurfaceCard>
      ) : null}
      <SearchField
        placeholder="Search by name or phone"
        value={search}
        onChangeText={setSearch}
      />
      <SegmentedTabs
        value={type}
        onChange={setType}
        options={[
          { label: 'All', value: 'both' },
          { label: 'Customers', value: 'customer' },
          { label: 'Suppliers', value: 'supplier' },
        ]}
      />
      <View style={styles.list}>
        {orderedParties.map((party) => (
          <SurfaceCard key={party.id} onPress={() => openSheet(party)}>
            <View style={styles.row}>
              <View style={styles.copy}>
                <Text style={styles.title}>{party.name}</Text>
                <Text style={styles.meta}>
                  {[party.phone, party.type].filter(Boolean).join('  •  ')}
                </Text>
              </View>
              <View style={styles.amountWrap}>
                <Text style={styles.amount}>
                  {formatCurrency(
                    party.receiveBalance ?? party.giveBalance ?? party.balance ?? 0,
                  )}
                </Text>
                <Text style={styles.meta}>
                  {(party.receiveBalance ?? 0) > 0
                    ? 'To receive'
                    : (party.giveBalance ?? 0) > 0
                      ? 'To give'
                      : 'Clear'}
                </Text>
              </View>
            </View>
          </SurfaceCard>
        ))}
      </View>

      <BottomSheet
        visible={sheetVisible}
        title={editingParty ? 'Party details' : 'Create party'}
        subtitle="Create, edit, or review statement details without leaving the party screen."
        onClose={() => setSheetVisible(false)}
        fullHeight
        footer={
          <View style={styles.footerActions}>
            {editingParty?.id ? (
              <Pressable
                style={styles.secondaryButton}
                onPress={() => void handleDelete()}>
                <Text style={styles.secondaryLabel}>Delete</Text>
              </Pressable>
            ) : null}
            <Pressable style={styles.primaryButton} onPress={() => void handleSave()}>
              <Text style={styles.primaryLabel}>
                {editingParty ? 'Save party' : 'Create party'}
              </Text>
            </Pressable>
          </View>
        }>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.sheetContent}>
          <FormField
            label="Name"
            value={form.name}
            onChangeText={(name) => setForm((current) => ({ ...current, name }))}
          />
          <FormField
            label="Phone"
            value={form.phone}
            onChangeText={(phone) => setForm((current) => ({ ...current, phone }))}
            keyboardType="numeric"
          />
          <FormField
            label="Email"
            value={form.email}
            onChangeText={(email) => setForm((current) => ({ ...current, email }))}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <FormField
            label="Address"
            value={form.address}
            onChangeText={(address) =>
              setForm((current) => ({ ...current, address }))
            }
            multiline
          />
          <SegmentedTabs
            value={form.type as 'customer' | 'supplier'}
            onChange={(value) => setForm((current) => ({ ...current, type: value }))}
            options={[
              { label: 'Customer', value: 'customer' },
              { label: 'Supplier', value: 'supplier' },
            ]}
          />
          <FormField
            label="Opening balance"
            value={form.openingBalance}
            onChangeText={(openingBalance) =>
              setForm((current) => ({ ...current, openingBalance }))
            }
            keyboardType="numeric"
          />
          <SegmentedTabs
            value={form.balanceType as 'receive' | 'give'}
            onChange={(balanceType) =>
              setForm((current) => ({ ...current, balanceType }))
            }
            options={[
              { label: 'To receive', value: 'receive' },
              { label: 'To give', value: 'give' },
            ]}
          />

          {editingParty?.id ? (
            <>
              <SurfaceCard
                title="Current balances"
                subtitle={
                  partyDetail?.phone ||
                  partyDetail?.email ||
                  'Live party record from the backend.'
                }>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>To receive</Text>
                  <Text style={styles.summaryValue}>
                    {formatCurrency(Number(partyDetail?.receiveBalance ?? 0))}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>To give</Text>
                  <Text style={styles.summaryValue}>
                    {formatCurrency(Number(partyDetail?.giveBalance ?? 0))}
                  </Text>
                </View>
              </SurfaceCard>

              <SurfaceCard
                title="Transactions"
                subtitle="Tap any row to correct party, direction, payment method, bank, amount, or date."
                right={
                  <Pressable onPress={() => openTransactionSheet()}>
                    <Text style={styles.link}>Add</Text>
                  </Pressable>
                }>
                <View style={styles.list}>
                  {(partyTransactions ?? []).slice(0, 8).map((transaction) => (
                    <Pressable
                      key={transaction.id}
                      style={styles.statementRow}
                      onPress={() => openTransactionSheet(transaction)}>
                      <View style={styles.copy}>
                        <Text style={styles.title}>
                          {transaction.direction === 'receive'
                            ? 'Payment in'
                            : 'Payment out'}
                        </Text>
                        <Text style={styles.meta}>
                          {[
                            prettyDate(transaction.txDate),
                            transaction.paymentMethod === 'bank'
                              ? 'Bank'
                              : 'Cash',
                          ]
                            .filter(Boolean)
                            .join('  •  ')}
                        </Text>
                        {transaction.note ? (
                          <Text style={styles.helperText}>{transaction.note}</Text>
                        ) : null}
                      </View>
                      <View style={styles.amountWrap}>
                        <Text style={styles.amount}>
                          {formatCurrency(Number(transaction.amount ?? 0))}
                        </Text>
                        <Text style={styles.meta}>Edit</Text>
                      </View>
                    </Pressable>
                  ))}
                  {!partyTransactions?.length ? (
                    <Text style={styles.helperText}>
                      No editable party transactions returned yet.
                    </Text>
                  ) : null}
                </View>
              </SurfaceCard>

              {summaryBits.length ? (
                <SurfaceCard
                  title="Report summary"
                  subtitle="Pulled from party-detail report.">
                  {summaryBits.map((bit) => (
                    <Text key={bit} style={styles.helperText}>
                      {bit}
                    </Text>
                  ))}
                </SurfaceCard>
              ) : null}

              <SurfaceCard
                title="Statement"
                subtitle="Recent party statement entries.">
                <View style={styles.list}>
                  {(partyStatement ?? []).slice(0, 8).map((entry) => (
                    <View key={entry.id} style={styles.statementRow}>
                      <View style={styles.copy}>
                        <Text style={styles.title}>
                          {entry.refNo || entry.description || 'Entry'}
                        </Text>
                        <Text style={styles.meta}>{prettyDate(entry.entryDate)}</Text>
                      </View>
                      <View style={styles.amountWrap}>
                        <Text style={styles.amount}>
                          {formatCurrency((entry.credit ?? 0) - (entry.debit ?? 0))}
                        </Text>
                        <Text style={styles.meta}>{entry.balanceDirection || ''}</Text>
                      </View>
                    </View>
                  ))}
                  {!partyStatement?.length ? (
                    <Text style={styles.helperText}>
                      No statement entries returned yet.
                    </Text>
                  ) : null}
                </View>
              </SurfaceCard>
            </>
          ) : null}
        </ScrollView>
      </BottomSheet>

      <BottomSheet
        visible={transactionSheetVisible}
        title={
          editingTransaction ? 'Edit party transaction' : 'Record party transaction'
        }
        subtitle="Changes refetch balances, detail, statement, and transaction history instead of patching totals on device."
        onClose={() => {
          setTransactionSheetVisible(false);
          setTransactionError('');
        }}
        fullHeight
        footer={
          <Pressable
            style={styles.primaryButton}
            onPress={() => void saveTransaction()}>
            <Text style={styles.primaryLabel}>
              {editingTransaction ? 'Save transaction' : 'Record transaction'}
            </Text>
          </Pressable>
        }>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.sheetContent}>
          <Pressable
            style={styles.selectorCard}
            onPress={() => setTransactionPartyPickerVisible(true)}>
            <View style={styles.copy}>
              <Text style={styles.selectorLabel}>Party</Text>
              <Text style={styles.selectorValue}>
                {transactionForm.party?.name || 'Select customer or supplier'}
              </Text>
            </View>
            <Text style={styles.link}>Change</Text>
          </Pressable>

          <SegmentedTabs
            value={transactionForm.direction}
            onChange={(direction) =>
              setTransactionForm((current) => ({ ...current, direction }))
            }
            options={[
              { label: 'Payment In', value: 'receive' },
              { label: 'Payment Out', value: 'give' },
            ]}
          />
          <FormField
            label="Amount"
            value={transactionForm.amount}
            onChangeText={(amount) =>
              setTransactionForm((current) => ({ ...current, amount }))
            }
            keyboardType="numeric"
          />
          <PaymentMethodSelector
            value={transactionForm.paymentMethod}
            onChange={(paymentMethod) =>
              setTransactionForm((current) => ({
                ...current,
                paymentMethod,
                bankId: paymentMethod === 'bank' ? current.bankId : '',
              }))
            }
          />
          {transactionForm.paymentMethod === 'bank' ? (
            <View style={styles.bankWrap}>
              {activeBanks.length ? (
                activeBanks.map((bank) => (
                  <Pressable
                    key={bank.id}
                    style={[
                      styles.bankChip,
                      transactionForm.bankId === bank.id && styles.bankChipActive,
                    ]}
                    onPress={() =>
                      setTransactionForm((current) => ({
                        ...current,
                        bankId: bank.id,
                      }))
                    }>
                    <Text
                      style={[
                        styles.bankChipLabel,
                        transactionForm.bankId === bank.id &&
                          styles.bankChipLabelActive,
                      ]}>
                      {bank.name}
                    </Text>
                  </Pressable>
                ))
              ) : (
                <Text style={styles.helperText}>
                  No active banks returned yet for this business.
                </Text>
              )}
            </View>
          ) : null}
          <FormField
            label="Date"
            value={transactionForm.txDate}
            onChangeText={(txDate) =>
              setTransactionForm((current) => ({ ...current, txDate }))
            }
          />
          <FormField
            label="Note"
            value={transactionForm.note}
            onChangeText={(note) =>
              setTransactionForm((current) => ({ ...current, note }))
            }
            multiline
            error={transactionError}
          />
        </ScrollView>
      </BottomSheet>

      <PartyPickerSheet
        visible={transactionPartyPickerVisible}
        search={transactionPartySearch}
        onSearchChange={setTransactionPartySearch}
        parties={transactionParties ?? []}
        onPick={(party) => {
          setTransactionForm((current) => ({ ...current, party }));
          setTransactionPartyPickerVisible(false);
        }}
        onClose={() => setTransactionPartyPickerVisible(false)}
        allowWalkIn={false}
        title="Move transaction to party"
        subtitle="Search and choose the correct party before saving the correction."
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  message: {
    color: palette.success,
    fontWeight: '700',
    fontSize: typography.body,
  },
  link: {
    color: palette.primary,
    fontWeight: '700',
  },
  list: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  copy: {
    flex: 1,
    gap: spacing.xxs,
  },
  title: {
    fontSize: typography.body,
    fontWeight: '700',
    color: palette.text,
  },
  meta: {
    fontSize: typography.label,
    color: palette.textMuted,
  },
  amountWrap: {
    alignItems: 'flex-end',
    gap: spacing.xxs,
  },
  amount: {
    fontSize: typography.body,
    fontWeight: '800',
    color: palette.primary,
  },
  sheetContent: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  footerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  primaryButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: radius.md,
    backgroundColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLabel: {
    color: palette.white,
    fontSize: typography.body,
    fontWeight: '800',
  },
  secondaryButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: radius.md,
    backgroundColor: palette.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryLabel: {
    color: palette.danger,
    fontSize: typography.body,
    fontWeight: '800',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    fontSize: typography.body,
    color: palette.textMuted,
  },
  summaryValue: {
    fontSize: typography.body,
    fontWeight: '800',
    color: palette.text,
  },
  helperText: {
    fontSize: typography.body,
    color: palette.textMuted,
    lineHeight: 22,
  },
  statementRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderRadius: radius.md,
    backgroundColor: palette.surfaceMuted,
    padding: spacing.md,
  },
  selectorCard: {
    borderRadius: radius.md,
    backgroundColor: palette.surfaceMuted,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  selectorLabel: {
    fontSize: typography.label,
    color: palette.textMuted,
    fontWeight: '700',
  },
  selectorValue: {
    fontSize: typography.body,
    color: palette.text,
    fontWeight: '800',
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
    backgroundColor: palette.backgroundAlt,
  },
  bankChipActive: {
    backgroundColor: palette.primary,
  },
  bankChipLabel: {
    color: palette.text,
    fontWeight: '700',
  },
  bankChipLabelActive: {
    color: palette.white,
  },
});
