import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { partyInitials } from '@/src/features/parties/lib/party';
import { statusToneColors } from '@/src/features/purchases/components/PurchaseListCard';
import { purchaseDue, purchaseStatusView, type PurchaseSupplier } from '@/src/features/purchases/lib/purchase-view';
import { BottomSheet } from '@/src/shared/feedback/BottomSheet';
import { FormField } from '@/src/shared/forms/FormField';
import { FieldError } from '@/src/shared/forms/FieldError';
import { useToast } from '@/src/shared/feedback/ToastProvider';
import { useFieldErrors } from '@/src/shared/hooks/useFieldErrors';
import { nonNegativeNumber } from '@/src/shared/lib/validation';
import { PaymentMethodSelector } from '@/src/shared/forms/PaymentMethodSelector';
import { formatCurrency, prettyDate } from '@/src/shared/lib/format';
import { SegmentedTabs } from '@/src/shared/ui/SegmentedTabs';
import { SkeletonList } from '@/src/shared/ui/Skeleton';
import { Text } from '@/src/shared/ui/Text';
import { usePalette } from '@/src/stores/theme-store';
import { radius, spacing } from '@/src/theme';
import type { AppPalette } from '@/src/theme/app-palette';
import { useThemedStyles } from '@/src/theme/use-themed-styles';
import type { PaymentMethod, Purchase } from '@/src/types/models';

export interface PurchasePaymentUpdate {
  status: string;
  amountReceived: number;
  paymentMethod: PaymentMethod;
  bankId?: string;
}

interface PurchaseDetailSheetProps {
  visible: boolean;
  purchase?: Purchase | null;
  supplier: PurchaseSupplier | null;
  currency: string;
  isLoading: boolean;
  saving: boolean;
  onClose: () => void;
  onCall: (phone: string) => void;
  onSave: (update: PurchasePaymentUpdate) => void;
  onDelete: () => void;
}

const statusOptions = [
  { label: 'Received', value: 'received' },
  { label: 'Pending', value: 'pending' },
  { label: 'Cancelled', value: 'cancelled' },
];

/** One bill up close: who it came from, what is on it, and settling what is left. */
export function PurchaseDetailSheet({
  currency,
  isLoading,
  onCall,
  onClose,
  onDelete,
  onSave,
  purchase,
  saving,
  supplier,
  visible,
}: PurchaseDetailSheetProps) {
  const colors = usePalette();
  const styles = useThemedStyles(createStyles);
  const [amountPaid, setAmountPaid] = useState('0');
  const [status, setStatus] = useState('received');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [bankId, setBankId] = useState('');
  const toast = useToast();
  const fields = useFieldErrors(() => ({
    amountPaid: nonNegativeNumber(amountPaid, 'An amount paid cannot be negative.'),
    bankId: paymentMethod === 'bank' && Number(amountPaid) > 0 && !bankId
      ? 'Choose which bank account paid this.' : '',
  }), `${visible}:${purchase?.id}`);

  function savePayment() {
    if (!purchase || isLoading || saving) return;
    if (!fields.check()) {
      toast.error(fields.first);
      return;
    }
    onSave({
      status,
      amountReceived: Number(amountPaid || 0),
      paymentMethod,
      bankId: paymentMethod === 'bank' ? bankId || undefined : undefined,
    });
  }

  // Reseed the form whenever a different bill is opened.
  useEffect(() => {
    if (!purchase) return;
    setAmountPaid(String(purchase.amountReceived ?? 0));
    setStatus(purchase.status ?? 'received');
    setPaymentMethod((purchase.paymentMethod as PaymentMethod) ?? 'cash');
    setBankId(purchase.bankId ?? '');
  }, [purchase?.id, visible]);

  const total = Number(purchase?.grandTotal || 0);
  const due = purchase ? purchaseDue(purchase) : 0;
  const statusView = purchase ? purchaseStatusView(purchase) : null;
  const tone = statusView ? statusToneColors(statusView.tone, colors) : null;
  const items = purchase?.items ?? [];

  return (
    <BottomSheet
      visible={visible}
      title={supplier?.name || purchase?.invoiceNo || 'Bill'}
      subtitle={purchase ? `#${purchase.invoiceNo || '—'} · ${prettyDate(purchase.purchaseDate)}` : 'Loading the bill'}
      onClose={onClose}
      fullHeight
      footer={
        <View style={styles.footer}>
          <Pressable disabled={saving || isLoading || !purchase} style={[styles.footerBtn, { backgroundColor: colors.dangerSoft }]} onPress={onDelete}>
            <Text variant="bodyStrong" tone="danger">
              Delete
            </Text>
          </Pressable>
          <Pressable
            disabled={saving || isLoading || !purchase}
            style={[styles.footerBtn, styles.footerPrimary, { backgroundColor: colors.primary }]}
            onPress={savePayment}>
            {saving ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text variant="bodyStrong" tone="onPrimary">
                Save changes
              </Text>
            )}
          </Pressable>
        </View>
      }>
      {isLoading || !purchase ? (
        <SkeletonList count={4} avatar={false} />
      ) : (
        <View style={styles.body}>
          <View style={styles.supplierRow}>
            <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
              <Text variant="heading" tone="onPrimary">
                {partyInitials(supplier?.name || 'Supplier')}
              </Text>
            </View>
            <View style={styles.supplierCopy}>
              <Text variant="bodyStrong" numberOfLines={1}>
                {supplier?.name || 'Supplier'}
              </Text>
              <Text variant="caption" tone="muted" numberOfLines={1}>
                {supplier?.phone || 'No phone number'}
              </Text>
              {supplier?.address ? (
                <Text variant="caption" tone="soft" numberOfLines={1}>
                  {supplier.address}
                </Text>
              ) : null}
            </View>
            {supplier?.phone ? (
              <Pressable
                style={[styles.callPill, { backgroundColor: colors.successSoft }]}
                onPress={() => onCall(supplier.phone)}>
                <MaterialCommunityIcons color={colors.success} name="phone" size={16} />
                <Text variant="label" tone="success">
                  Call
                </Text>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.moneyRow}>
            <View style={styles.moneyBox}>
              <Text variant="caption" tone="muted">
                Bill total
              </Text>
              <Text variant="numeric" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                {formatCurrency(total, currency)}
              </Text>
            </View>
            <View style={styles.moneyBox}>
              <Text variant="caption" tone="muted">
                Still to pay
              </Text>
              <Text
                variant="numeric"
                tone={due > 0 ? 'danger' : 'success'}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}>
                {formatCurrency(due, currency)}
              </Text>
            </View>
            {statusView && tone ? (
              <View style={[styles.statusBadge, { backgroundColor: tone.bg }]}>
                <MaterialCommunityIcons color={tone.text} name={statusView.icon} size={12} />
                <Text variant="overline" color={tone.text}>
                  {statusView.label}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.section}>
            <Text variant="overline" tone="muted">
              Settle payment
            </Text>
            <FormField
              label="Paid so far"
              value={amountPaid}
              onChangeText={setAmountPaid}
              keyboardType="decimal-pad"
              error={fields.errors.amountPaid}
              helperText={`Anything under ${formatCurrency(total, currency)} stays on the supplier's account.`}
            />
            {due > 0 ? (
              <Pressable
                style={[styles.settleButton, { backgroundColor: colors.accentSoft }]}
                onPress={() => setAmountPaid(String(total))}>
                <MaterialCommunityIcons color={colors.primary} name="cash-check" size={16} />
                <Text variant="label" tone="primary">
                  Pay the rest ({formatCurrency(due, currency)})
                </Text>
              </Pressable>
            ) : null}
            <PaymentMethodSelector
              value={paymentMethod}
              onChange={setPaymentMethod}
              bankId={bankId}
              onBankChange={setBankId}
            />
            <FieldError message={fields.errors.bankId} />
          </View>

          <View style={styles.section}>
            <Text variant="overline" tone="muted">
              Delivery status
            </Text>
            <SegmentedTabs value={status} onChange={setStatus} options={statusOptions} />
          </View>

          <View style={styles.section}>
            <Text variant="overline" tone="muted">
              {items.length ? `${items.length} ${items.length === 1 ? 'item' : 'items'} on this bill` : 'Items'}
            </Text>
            {items.length ? (
              items.map((item, index) => (
                <View key={`${purchase.id}-${item.id ?? index}`} style={styles.itemRow}>
                  <View style={styles.itemCopy}>
                    <Text variant="bodyStrong" numberOfLines={1}>
                      {item.description || item.itemType || 'Item'}
                    </Text>
                    <Text variant="caption" tone="muted" numberOfLines={1}>
                      Qty {item.quantity} × {formatCurrency(item.unitPrice, currency)}
                      {Number(item.taxRate) > 0 ? ` · ${item.taxRate}% VAT` : ''}
                    </Text>
                  </View>
                  <Text variant="bodyStrong" tone="primary" numberOfLines={1}>
                    {formatCurrency(item.lineTotal, currency)}
                  </Text>
                </View>
              ))
            ) : (
              <Text variant="caption" tone="soft">
                No line items were recorded on this bill.
              </Text>
            )}
          </View>

          {purchase.notes ? (
            <View style={styles.section}>
              <Text variant="overline" tone="muted">
                Notes
              </Text>
              <Text variant="body">{purchase.notes}</Text>
            </View>
          ) : null}
        </View>
      )}
    </BottomSheet>
  );
}

const createStyles = (colors: AppPalette) =>
  StyleSheet.create({
    body: {
      gap: spacing.lg,
      paddingBottom: spacing.xl,
    },
    supplierRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    supplierCopy: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    callPill: {
      flexShrink: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: spacing.sm,
      minHeight: 34,
      borderRadius: radius.pill,
    },
    moneyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    moneyBox: {
      flex: 1,
      minWidth: 120,
      gap: 2,
      padding: spacing.sm,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceMuted,
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: spacing.sm,
      paddingVertical: 6,
      borderRadius: radius.pill,
    },
    section: {
      gap: spacing.sm,
    },
    settleButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      minHeight: 42,
      borderRadius: radius.md,
    },
    itemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
      padding: spacing.sm,
      borderRadius: radius.md,
      backgroundColor: colors.backgroundAlt,
    },
    itemCopy: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    footer: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    footerBtn: {
      flex: 1,
      minHeight: 50,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    footerPrimary: {
      flex: 2,
    },
  });
