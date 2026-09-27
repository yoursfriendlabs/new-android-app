import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { normalizePurchase, unwrapEntity } from '@/src/api/normalize';
import { partyInitials } from '@/src/features/parties/lib/party';
import { PurchaseLineSheet } from '@/src/features/purchases/components/PurchaseLineSheet';
import {
  applyProductToLine,
  buildPurchasePayload,
  createPurchaseDraft,
  createPurchaseLine,
  findDraftProblem,
  isDraftDirty,
  lineLabel,
  lineTotalOf,
  lineUnitLabel,
  nextInvoiceNo,
  purchaseTotals,
} from '@/src/features/purchases/lib/purchase-draft';
import { cacheRecentPurchases } from '@/src/data/cache';
import { submitWithOfflineQueue } from '@/src/data/sync';
import { useConfirm } from '@/src/shared/feedback/ConfirmProvider';
import { SuccessSheet } from '@/src/shared/feedback/SuccessSheet';
import { useToast } from '@/src/shared/feedback/ToastProvider';
import { DatePickerField } from '@/src/shared/forms/DatePickerField';
import { FormField } from '@/src/shared/forms/FormField';
import { PartyPickerFlow } from '@/src/shared/forms/PartyPickerFlow';
import { PaymentMethodSelector } from '@/src/shared/forms/PaymentMethodSelector';
import { PercentAmountField } from '@/src/shared/forms/PercentAmountField';
import { ProductPickerSheet } from '@/src/shared/forms/ProductPickerSheet';
import { useDebouncedValue } from '@/src/shared/hooks/useDebouncedValue';
import { useDraftState } from '@/src/shared/hooks/useDraftState';
import { useIsTablet } from '@/src/shared/hooks/useIsTablet';
import { invalidateAfterBill, useNextSequences, useParties, useProducts } from '@/src/shared/hooks/useAppQueries';
import { Screen } from '@/src/shared/layout/Screen';
import { formatCurrency } from '@/src/shared/lib/format';
import { buildReceiptHtml, type ReceiptInput } from '@/src/shared/lib/receipt';
import { StickyActionBar } from '@/src/shared/ui/StickyActionBar';
import { SurfaceCard } from '@/src/shared/ui/SurfaceCard';
import { Text } from '@/src/shared/ui/Text';
import { TotalsCard } from '@/src/shared/ui/TotalsCard';
import { useAuthStore } from '@/src/stores/auth-store';
import { useReceiptStore } from '@/src/stores/receipt-store';
import { usePalette } from '@/src/stores/theme-store';
import { radius, spacing } from '@/src/theme';
import type { AppPalette } from '@/src/theme/app-palette';
import { useThemedStyles } from '@/src/theme/use-themed-styles';
import type { DraftPurchaseLine, PurchaseDraft } from '@/src/types/forms';
import type { Purchase } from '@/src/types/models';

/** Widest the form goes on a tablet, so fields do not stretch across the whole slab. */
const CONTENT_MAX_WIDTH = 720;

export function PurchaseCreateScreen() {
  const colors = usePalette();
  const toast = useToast();
  const confirm = useConfirm();
  const styles = useThemedStyles(createStyles);
  const isTablet = useIsTablet();
  const currency = useAuthStore((state) => state.businessProfile?.currencyCode) || 'NPR';
  const setReceipt = useReceiptStore((state) => state.setReceipt);
  const queryClient = useQueryClient();

  const [partySearch, setPartySearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [partyPickerVisible, setPartyPickerVisible] = useState(false);
  const [productPickerVisible, setProductPickerVisible] = useState(false);
  const [editingLine, setEditingLine] = useState<DraftPurchaseLine | null>(null);
  const [isNewLine, setIsNewLine] = useState(false);
  const [lineSheetVisible, setLineSheetVisible] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [successState, setSuccessState] = useState({ visible: false, queued: false });

  const debouncedPartySearch = useDebouncedValue(partySearch);
  const debouncedProductSearch = useDebouncedValue(productSearch);
  const { data: parties } = useParties(debouncedPartySearch, 'supplier');
  const { data: products } = useProducts(debouncedProductSearch);
  const { data: nextSequences } = useNextSequences();

  // Leaving this screen throws the saved copy away, so the next new purchase
  // starts empty. Only an app the phone killed mid-entry gets it back.
  const draft = useDraftState<PurchaseDraft>('draft:purchase', createPurchaseDraft(), { discardOnUnmount: true });
  const totals = useMemo(() => purchaseTotals(draft.value), [draft.value]);
  const draftRef = useRef(draft.value);
  draftRef.current = draft.value;

  useEffect(() => {
    if (!draft.isReady) return;
    draft.setValue((current) => {
      const invoiceNo = nextInvoiceNo(current.invoiceNo, nextSequences?.purchase);
      return invoiceNo === current.invoiceNo ? current : { ...current, invoiceNo };
    });
  }, [draft.isReady, draft.setValue, draft.value.invoiceNo, nextSequences?.purchase]);

  const closeForm = useCallback(async () => {
    if (isDraftDirty(draftRef.current)) {
      const discard = await confirm({
        title: 'Discard this purchase?',
        message: 'The supplier, items and payment you entered here will not be kept.',
        confirmLabel: 'Discard',
        cancelLabel: 'Keep editing',
        destructive: true,
        icon: 'trash-can-outline',
      });
      if (!discard) return;
    }
    await draft.reset(createPurchaseDraft());
    router.back();
  }, [confirm, draft]);

  // Android's back button leaves the same way the Cancel button does.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!isDraftDirty(draftRef.current)) return false;
      void closeForm();
      return true;
    });
    return () => subscription.remove();
  }, [closeForm]);

  function patchDraft(patch: Partial<PurchaseDraft>) {
    draft.setValue((current) => ({ ...current, ...patch }));
    setProblem(null);
  }

  function openNewLine(line: DraftPurchaseLine) {
    setEditingLine(line);
    setIsNewLine(true);
    setLineSheetVisible(true);
  }

  function openExistingLine(line: DraftPurchaseLine) {
    setEditingLine({ ...line });
    setIsNewLine(false);
    setLineSheetVisible(true);
  }

  function closeLineSheet() {
    setLineSheetVisible(false);
    setEditingLine(null);
  }

  function saveEditingLine() {
    if (!editingLine) return;
    const line = editingLine;
    draft.setValue((current) => {
      const index = current.items.findIndex((item) => item.id === line.id);
      if (index < 0) return { ...current, items: [...current.items, line] };
      const items = [...current.items];
      items[index] = line;
      return { ...current, items };
    });
    setProblem(null);
    closeLineSheet();
  }

  function removeLine(id: string) {
    draft.setValue((current) => ({ ...current, items: current.items.filter((item) => item.id !== id) }));
    setProblem(null);
  }

  async function savePurchase() {
    const found = findDraftProblem(draft.value);
    if (found) {
      setProblem(found);
      toast.error(found);
      return;
    }

    setSaving(true);
    try {
      const payload = buildPurchasePayload(draft.value, totals);
      const result = await submitWithOfflineQueue<Purchase, typeof payload>({
        entityType: 'purchase',
        method: 'POST',
        path: '/api/purchases',
        body: payload,
      });

      const supplier = draft.value.supplier;
      const receiptData: ReceiptInput = {
        heading: 'Purchase Bill',
        reference: draft.value.invoiceNo,
        date: draft.value.purchaseDate,
        subtitle: supplier?.name,
        partyName: supplier?.name,
        partyPhone: supplier?.phone ? String(supplier.phone) : undefined,
        paymentMethod: draft.value.paymentMethod,
        lines: draft.value.items.map((line) => ({
          name: lineLabel(line),
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          lineTotal: lineTotalOf(line),
        })),
        subTotal: totals.subTotal,
        taxTotal: totals.taxTotal,
        discountTotal: totals.discountTotal,
        grandTotal: totals.grandTotal,
        amountReceived: totals.paid,
        dueAmount: totals.due,
      };

      setReceipt({
        title: draft.value.invoiceNo,
        subtitle: supplier?.name ?? '',
        html: buildReceiptHtml(receiptData),
        data: receiptData,
      });

      if (result.data) {
        await cacheRecentPurchases([normalizePurchase(unwrapEntity(result.data))]);
        // New stock, the supplier's balance and the purchase list all changed.
        await invalidateAfterBill(queryClient, [supplier?.id]);
      }

      await draft.reset(createPurchaseDraft());
      setSuccessState({ visible: true, queued: result.queued });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const supplier = draft.value.supplier;
  const halfNow = Math.round((totals.grandTotal / 2) * 100) / 100;
  const paidChips = [
    { label: 'Paid in full', amount: totals.grandTotal, active: totals.paid > 0 && totals.due === 0 },
    { label: 'Half now', amount: halfNow, active: totals.paid > 0 && totals.paid === halfNow },
    { label: 'Nothing yet', amount: 0, active: totals.paid === 0 },
  ];

  return (
    <Screen
      topBarTitle="New purchase"
      footer={
        <StickyActionBar
          leading={
            <View style={styles.barTotals}>
              <View style={styles.barTotalsCol}>
                <Text variant="caption" tone="muted">
                  {totals.lineCount ? `${totals.lineCount} ${totals.lineCount === 1 ? 'item' : 'items'}` : 'No items yet'}
                </Text>
                <Text variant="numeric">{formatCurrency(totals.grandTotal, currency)}</Text>
              </View>
              <View style={[styles.barTotalsCol, styles.barTotalsRight]}>
                <Text variant="caption" tone="muted">
                  Still to pay
                </Text>
                <Text variant="numeric" tone={totals.due > 0 ? 'warning' : 'success'}>
                  {formatCurrency(totals.due, currency)}
                </Text>
              </View>
            </View>
          }
          secondary={{ label: 'Cancel', onPress: () => void closeForm() }}
          primary={{ label: saving ? 'Saving…' : 'Save purchase', onPress: () => void savePurchase() }}
        />
      }>
      <View style={[styles.wrap, isTablet && styles.wrapWide]}>
        {problem ? (
          <View style={styles.problemBanner}>
            <MaterialCommunityIcons color={colors.danger} name="alert-circle-outline" size={18} />
            <Text variant="label" tone="danger" style={styles.problemText}>
              {problem}
            </Text>
          </View>
        ) : null}

        <SurfaceCard title="Supplier and bill" subtitle="Who it came from, and which bill it is.">
          <Pressable style={styles.selectorRow} onPress={() => setPartyPickerVisible(true)}>
            <View
              style={[
                styles.selectorAvatar,
                { backgroundColor: supplier ? colors.primary : colors.backgroundAlt },
              ]}>
              {supplier ? (
                <Text variant="bodyStrong" tone="onPrimary">
                  {partyInitials(supplier.name)}
                </Text>
              ) : (
                <MaterialCommunityIcons color={colors.textMuted} name="account-search-outline" size={20} />
              )}
            </View>
            <View style={styles.selectorCopy}>
              <Text variant="bodyStrong" numberOfLines={1}>
                {supplier?.name ?? 'Pick a supplier'}
              </Text>
              <Text variant="caption" tone="muted" numberOfLines={1}>
                {supplier?.phone ?? 'Search your suppliers, or add a new one'}
              </Text>
            </View>
            <MaterialCommunityIcons color={colors.textMuted} name="chevron-right" size={22} />
          </Pressable>

          <View style={styles.row}>
            <View style={styles.col}>
              <FormField
                label="Invoice number"
                value={draft.value.invoiceNo}
                onChangeText={(invoiceNo) => patchDraft({ invoiceNo })}
              />
            </View>
            <View style={styles.col}>
              <DatePickerField
                label="Purchase date"
                value={draft.value.purchaseDate}
                onChangeText={(purchaseDate) => patchDraft({ purchaseDate })}
              />
            </View>
          </View>

          <FormField
            label="Notes"
            value={draft.value.notes}
            onChangeText={(notes) => patchDraft({ notes })}
            placeholder="Anything to remember about this delivery"
            multiline
          />
        </SurfaceCard>

        <SurfaceCard
          title="Items"
          subtitle={
            totals.lineCount
              ? `${totals.lineCount} ${totals.lineCount === 1 ? 'line' : 'lines'} · ${formatCurrency(totals.subTotal, currency)} before tax`
              : 'What came in, how many, and what each one cost.'
          }>
          {draft.value.items.length ? (
            <View style={styles.lines}>
              {draft.value.items.map((line) => (
                <Pressable key={line.id} style={styles.lineRow} onPress={() => openExistingLine(line)}>
                  <View style={[styles.lineIcon, { backgroundColor: colors.accentSoft }]}>
                    <MaterialCommunityIcons
                      color={colors.accent}
                      name={line.product ? 'package-variant-closed' : 'tag-outline'}
                      size={18}
                    />
                  </View>
                  <View style={styles.lineCopy}>
                    <Text variant="bodyStrong" numberOfLines={1}>
                      {lineLabel(line)}
                    </Text>
                    <Text variant="caption" tone="muted" numberOfLines={1}>
                      {line.quantity} {lineUnitLabel(line)} × {formatCurrency(line.unitPrice, currency)}
                      {line.taxRate > 0 ? ` · ${line.taxRate}% VAT` : ''}
                    </Text>
                  </View>
                  <View style={styles.lineRight}>
                    <Text variant="bodyStrong" numberOfLines={1}>
                      {formatCurrency(lineTotalOf(line), currency)}
                    </Text>
                    <Pressable hitSlop={8} onPress={() => removeLine(line.id)}>
                      <Text variant="caption" tone="danger">
                        Remove
                      </Text>
                    </Pressable>
                  </View>
                </Pressable>
              ))}
            </View>
          ) : (
            <View style={styles.emptyLines}>
              <MaterialCommunityIcons color={colors.textSoft} name="package-variant" size={32} />
              <Text variant="label" tone="muted" align="center">
                Nothing on this bill yet. Add the first item below.
              </Text>
            </View>
          )}

          <View style={styles.addRow}>
            <Pressable
              style={[styles.addButton, { backgroundColor: colors.primary }]}
              onPress={() => {
                setEditingLine(null);
                setIsNewLine(true);
                setProductPickerVisible(true);
              }}>
              <MaterialCommunityIcons color={colors.onPrimary} name="barcode-scan" size={18} />
              <Text variant="bodyStrong" tone="onPrimary">
                Add from stock
              </Text>
            </Pressable>
            <Pressable style={styles.addGhost} onPress={() => openNewLine(createPurchaseLine())}>
              <Text variant="label" tone="primary">
                One-off item
              </Text>
            </Pressable>
          </View>
        </SurfaceCard>

        <SurfaceCard title="Payment" subtitle="What you handed over now. The rest stays on the supplier's account.">
          <View style={styles.chipRow}>
            {paidChips.map((chip) => (
              <Pressable
                key={chip.label}
                style={[styles.chip, { backgroundColor: chip.active ? colors.primary : colors.backgroundAlt }]}
                onPress={() => patchDraft({ amountPaid: chip.amount })}>
                <Text variant="label" tone={chip.active ? 'onPrimary' : 'muted'}>
                  {chip.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <FormField
            label="Amount paid"
            value={String(draft.value.amountPaid)}
            onChangeText={(amountPaid) => patchDraft({ amountPaid: Number(amountPaid || 0) })}
            keyboardType="decimal-pad"
            helperText={
              totals.due > 0
                ? `${formatCurrency(totals.due, currency)} stays due to ${supplier?.name ?? 'the supplier'}.`
                : 'This bill is settled in full.'
            }
          />

          {draft.value.amountPaid > 0 ? (
            <PaymentMethodSelector
              value={draft.value.paymentMethod}
              onChange={(paymentMethod) => patchDraft({ paymentMethod })}
              bankId={draft.value.bankId}
              onBankChange={(bankId) => patchDraft({ bankId })}
            />
          ) : null}

          <FormField
            label="Payment note"
            value={draft.value.paymentNote}
            onChangeText={(paymentNote) => patchDraft({ paymentNote })}
            placeholder="Cheque number, reference, who took the money"
          />

          <PercentAmountField
            label="Discount"
            base={totals.subTotal}
            amount={draft.value.discount}
            onChangeAmount={(discount) => patchDraft({ discount: discount ?? 0 })}
          />
          <PercentAmountField
            label="Tax"
            base={Math.max(totals.subTotal - totals.discountTotal, 0)}
            amount={totals.taxTotal}
            helperText={draft.value.taxOverride === undefined ? 'From each item’s tax rate' : undefined}
            onChangeAmount={(taxOverride) => patchDraft({ taxOverride })}
          />

          <TotalsCard
            subTotal={totals.subTotal}
            taxTotal={totals.taxTotal}
            discountTotal={totals.discountTotal}
            grandTotal={totals.grandTotal}
            amountReceived={totals.paid}
          />
        </SurfaceCard>
      </View>

      <PartyPickerFlow
        visible={partyPickerVisible}
        search={partySearch}
        onSearchChange={setPartySearch}
        parties={parties ?? []}
        onPick={(party) => {
          patchDraft({ supplier: party });
          setPartyPickerVisible(false);
        }}
        onClose={() => setPartyPickerVisible(false)}
        allowWalkIn={false}
        createLabel="Add new supplier"
        title="Select supplier"
        subtitle="Pick a supplier, or add one without leaving this purchase."
      />

      <ProductPickerSheet
        visible={productPickerVisible}
        search={productSearch}
        onSearchChange={setProductSearch}
        products={products ?? []}
        onPick={(product) => {
          setProductPickerVisible(false);
          const base = editingLine ?? createPurchaseLine();
          const next = applyProductToLine(base, product);
          setEditingLine(next);
          setLineSheetVisible(true);
        }}
        onClose={() => setProductPickerVisible(false)}
      />

      <PurchaseLineSheet
        visible={lineSheetVisible}
        line={editingLine}
        isNew={isNewLine}
        currency={currency}
        onChange={setEditingLine}
        onPickProduct={() => setProductPickerVisible(true)}
        onRemove={
          isNewLine || !editingLine
            ? undefined
            : () => {
                removeLine(editingLine.id);
                closeLineSheet();
              }
        }
        onClose={closeLineSheet}
        onSave={saveEditingLine}
      />

      <SuccessSheet
        visible={successState.visible}
        queued={successState.queued}
        title="Purchase saved"
        message="Stock is in and the supplier's balance is updated. Open the bill, or start the next one."
        onClose={() => setSuccessState({ visible: false, queued: false })}
        actions={[
          {
            label: 'View bill',
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

const createStyles = (colors: AppPalette) =>
  StyleSheet.create({
    wrap: {
      gap: spacing.md,
    },
    wrapWide: {
      width: '100%',
      maxWidth: CONTENT_MAX_WIDTH,
      alignSelf: 'center',
    },
    problemBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      padding: spacing.sm,
      borderRadius: radius.md,
      backgroundColor: colors.dangerSoft,
    },
    problemText: {
      flex: 1,
      minWidth: 0,
    },
    selectorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceMuted,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    selectorAvatar: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    selectorCopy: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    row: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    col: {
      flex: 1,
      minWidth: 0,
    },
    lines: {
      gap: spacing.xs,
    },
    lineRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceMuted,
      padding: spacing.sm,
    },
    lineIcon: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    lineCopy: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    lineRight: {
      alignItems: 'flex-end',
      gap: 2,
      flexShrink: 0,
    },
    emptyLines: {
      alignItems: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.lg,
      borderRadius: radius.md,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.border,
    },
    addRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    addButton: {
      flex: 1,
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      borderRadius: radius.md,
    },
    addGhost: {
      minHeight: 48,
      paddingHorizontal: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
    },
    chip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radius.pill,
      minHeight: 36,
      justifyContent: 'center',
    },
    barTotals: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    barTotalsCol: {
      minWidth: 0,
      gap: 1,
    },
    barTotalsRight: {
      alignItems: 'flex-end',
    },
  });
