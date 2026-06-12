import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { normalizePurchase, unwrapEntity } from '@/src/api/normalize';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { cacheRecentPurchases } from '@/src/data/cache';
import { submitWithOfflineQueue } from '@/src/data/sync';
import { SuccessSheet } from '@/src/components/feedback/SuccessSheet';
import { PartyPickerSheet } from '@/src/components/forms/PartyPickerSheet';
import { ProductPickerSheet } from '@/src/components/forms/ProductPickerSheet';
import { FormField } from '@/src/components/forms/FormField';
import { PaymentMethodSelector } from '@/src/components/forms/PaymentMethodSelector';
import { Screen } from '@/src/components/layout/Screen';
import { SegmentedTabs } from '@/src/components/ui/SegmentedTabs';
import { StickyActionBar } from '@/src/components/ui/StickyActionBar';
import { SurfaceCard } from '@/src/components/ui/SurfaceCard';
import { TotalsCard } from '@/src/components/ui/TotalsCard';
import { buildReceiptHtml } from '@/src/lib/receipt';
import { computeGrandTotal, computeLineTotal, computeSubTotal, computeTaxTotal } from '@/src/lib/totals';
import { formatCurrency, todayIso } from '@/src/lib/format';
import { useBanks, useNextSequences, useParties, useProducts } from '@/src/hooks/useAppQueries';
import { useDebouncedValue } from '@/src/hooks/useDebouncedValue';
import { useDraftState } from '@/src/hooks/useDraftState';
import { generateId } from '@/src/lib/id';
import { palette, radius, spacing, typography } from '@/src/theme';
import { useReceiptStore } from '@/src/stores/receipt-store';
import type { DraftPurchaseLine, PurchaseDraft } from '@/src/types/forms';
import type { Purchase } from '@/src/types/models';

function createPurchaseDraft(): PurchaseDraft {
  return {
    supplier: null,
    invoiceNo: `PUR-${Date.now().toString().slice(-6)}`,
    purchaseDate: todayIso(),
    status: 'received',
    notes: '',
    amountPaid: 0,
    paymentMethod: 'cash',
    bankId: undefined,
    paymentNote: '',
    discount: 0,
    items: [],
  };
}

function createPurchaseLine(): DraftPurchaseLine {
  return {
    id: generateId('purchase-line'),
    product: null,
    description: '',
    quantity: 1,
    unitType: 'primary',
    unitPrice: 0,
    taxRate: 13,
    itemType: 'part',
  };
}

export default function PurchaseCreateScreen() {
  const setReceipt = useReceiptStore((state) => state.setReceipt);
  const [partySearch, setPartySearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [partyPickerVisible, setPartyPickerVisible] = useState(false);
  const [productPickerVisible, setProductPickerVisible] = useState(false);
  const [targetLineId, setTargetLineId] = useState<string | null>(null);
  const [successState, setSuccessState] = useState({ visible: false, queued: false });
  const debouncedPartySearch = useDebouncedValue(partySearch);
  const debouncedProductSearch = useDebouncedValue(productSearch);
  const { data: parties } = useParties(debouncedPartySearch, 'supplier');
  const { data: products } = useProducts(debouncedProductSearch);
  const { data: banks } = useBanks();
  const { data: nextSequences } = useNextSequences();
  const activeBanks = (banks ?? []).filter((bank) => bank.isActive);
  const draft = useDraftState<PurchaseDraft>('draft:purchase', createPurchaseDraft());

  useEffect(() => {
    if (!draft.isReady || !nextSequences?.purchase) return;

    draft.setValue((current) => ({
      ...current,
      invoiceNo:
        current.invoiceNo.startsWith('PUR-') && nextSequences.purchase
          ? nextSequences.purchase
          : current.invoiceNo,
    }));
  }, [draft.isReady, draft.setValue, nextSequences?.purchase]);

  const subTotal = useMemo(
    () =>
      computeSubTotal(draft.value.items.map((item) => ({ quantity: item.quantity, unitPrice: item.unitPrice, taxRate: item.taxRate }))),
    [draft.value.items],
  );
  const taxTotal = useMemo(
    () =>
      computeTaxTotal(draft.value.items.map((item) => ({ quantity: item.quantity, unitPrice: item.unitPrice, taxRate: item.taxRate }))),
    [draft.value.items],
  );
  const grandTotal = useMemo(
    () =>
      computeGrandTotal(
        draft.value.items.map((item) => ({ quantity: item.quantity, unitPrice: item.unitPrice, taxRate: item.taxRate })),
        draft.value.discount,
      ),
    [draft.value.discount, draft.value.items],
  );

  function updateLine(id: string, patch: Partial<DraftPurchaseLine>) {
    draft.setValue((current) => ({
      ...current,
      items: current.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));
  }

  async function savePurchase() {
    if (!draft.value.supplier?.id) {
      Alert.alert('Supplier required', 'Select a supplier before saving the purchase.');
      return;
    }

    if (draft.value.paymentMethod === 'bank' && draft.value.amountPaid > 0 && !draft.value.bankId) {
      Alert.alert('Bank required', 'Choose a bank account for bank payment.');
      return;
    }

    const invalidSecondaryLine = draft.value.items.find(
      (item) => item.unitType === 'secondary' && !item.product?.secondaryConversionRate,
    );

    if (invalidSecondaryLine) {
      Alert.alert('Secondary unit missing rate', 'This product is missing a secondary unit conversion rate.');
      return;
    }

    try {
      const payload = {
        entryType: 'purchase' as const,
        partyId: draft.value.supplier.id,
        partyName: null,
        invoiceNo: draft.value.invoiceNo,
        purchaseDate: draft.value.purchaseDate,
        status: draft.value.status,
        notes: draft.value.notes,
        amountReceived: draft.value.amountPaid,
        paymentMethod: draft.value.amountPaid > 0 ? draft.value.paymentMethod : 'cash',
        bankId: draft.value.paymentMethod === 'bank' ? draft.value.bankId : undefined,
        paymentNote: draft.value.paymentNote,
        subTotal,
        taxTotal,
        discount: draft.value.discount,
        discountTotal: draft.value.discount,
        grandTotal,
        items: draft.value.items.map((item) => ({
          productId: item.product?.id,
          quantity: item.quantity,
          unitType: item.unitType,
          conversionRate:
            item.unitType === 'secondary'
              ? item.product?.secondaryConversionRate ?? 0
              : 0,
          unitPrice: item.unitPrice,
          taxRate: item.taxRate,
          lineTotal: computeLineTotal(item),
          itemType: item.itemType,
          description: item.description,
        })),
      };

      const result = await submitWithOfflineQueue<Purchase, typeof payload>({
        entityType: 'purchase',
        method: 'POST',
        path: '/api/purchases',
        body: payload,
      });

      setReceipt({
        title: draft.value.invoiceNo,
        subtitle: draft.value.supplier.name,
        html: buildReceiptHtml({
          heading: 'Purchase Entry',
          reference: draft.value.invoiceNo,
          date: draft.value.purchaseDate,
          subtitle: draft.value.supplier.name,
          lines: draft.value.items.map((item) => ({
            name: item.product?.name ?? (item.description || 'Line item'),
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            lineTotal: computeLineTotal(item),
          })),
          subTotal,
          taxTotal,
          discountTotal: draft.value.discount,
          grandTotal,
          amountReceived: draft.value.amountPaid,
        }),
      });

      if (result.data) {
        await cacheRecentPurchases([normalizePurchase(unwrapEntity(result.data))]);
      }

      await draft.reset(createPurchaseDraft());
      setSuccessState({ visible: true, queued: result.queued });
    } catch (error) {
      Alert.alert(
        'Unable to save purchase',
        error instanceof Error ? error.message : 'Please try again.',
      );
    }
  }

  return (
    <Screen
      footer={
        <StickyActionBar
          secondary={{ label: 'Close', onPress: () => router.back() }}
          primary={{ label: 'Save purchase', onPress: () => void savePurchase() }}
        />
      }>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <SurfaceCard title="Supplier and bill" subtitle="Supplier, date, invoice, and notes stay up top.">
          <Pressable style={styles.selector} onPress={() => setPartyPickerVisible(true)}>
            <Text style={styles.selectorTitle}>{draft.value.supplier?.name ?? 'Select supplier'}</Text>
            <Text style={styles.selectorSubtitle}>{draft.value.supplier?.phone ?? 'Tap to search suppliers'}</Text>
          </Pressable>
          <FormField label="Invoice number" value={draft.value.invoiceNo} onChangeText={(invoiceNo) => draft.setValue((current) => ({ ...current, invoiceNo }))} />
          <FormField label="Purchase date" value={draft.value.purchaseDate} onChangeText={(purchaseDate) => draft.setValue((current) => ({ ...current, purchaseDate }))} />
          <FormField label="Notes" value={draft.value.notes} onChangeText={(notes) => draft.setValue((current) => ({ ...current, notes }))} multiline />
        </SurfaceCard>

        <SurfaceCard title="Line items" subtitle="Pick products, adjust quantity and unit cost, and keep totals visible.">
          <Pressable style={styles.secondaryButton} onPress={() => draft.setValue((current) => ({ ...current, items: [...current.items, createPurchaseLine()] }))}>
            <Text style={styles.secondaryButtonLabel}>Add line item</Text>
          </Pressable>
          {draft.value.items.map((item) => (
            <View key={item.id} style={styles.lineCard}>
              <View style={styles.lineTop}>
                <Text style={styles.lineTitle}>{item.product?.name ?? 'Purchase line'}</Text>
                <Pressable onPress={() => draft.setValue((current) => ({ ...current, items: current.items.filter((entry) => entry.id !== item.id) }))}>
                  <Text style={styles.removeLabel}>Remove</Text>
                </Pressable>
              </View>
              <Pressable
                style={styles.selector}
                onPress={() => {
                  setTargetLineId(item.id);
                  setProductPickerVisible(true);
                }}>
                <Text style={styles.selectorTitle}>{item.product?.name ?? 'Select product'}</Text>
                <Text style={styles.selectorSubtitle}>
                  {item.product ? `Stock ${item.product.stockOnHand ?? 0}` : 'Search inventory products'}
                </Text>
              </Pressable>
              {item.product?.secondaryUnit ? (
                <SegmentedTabs
                  value={item.unitType as 'primary' | 'secondary'}
                  onChange={(unitType) => updateLine(item.id, { unitType })}
                  options={[
                    { label: item.product.primaryUnit, value: 'primary' },
                    { label: item.product.secondaryUnit, value: 'secondary' },
                  ]}
                />
              ) : null}
              <FormField label="Description" value={item.description} onChangeText={(description) => updateLine(item.id, { description })} />
              <FormField label="Quantity" value={String(item.quantity)} onChangeText={(quantity) => updateLine(item.id, { quantity: Number(quantity || 0) })} keyboardType="numeric" />
              <FormField label="Unit cost" value={String(item.unitPrice)} onChangeText={(unitPrice) => updateLine(item.id, { unitPrice: Number(unitPrice || 0) })} keyboardType="numeric" />
              <FormField label="Tax rate" value={String(item.taxRate)} onChangeText={(taxRate) => updateLine(item.id, { taxRate: Number(taxRate || 0) })} keyboardType="numeric" />
              <Text style={styles.lineTotal}>Line total {formatCurrency(computeLineTotal(item))}</Text>
            </View>
          ))}
        </SurfaceCard>

        <SurfaceCard title="Payment" subtitle="Quick payment rules stay consistent with POS and services.">
          <FormField label="Amount paid" value={String(draft.value.amountPaid)} onChangeText={(amountPaid) => draft.setValue((current) => ({ ...current, amountPaid: Number(amountPaid || 0) }))} keyboardType="numeric" />
          <PaymentMethodSelector value={draft.value.paymentMethod} onChange={(paymentMethod) => draft.setValue((current) => ({ ...current, paymentMethod }))} />
          {draft.value.paymentMethod === 'bank' ? (
            <View style={styles.bankWrap}>
              {activeBanks.length > 0 ? (
                activeBanks.map((bank) => (
                  <Pressable
                    key={bank.id}
                    style={[styles.bankChip, draft.value.bankId === bank.id && styles.bankChipActive]}
                    onPress={() => draft.setValue((current) => ({ ...current, bankId: bank.id }))}>
                    <Text
                      style={[
                        styles.bankChipLabel,
                        draft.value.bankId === bank.id && styles.bankChipLabelActive,
                      ]}>
                      {bank.name}
                    </Text>
                  </Pressable>
                ))
              ) : (
                <Pressable style={styles.emptyBankInfo} onPress={() => router.push('/(app)/banks')}>
                  <MaterialCommunityIcons name="bank-plus" size={24} color={palette.textMuted} />
                  <Text style={styles.emptyBankText}>No active banks found. Tap to add one in settings.</Text>
                </Pressable>
              )}
            </View>
          ) : null}
          <FormField label="Payment note" value={draft.value.paymentNote} onChangeText={(paymentNote) => draft.setValue((current) => ({ ...current, paymentNote }))} />
          <FormField label="Discount" value={String(draft.value.discount)} onChangeText={(discount) => draft.setValue((current) => ({ ...current, discount: Number(discount || 0) }))} keyboardType="numeric" />
          <TotalsCard
            subTotal={subTotal}
            taxTotal={taxTotal}
            discountTotal={draft.value.discount}
            grandTotal={grandTotal}
            amountReceived={draft.value.amountPaid}
          />
        </SurfaceCard>
      </ScrollView>

      <PartyPickerSheet
        visible={partyPickerVisible}
        search={partySearch}
        onSearchChange={setPartySearch}
        parties={parties ?? []}
        onPick={(party) => {
          draft.setValue((current) => ({ ...current, supplier: party }));
          setPartyPickerVisible(false);
        }}
        onClose={() => setPartyPickerVisible(false)}
        allowWalkIn={false}
      />

      <ProductPickerSheet
        visible={productPickerVisible}
        search={productSearch}
        onSearchChange={setProductSearch}
        products={products ?? []}
        onPick={(product) => {
          if (targetLineId) {
            updateLine(targetLineId, {
              product,
              description: product.name,
              unitPrice: product.purchasePrice ?? product.salePrice,
              taxRate: product.taxRate ?? 13,
            });
          }
          setProductPickerVisible(false);
        }}
        onClose={() => setProductPickerVisible(false)}
      />

      <SuccessSheet
        visible={successState.visible}
        queued={successState.queued}
        title="Purchase saved"
        message="You can view the invoice summary or close the form and start the next entry."
        onClose={() => setSuccessState({ visible: false, queued: false })}
        actions={[
          {
            label: 'View invoice',
            onPress: () => {
              setSuccessState({ visible: false, queued: false });
              router.push('/(app)/invoice');
            },
          },
          {
            label: 'Close form',
            onPress: () => {
              setSuccessState({ visible: false, queued: false });
              router.back();
            },
            primary: true,
          },
        ]}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
    paddingBottom: spacing.md,
  },
  selector: {
    borderRadius: radius.md,
    backgroundColor: palette.surfaceMuted,
    padding: spacing.md,
    gap: spacing.xxs,
  },
  selectorTitle: {
    fontSize: typography.body,
    fontWeight: '700',
    color: palette.text,
  },
  selectorSubtitle: {
    fontSize: typography.label,
    color: palette.textMuted,
  },
  secondaryButton: {
    minHeight: 46,
    borderRadius: radius.md,
    backgroundColor: palette.backgroundAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonLabel: {
    color: palette.text,
    fontWeight: '700',
  },
  lineCard: {
    borderRadius: radius.md,
    backgroundColor: palette.surfaceMuted,
    padding: spacing.md,
    gap: spacing.sm,
  },
  lineTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lineTitle: {
    fontSize: typography.body,
    fontWeight: '700',
    color: palette.text,
  },
  removeLabel: {
    color: palette.danger,
    fontWeight: '700',
  },
  lineTotal: {
    fontSize: typography.body,
    fontWeight: '700',
    color: palette.primary,
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
  emptyBankInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: palette.border,
    backgroundColor: palette.backgroundAlt,
  },
  emptyBankText: {
    flex: 1,
    fontSize: typography.body,
    color: palette.textMuted,
    fontWeight: '500',
  },
});
