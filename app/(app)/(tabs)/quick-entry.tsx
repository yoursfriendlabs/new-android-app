import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useFocusEffect } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { purchasesApi, quickExpensesApi } from '@/src/api';
import { clearDraft } from '@/src/data/database';
import { addQuickExpenseLocally } from '@/src/data/cache';
import { submitWithOfflineQueue } from '@/src/data/sync';
import { isInvalidSessionError } from '@/src/api/client';
import { BottomSheet } from '@/src/components/feedback/BottomSheet';
import { SuccessSheet } from '@/src/components/feedback/SuccessSheet';
import { AmountKeypad } from '@/src/components/forms/AmountKeypad';
import { FormField } from '@/src/components/forms/FormField';
import { PartyPickerSheet } from '@/src/components/forms/PartyPickerSheet';
import { PaymentMethodSelector } from '@/src/components/forms/PaymentMethodSelector';
import { Screen } from '@/src/components/layout/Screen';
import { SegmentedTabs } from '@/src/components/ui/SegmentedTabs';
import { formatCurrency, prettyDate, todayIso } from '@/src/lib/format';
import { useBanks, useParties, useQuickExpenses } from '@/src/hooks/useAppQueries';
import { useDebouncedValue } from '@/src/hooks/useDebouncedValue';
import { useDraftState } from '@/src/hooks/useDraftState';
import { palette, radius, spacing, typography } from '@/src/theme';
import type {
  QuickEntryTab,
  QuickExpenseDraft,
  QuickPurchaseDraft,
} from '@/src/types/forms';

interface CreatedRecord {
  id?: string;
}

function createQuickExpenseDraft(): QuickExpenseDraft {
  return {
    category: '',
    amount: 0,
    paymentMethod: 'cash',
    bankId: undefined,
    paymentNote: '',
    notes: '',
    date: todayIso(),
  };
}

function createQuickPurchaseDraft(): QuickPurchaseDraft {
  return {
    supplier: null,
    description: '',
    invoiceNo: `MOB-PUR-${Date.now().toString().slice(-6)}`,
    amount: 0,
    paymentMethod: 'cash',
    bankId: undefined,
    paymentNote: '',
    notes: '',
    date: todayIso(),
  };
}

type DetailSheetMode = 'expense' | 'purchase' | null;
type SuccessKind = 'expense' | 'purchase' | null;
const quickEntryTabs: QuickEntryTab[] = ['expense', 'purchase'];

function isQuickEntryTab(value?: string): value is QuickEntryTab {
  return quickEntryTabs.includes(value as QuickEntryTab);
}

export default function QuickEntryScreen() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<QuickEntryTab>('expense');
  const { tab: tabParam } = useLocalSearchParams<{ tab?: string | string[] }>();
  const [supplierSearch, setSupplierSearch] = useState('');
  const [supplierPickerVisible, setSupplierPickerVisible] = useState(false);
  const [expensePartySearch, setExpensePartySearch] = useState('');
  const [expensePartyPickerVisible, setExpensePartyPickerVisible] = useState(false);
  const [categorySheetVisible, setCategorySheetVisible] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [addingCategory, setAddingCategory] = useState(false);
  const { data: quickCategories } = useQuickExpenses();
  const addingCategoryRef = useRef(false);

  async function handleAddCategory() {
    if (addingCategoryRef.current || !newCategoryName.trim()) return;
    addingCategoryRef.current = true;
    try {
      setAddingCategory(true);
      let resName = '';
      try {
        const res = await quickExpensesApi.create({ name: newCategoryName.trim() });
        resName = res.name;
      } catch (apiError) {
        console.warn('Failed to create quick category on backend, falling back to local storage:', apiError);
        const localRecord = await addQuickExpenseLocally(newCategoryName.trim());
        resName = localRecord.name;
      }
      await queryClient.invalidateQueries({ queryKey: ['quick-expenses'] });
      expenseDraft.setValue((current) => ({ ...current, category: resName }));
      setNewCategoryName('');
      Alert.alert('Category added', `"${resName}" is now selected.`);
    } catch (error) {
      Alert.alert('Error adding category', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      addingCategoryRef.current = false;
      setAddingCategory(false);
    }
  }
  const [detailSheetMode, setDetailSheetMode] = useState<DetailSheetMode>(null);
  const [successState, setSuccessState] = useState<{
    visible: boolean;
    queued: boolean;
    title: string;
    message: string;
    kind: SuccessKind;
    recordId?: string;
  }>({
    visible: false,
    queued: false,
    title: '',
    message: '',
    kind: null,
  });
  const debouncedSupplierSearch = useDebouncedValue(supplierSearch);
  const debouncedExpensePartySearch = useDebouncedValue(expensePartySearch);
  const { data: banks } = useBanks();
  const { data: suppliers } = useParties(debouncedSupplierSearch, 'supplier');
  const { data: expenseParties } = useParties(debouncedExpensePartySearch, 'both');
  const expenseDraft = useDraftState<QuickExpenseDraft>(
    'draft:quick-expense',
    createQuickExpenseDraft(),
  );
  const purchaseDraft = useDraftState<QuickPurchaseDraft>(
    'draft:quick-purchase',
    createQuickPurchaseDraft(),
  );
  const activeBanks = useMemo(
    () => (banks ?? []).filter((bank) => bank.isActive),
    [banks],
  );
  const requestedTab = Array.isArray(tabParam) ? tabParam[0] : tabParam;

  useEffect(() => {
    if (isQuickEntryTab(requestedTab)) {
      setTab(requestedTab);
    }
  }, [requestedTab]);

  const expenseResetRef = useRef(expenseDraft.reset);
  const purchaseResetRef = useRef(purchaseDraft.reset);
  useEffect(() => {
    expenseResetRef.current = expenseDraft.reset;
  }, [expenseDraft.reset]);
  useEffect(() => {
    purchaseResetRef.current = purchaseDraft.reset;
  }, [purchaseDraft.reset]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        setSupplierSearch('');
        setSupplierPickerVisible(false);
        setExpensePartySearch('');
        setExpensePartyPickerVisible(false);
        setCategorySheetVisible(false);
        setDetailSheetMode(null);
        setSuccessState({
          visible: false,
          queued: false,
          title: '',
          message: '',
          kind: null,
        });
        void expenseResetRef.current(createQuickExpenseDraft());
        void purchaseResetRef.current(createQuickPurchaseDraft());
        void clearDraft('draft:quick-expense');
        void clearDraft('draft:quick-purchase');
        queryClient.removeQueries({ queryKey: ['parties'] });
        queryClient.removeQueries({ queryKey: ['banks'] });
      };
    }, [queryClient]),
  );

  async function saveExpense() {
    if (!expenseDraft.value.category.trim()) {
      Alert.alert(
        'Category required',
        'Choose or enter a category before recording the expense.',
      );
      return;
    }

    if (expenseDraft.value.amount <= 0) {
      Alert.alert('Amount required', 'Enter an amount greater than zero.');
      return;
    }

    if (expenseDraft.value.paymentMethod === 'bank' && !expenseDraft.value.bankId) {
      Alert.alert(
        'Bank required',
        'Choose a bank account before recording a bank expense.',
      );
      return;
    }

    const payload = {
      entryType: 'expense' as const,
      partyId: expenseDraft.value.party?.id || null,
      partyName: expenseDraft.value.party?.name || expenseDraft.value.category,
      invoiceNo: `MOB-EXP-${Date.now().toString().slice(-6)}`,
      purchaseDate: expenseDraft.value.date,
      status: 'received',
      notes: expenseDraft.value.notes,
      amountReceived: expenseDraft.value.amount,
      paymentMethod: expenseDraft.value.paymentMethod,
      bankId:
        expenseDraft.value.paymentMethod === 'bank'
          ? expenseDraft.value.bankId
          : undefined,
      paymentNote: expenseDraft.value.paymentNote,
      subTotal: expenseDraft.value.amount,
      taxTotal: 0,
      grandTotal: expenseDraft.value.amount,
      items: [
        {
          description: expenseDraft.value.category,
          quantity: 1,
          unitType: 'primary',
          unitPrice: expenseDraft.value.amount,
          taxRate: 0,
          lineTotal: expenseDraft.value.amount,
          itemType: 'expense',
        },
      ],
    };

    try {
      const result = await submitWithOfflineQueue<CreatedRecord, typeof payload>({
        entityType: 'expense',
        method: 'POST',
        path: '/api/purchases',
        body: payload,
      });

      const savedAmount = expenseDraft.value.amount;
      const savedCategory = expenseDraft.value.category;
      await expenseDraft.reset(createQuickExpenseDraft());
      setSuccessState({
        visible: true,
        queued: result.queued,
        title: 'Expense recorded',
        message: `${formatCurrency(savedAmount)} saved under ${savedCategory}.`,
        kind: 'expense',
        recordId: result.data?.id ? String(result.data.id) : undefined,
      });
    } catch (error) {
      if (isInvalidSessionError(error)) {
        return;
      }

      Alert.alert(
        'Unable to record expense',
        error instanceof Error ? error.message : 'Please try again.',
      );
    }
  }

  async function savePurchase() {
    if (!purchaseDraft.value.supplier?.id) {
      Alert.alert('Supplier required', 'Select a supplier first.');
      return;
    }

    if (purchaseDraft.value.amount <= 0) {
      Alert.alert('Amount required', 'Enter an amount greater than zero.');
      return;
    }

    if (purchaseDraft.value.paymentMethod === 'bank' && !purchaseDraft.value.bankId) {
      Alert.alert(
        'Bank required',
        'Choose a bank account before recording a bank purchase.',
      );
      return;
    }

    const description =
      purchaseDraft.value.description.trim() || 'Quick purchase from mobile';
    const payload = {
      entryType: 'purchase' as const,
      partyId: purchaseDraft.value.supplier.id,
      partyName: null,
      invoiceNo: purchaseDraft.value.invoiceNo,
      purchaseDate: purchaseDraft.value.date,
      status: 'received',
      notes: purchaseDraft.value.notes,
      amountReceived: purchaseDraft.value.amount,
      paymentMethod: purchaseDraft.value.paymentMethod,
      bankId:
        purchaseDraft.value.paymentMethod === 'bank'
          ? purchaseDraft.value.bankId
          : undefined,
      paymentNote: purchaseDraft.value.paymentNote,
      subTotal: purchaseDraft.value.amount,
      taxTotal: 0,
      grandTotal: purchaseDraft.value.amount,
      items: [
        {
          description,
          quantity: 1,
          unitType: 'primary',
          unitPrice: purchaseDraft.value.amount,
          taxRate: 0,
          lineTotal: purchaseDraft.value.amount,
          itemType: 'part',
        },
      ],
    };

    try {
      const result = await submitWithOfflineQueue<CreatedRecord, typeof payload>({
        entityType: 'purchase',
        method: 'POST',
        path: '/api/purchases',
        body: payload,
      });

      const savedAmount = purchaseDraft.value.amount;
      const savedSupplier = purchaseDraft.value.supplier.name;
      await purchaseDraft.reset(createQuickPurchaseDraft());
      setSuccessState({
        visible: true,
        queued: result.queued,
        title: 'Purchase recorded',
        message: `${formatCurrency(savedAmount)} saved for ${savedSupplier}.`,
        kind: 'purchase',
        recordId: result.data?.id ? String(result.data.id) : undefined,
      });
    } catch (error) {
      if (isInvalidSessionError(error)) {
        return;
      }

      Alert.alert(
        'Unable to record purchase',
        error instanceof Error ? error.message : 'Please try again.',
      );
    }
  }

  const topBarRight = (
    <View style={styles.topBarActions}>
      <Pressable
        style={styles.topBarIcon}
        onPress={() =>
          Alert.alert(
            'Quick entry',
            'This screen is intentionally simple for launch week: quick expense and quick purchase only.',
          )
        }>
        <MaterialCommunityIcons
          color={palette.textSoft}
          name="information-outline"
          size={26}
        />
      </Pressable>
      <Pressable
        style={styles.topBarIcon}
        onPress={() => router.push('/(app)/(tabs)/more')}>
        <MaterialCommunityIcons color={palette.textSoft} name="account-circle-outline" size={26} />
      </Pressable>
    </View>
  );

  const successActions =
    successState.kind === 'expense'
      ? [
          {
            label: 'Open expenses',
            onPress: () => {
              setSuccessState((current) => ({ ...current, visible: false }));
              router.push({
                pathname: '/(app)/purchases',
                params: { filter: 'expense', openId: successState.recordId ?? '' },
              });
            },
            primary: true,
          },
          {
            label: 'Record another',
            onPress: () => setSuccessState((current) => ({ ...current, visible: false })),
          },
        ]
      : [
          {
            label: 'Open purchases',
            onPress: () => {
              setSuccessState((current) => ({ ...current, visible: false }));
              router.push({
                pathname: '/(app)/purchases',
                params: { filter: 'purchase', openId: successState.recordId ?? '' },
              });
            },
            primary: true,
          },
          {
            label: 'Record another',
            onPress: () => setSuccessState((current) => ({ ...current, visible: false })),
          },
        ];

  return (
    <Screen
      scrollable={false}
      padded={false}
      topBarTitle="Quick Entry"
      topBarLeading="none"
      topBarRight={topBarRight}>
      <View style={styles.container}>
        <SegmentedTabs
          value={tab}
          onChange={setTab}
          style={styles.segmentedTabs}
          contentContainerStyle={styles.tabBar}
          activeBackgroundColor={palette.success}
          options={[
            { label: 'Expense', value: 'expense' },
            { label: 'Purchase', value: 'purchase' },
          ]}
        />

        <View style={styles.body}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}>
            {tab === 'expense' ? (
              <View style={styles.composer}>
                <Pressable
                  style={styles.selectorCard}
                  onPress={() => setCategorySheetVisible(true)}>
                  <View style={styles.selectorLead}>
                    <MaterialCommunityIcons
                      color={palette.success}
                      name="shape-outline"
                      size={24}
                    />
                    <Text style={styles.selectorLabel}>
                      {expenseDraft.value.category || 'Select expense category'}
                    </Text>
                  </View>
                  <MaterialCommunityIcons
                    color={palette.textSoft}
                    name="chevron-right"
                    size={22}
                  />
                </Pressable>

                <Pressable
                  style={styles.selectorCard}
                  onPress={() => setExpensePartyPickerVisible(true)}>
                  <View style={styles.selectorLead}>
                    <View style={[styles.partyAvatar, { backgroundColor: palette.primary }]}>
                      <MaterialCommunityIcons
                        color={palette.white}
                        name="account-outline"
                        size={22}
                      />
                    </View>
                    <View style={styles.selectorCopy}>
                      <Text style={styles.selectorLabel}>
                        {expenseDraft.value.party?.name || 'Paid to (Optional)'}
                      </Text>
                      <Text style={styles.selectorSubLabel}>
                        {expenseDraft.value.party?.phone || 'Tap to select staff or supplier'}
                      </Text>
                    </View>
                  </View>
                  <MaterialCommunityIcons
                    color={palette.textSoft}
                    name="chevron-right"
                    size={22}
                  />
                </Pressable>

                <AmountKeypad
                  value={expenseDraft.value.amount}
                  onChange={(amount) =>
                    expenseDraft.setValue((current) => ({ ...current, amount }))
                  }
                />

                <Pressable
                  style={styles.primaryAction}
                  onPress={() => setDetailSheetMode('expense')}>
                  <Text style={styles.primaryActionLabel}>Record expense</Text>
                </Pressable>

                <View style={styles.metaRow}>
                  <Text style={styles.metaText}>
                    {expenseDraft.value.paymentMethod === 'bank' ? 'Bank' : 'Cash'}  •{' '}
                    {prettyDate(expenseDraft.value.date)}
                  </Text>
                  <Pressable onPress={() => setDetailSheetMode('expense')}>
                    <Text style={styles.metaLink}>Details</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            {tab === 'purchase' ? (
              <View style={styles.composer}>
                <Pressable
                  style={styles.selectorCard}
                  onPress={() => setSupplierPickerVisible(true)}>
                  <View style={styles.selectorLead}>
                    <View style={styles.partyAvatar}>
                      <MaterialCommunityIcons
                        color={palette.white}
                        name="truck-delivery-outline"
                        size={22}
                      />
                    </View>
                    <View style={styles.selectorCopy}>
                      <Text style={styles.selectorLabel}>
                        {purchaseDraft.value.supplier?.name || 'Select supplier'}
                      </Text>
                      <Text style={styles.selectorSubLabel}>
                        {purchaseDraft.value.supplier?.phone || 'Tap to search suppliers'}
                      </Text>
                    </View>
                  </View>
                  <MaterialCommunityIcons
                    color={palette.textSoft}
                    name="chevron-right"
                    size={22}
                  />
                </Pressable>

                <FormField
                  label="Description"
                  value={purchaseDraft.value.description}
                  placeholder="Quick purchase note"
                  onChangeText={(description) =>
                    purchaseDraft.setValue((current) => ({ ...current, description }))
                  }
                />

                <AmountKeypad
                  value={purchaseDraft.value.amount}
                  onChange={(amount) =>
                    purchaseDraft.setValue((current) => ({ ...current, amount }))
                  }
                />

                <Pressable
                  style={styles.primaryAction}
                  onPress={() => setDetailSheetMode('purchase')}>
                  <Text style={styles.primaryActionLabel}>Record purchase</Text>
                </Pressable>

                <View style={styles.metaRow}>
                  <Text style={styles.metaText}>
                    {purchaseDraft.value.paymentMethod === 'bank' ? 'Bank' : 'Cash'}  •{' '}
                    {prettyDate(purchaseDraft.value.date)}
                  </Text>
                  <Pressable onPress={() => setDetailSheetMode('purchase')}>
                    <Text style={styles.metaLink}>Details</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
          </ScrollView>
        </View>
      </View>

      <BottomSheet
        visible={categorySheetVisible}
        title="Expense category"
        subtitle="Select an existing category or create a new one."
        onClose={() => setCategorySheetVisible(false)}
        fullHeight
        footer={
          <Pressable
            style={styles.sheetPrimaryButton}
            onPress={() => {
              setCategorySheetVisible(false);
              router.push('/(app)/expense-categories' as any);
            }}>
            <Text style={styles.sheetPrimaryLabel}>Manage Categories</Text>
          </Pressable>
        }>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetCategoryContent}>
          <View style={styles.addCategoryRow}>
            <View style={{ flex: 1 }}>
              <FormField
                label="New Category Name"
                value={newCategoryName}
                placeholder="e.g. Rent, Internet, Tea"
                onChangeText={setNewCategoryName}
              />
            </View>
            <Pressable
              style={[styles.addCategoryBtn, (!newCategoryName.trim() || addingCategory) && styles.addCategoryBtnDisabled]}
              onPress={() => void handleAddCategory()}
              disabled={!newCategoryName.trim() || addingCategory}>
              {addingCategory ? (
                <ActivityIndicator color={palette.white} size="small" />
              ) : (
                <Text style={styles.addCategoryBtnText}>Add</Text>
              )}
            </Pressable>
          </View>

          <Text style={styles.selectorLabel}>Choose from existing:</Text>
          
          <View style={styles.categoryChipWrap}>
            {(quickCategories ?? []).map((cat) => (
              <Pressable
                key={cat.id}
                style={[
                  styles.categoryChip,
                  expenseDraft.value.category === cat.name && styles.categoryChipActive,
                ]}
                onPress={() => {
                  expenseDraft.setValue((current) => ({ ...current, category: cat.name }));
                  setCategorySheetVisible(false);
                }}>
                <Text
                  style={[
                    styles.categoryChipLabel,
                    expenseDraft.value.category === cat.name && styles.categoryChipLabelActive,
                  ]}>
                  {cat.name}
                </Text>
              </Pressable>
            ))}
            {!(quickCategories ?? []).length ? (
              <Text style={styles.emptyCategoriesText}>No categories defined yet. Create one above!</Text>
            ) : null}
          </View>
        </ScrollView>
      </BottomSheet>

      <BottomSheet
        visible={detailSheetMode === 'expense'}
        title="Expense details"
        subtitle="Payment method, note, and date for the expense."
        onClose={() => setDetailSheetMode(null)}
        fullHeight
        footer={
          <Pressable
            style={styles.sheetPrimaryButton}
            onPress={() => {
              setDetailSheetMode(null);
              void saveExpense();
            }}>
            <Text style={styles.sheetPrimaryLabel}>Save expense</Text>
          </Pressable>
        }>
        <PaymentMethodSelector
          value={expenseDraft.value.paymentMethod}
          onChange={(paymentMethod) =>
            expenseDraft.setValue((current) => ({ ...current, paymentMethod }))
          }
          activeBackgroundColor={palette.success}
        />
        {expenseDraft.value.paymentMethod === 'bank' ? (
          <View style={styles.bankWrap}>
            {activeBanks.length > 0 ? (
              activeBanks.map((bank) => (
                <Pressable
                  key={bank.id}
                  style={[
                    styles.bankChip,
                    expenseDraft.value.bankId === bank.id && styles.bankChipActive,
                  ]}
                  onPress={() =>
                    expenseDraft.setValue((current) => ({ ...current, bankId: bank.id }))
                  }>
                  <Text
                    style={[
                      styles.bankChipLabel,
                      expenseDraft.value.bankId === bank.id &&
                        styles.bankChipLabelActive,
                    ]}>
                    {bank.name}
                  </Text>
                </Pressable>
              ))
            ) : (
              <Text style={styles.emptyBankText}>No active banks found yet.</Text>
            )}
          </View>
        ) : null}
        <FormField
          label="Payment note"
          value={expenseDraft.value.paymentNote}
          onChangeText={(paymentNote) =>
            expenseDraft.setValue((current) => ({ ...current, paymentNote }))
          }
        />
        <FormField
          label="Notes"
          value={expenseDraft.value.notes}
          onChangeText={(notes) =>
            expenseDraft.setValue((current) => ({ ...current, notes }))
          }
          multiline
        />
        <FormField
          label="Date"
          value={expenseDraft.value.date}
          onChangeText={(date) =>
            expenseDraft.setValue((current) => ({ ...current, date }))
          }
        />
      </BottomSheet>

      <BottomSheet
        visible={detailSheetMode === 'purchase'}
        title="Purchase details"
        subtitle="Invoice, payment method, note, and date for the purchase."
        onClose={() => setDetailSheetMode(null)}
        fullHeight
        footer={
          <Pressable
            style={styles.sheetPrimaryButton}
            onPress={() => {
              setDetailSheetMode(null);
              void savePurchase();
            }}>
            <Text style={styles.sheetPrimaryLabel}>Save purchase</Text>
          </Pressable>
        }>
        <FormField
          label="Invoice number"
          value={purchaseDraft.value.invoiceNo}
          onChangeText={(invoiceNo) =>
            purchaseDraft.setValue((current) => ({ ...current, invoiceNo }))
          }
        />
        <PaymentMethodSelector
          value={purchaseDraft.value.paymentMethod}
          onChange={(paymentMethod) =>
            purchaseDraft.setValue((current) => ({ ...current, paymentMethod }))
          }
          activeBackgroundColor={palette.success}
        />
        {purchaseDraft.value.paymentMethod === 'bank' ? (
          <View style={styles.bankWrap}>
            {activeBanks.length > 0 ? (
              activeBanks.map((bank) => (
                <Pressable
                  key={bank.id}
                  style={[
                    styles.bankChip,
                    purchaseDraft.value.bankId === bank.id && styles.bankChipActive,
                  ]}
                  onPress={() =>
                    purchaseDraft.setValue((current) => ({ ...current, bankId: bank.id }))
                  }>
                  <Text
                    style={[
                      styles.bankChipLabel,
                      purchaseDraft.value.bankId === bank.id &&
                        styles.bankChipLabelActive,
                    ]}>
                    {bank.name}
                  </Text>
                </Pressable>
              ))
            ) : (
              <Text style={styles.emptyBankText}>No active banks found yet.</Text>
            )}
          </View>
        ) : null}
        <FormField
          label="Payment note"
          value={purchaseDraft.value.paymentNote}
          onChangeText={(paymentNote) =>
            purchaseDraft.setValue((current) => ({ ...current, paymentNote }))
          }
        />
        <FormField
          label="Notes"
          value={purchaseDraft.value.notes}
          onChangeText={(notes) =>
            purchaseDraft.setValue((current) => ({ ...current, notes }))
          }
          multiline
        />
        <FormField
          label="Date"
          value={purchaseDraft.value.date}
          onChangeText={(date) =>
            purchaseDraft.setValue((current) => ({ ...current, date }))
          }
        />
      </BottomSheet>

      <PartyPickerSheet
        visible={supplierPickerVisible}
        search={supplierSearch}
        onSearchChange={setSupplierSearch}
        parties={suppliers ?? []}
        onPick={(party) => {
          purchaseDraft.setValue((current) => ({ ...current, supplier: party }));
          setSupplierPickerVisible(false);
        }}
        onClose={() => setSupplierPickerVisible(false)}
        allowWalkIn={false}
        title="Select supplier"
        subtitle="Search the supplier you want to attach to this purchase."
      />

      <PartyPickerSheet
        visible={expensePartyPickerVisible}
        search={expensePartySearch}
        onSearchChange={setExpensePartySearch}
        parties={expenseParties ?? []}
        onPick={(party) => {
          expenseDraft.setValue((current) => ({ ...current, party }));
          setExpensePartyPickerVisible(false);
        }}
        onClose={() => setExpensePartyPickerVisible(false)}
        allowWalkIn={true}
        title="Paid to (Optional)"
        subtitle="Select a staff member or supplier for this expense."
      />

      <SuccessSheet
        visible={successState.visible}
        queued={successState.queued}
        title={successState.title}
        message={successState.message}
        onClose={() => setSuccessState((current) => ({ ...current, visible: false }))}
        actions={successActions}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  topBarIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBar: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
  },
  segmentedTabs: {
    flexGrow: 0,
  },
  body: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  composer: {
    gap: spacing.md,
  },
  selectorCard: {
    minHeight: 88,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
  },
  selectorLead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  selectorCopy: {
    gap: spacing.xxs,
    flex: 1,
  },
  selectorLabel: {
    fontSize: typography.subheading,
    fontWeight: '700',
    color: palette.text,
  },
  selectorSubLabel: {
    fontSize: typography.body,
    color: palette.textMuted,
  },
  partyAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.success,
  },
  primaryAction: {
    minHeight: 56,
    borderRadius: radius.md,
    backgroundColor: palette.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryActionLabel: {
    color: palette.white,
    fontSize: typography.heading,
    fontWeight: '800',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaText: {
    fontSize: typography.label,
    color: palette.textMuted,
  },
  metaLink: {
    fontSize: typography.label,
    fontWeight: '700',
    color: palette.success,
  },
  sheetPrimaryButton: {
    minHeight: 54,
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
    backgroundColor: palette.success,
  },
  bankChipLabel: {
    color: palette.text,
    fontWeight: '700',
  },
  bankChipLabelActive: {
    color: palette.white,
  },
  emptyBankText: {
    flex: 1,
    fontSize: typography.body,
    color: palette.textMuted,
    fontWeight: '500',
  },
  sheetFooterActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  sheetSecondaryButton: {
    flex: 1,
    minHeight: 54,
    borderRadius: radius.md,
    backgroundColor: palette.backgroundAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetSecondaryButtonLabel: {
    color: palette.text,
    fontSize: typography.body,
    fontWeight: '700',
  },
  sheetCategoryContent: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  addCategoryRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  addCategoryBtn: {
    minHeight: 50,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: palette.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addCategoryBtnDisabled: {
    backgroundColor: palette.backgroundAlt,
  },
  addCategoryBtnText: {
    color: palette.white,
    fontWeight: '800',
  },
  categoryChipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  categoryChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: palette.backgroundAlt,
  },
  categoryChipActive: {
    backgroundColor: palette.success,
  },
  categoryChipLabel: {
    color: palette.text,
    fontWeight: '700',
  },
  categoryChipLabelActive: {
    color: palette.white,
  },
  emptyCategoriesText: {
    fontSize: typography.body,
    color: palette.textMuted,
    fontWeight: '500',
    fontStyle: 'italic',
  },
});
