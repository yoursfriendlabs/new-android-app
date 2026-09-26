import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { servicesApi } from '@/src/api';
import { ActionSheet } from '@/src/shared/feedback/ActionSheet';
import { useConfirm } from '@/src/shared/feedback/ConfirmProvider';
import { useToast } from '@/src/shared/feedback/ToastProvider';
import { DatePickerField } from '@/src/shared/forms/DatePickerField';
import { FormField } from '@/src/shared/forms/FormField';
import { PaymentMethodSelector } from '@/src/shared/forms/PaymentMethodSelector';
import { PercentAmountField } from '@/src/shared/forms/PercentAmountField';
import { ProductPickerSheet } from '@/src/shared/forms/ProductPickerSheet';
import { Screen } from '@/src/shared/layout/Screen';
import { SegmentedTabs } from '@/src/shared/ui/SegmentedTabs';
import { SkeletonList } from '@/src/shared/ui/Skeleton';
import { StickyActionBar } from '@/src/shared/ui/StickyActionBar';
import { SurfaceCard } from '@/src/shared/ui/SurfaceCard';
import { useDebouncedValue } from '@/src/shared/hooks/useDebouncedValue';
import {
  invalidateAfterBill,
  useBanks,
  useProductById,
  useProducts,
  useServiceById,
} from '@/src/shared/hooks/useAppQueries';
import { formatCurrency, prettyDate } from '@/src/shared/lib/format';
import { buildServiceReceipt, openReceiptPreview } from '@/src/shared/lib/receipt';
import { partyInitials } from '@/src/features/parties/lib/party';
import { calculateServicePayment } from '@/src/features/services/lib/payment';
import { ServiceItemsCard } from '@/src/features/services/components/ServiceItemsCard';
import { ServiceLineSheet } from '@/src/features/services/components/ServiceLineSheet';
import {
  applyProductToLine,
  buildItemsPayload,
  emptyLine,
  findLineProblem,
  isServiceBillLocked,
  linesChanged,
  summarizeLines,
  toEditableLines,
  type EditableServiceLine,
} from '@/src/features/services/lib/service-items';
import {
  getServiceAttachments,
  getServiceDisplay,
  getToneColors,
  resolveServiceCustomer,
} from '@/src/features/services/lib/service-view';
import { useAuthStore } from '@/src/stores/auth-store';
import { usePalette } from '@/src/stores/theme-store';
import { radius, spacing, typography } from '@/src/theme';
import type { AppPalette } from '@/src/theme/app-palette';
import { useThemedStyles } from '@/src/theme/use-themed-styles';
import type { Product, ServiceStatus } from '@/src/types/models';

interface ServiceDetailScreenProps {
  serviceId: string;
}

/**
 * One service job, open for changes: its bill (services and products), what has
 * been paid, where it stands, and when it is due back.
 */
export function ServiceDetailScreen({ serviceId }: ServiceDetailScreenProps) {
  const colors = usePalette();
  const styles = useThemedStyles(createStyles);
  const toast = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const { businessProfile } = useAuthStore();
  const currency = businessProfile?.currencyCode || 'NPR';
  const isGym = businessProfile?.businessType === 'gym' || businessProfile?.type === 'gym';

  const { data: service, isLoading } = useServiceById(serviceId);
  const { data: banks } = useBanks();

  const [lines, setLines] = useState<EditableServiceLine[]>([]);
  const [status, setStatus] = useState<ServiceStatus>('in_progress');
  const [received, setReceived] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank'>('cash');
  const [bankId, setBankId] = useState('');
  const [discount, setDiscount] = useState(0);
  const [delivery, setDelivery] = useState('');
  const [notes, setNotes] = useState('');
  const [manualTotal, setManualTotal] = useState('0');
  const [seededId, setSeededId] = useState<string | null>(null);

  const [editingLine, setEditingLine] = useState<EditableServiceLine | null>(null);
  const [editingIsNew, setEditingIsNew] = useState(false);
  const [productPickerVisible, setProductPickerVisible] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  /** The product just picked, so its units show without waiting on a fetch. */
  const [pickedProduct, setPickedProduct] = useState<Product | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const debouncedProductSearch = useDebouncedValue(productSearch);
  const { data: products } = useProducts(debouncedProductSearch);
  const { data: fetchedProduct } = useProductById(editingLine?.productId);
  const editingProduct =
    pickedProduct && pickedProduct.id === editingLine?.productId ? pickedProduct : fetchedProduct;

  // Seed the form from the job once. Later refetches must not throw away
  // whatever the shopkeeper has half-typed.
  useEffect(() => {
    if (!service || service.id === seededId) return;
    setLines(toEditableLines(service.items));
    setStatus((service.status as ServiceStatus) ?? 'in_progress');
    setReceived(String(Number(service.receivedTotal || 0)));
    setPaymentMethod((service.paymentMethod as 'cash' | 'bank') ?? 'cash');
    setBankId(service.bankId ?? '');
    setDiscount(Number(service.discountTotal ?? service.discount ?? 0));
    setDelivery(String(service.deliveryDate || '').slice(0, 10));
    setNotes(String(service.notes || ''));
    setManualTotal(String(Number(service.grandTotal || 0)));
    setSeededId(service.id);
  }, [seededId, service]);

  const locked = isServiceBillLocked(service);
  const hadItems = (service?.items?.length ?? 0) > 0;
  /** A job priced line by line, rather than by one typed amount. */
  const itemised = lines.length > 0 || hadItems;

  const totals = useMemo(() => summarizeLines(lines, discount), [discount, lines]);
  const manualGrand = Math.max(Number(manualTotal || 0) || 0, 0);
  const grandTotal = locked
    ? Number(service?.grandTotal || 0)
    : itemised
      ? totals.grandTotal
      : manualGrand;
  const payment = useMemo(
    () => calculateServicePayment(grandTotal, Number(received || 0)),
    [grandTotal, received],
  );

  /** Nothing here is written until Save is pressed, so say when that matters. */
  const dirty = useMemo(() => {
    if (!service || service.id !== seededId) return false;
    if (!locked && linesChanged(lines, service.items)) return true;
    if (status !== ((service.status as ServiceStatus) ?? 'in_progress')) return true;
    if (Number(received || 0) !== Number(service.receivedTotal || 0)) return true;
    if (paymentMethod !== ((service.paymentMethod as string) || 'cash')) return true;
    if ((bankId || '') !== (service.bankId ?? '')) return true;
    if (!locked && itemised && totals.discountTotal !== Number(service.discountTotal ?? service.discount ?? 0)) return true;
    if (!locked && !itemised && manualGrand !== Number(service.grandTotal || 0)) return true;
    if (delivery !== String(service.deliveryDate || '').slice(0, 10)) return true;
    return notes !== String(service.notes || '');
  }, [
    bankId,
    delivery,
    itemised,
    lines,
    locked,
    manualGrand,
    notes,
    paymentMethod,
    received,
    seededId,
    service,
    status,
    totals.discountTotal,
  ]);

  const customer = service ? resolveServiceCustomer(service) : null;
  const display = service ? getServiceDisplay({ ...service, status }, isGym) : null;
  const tone = display ? getToneColors(display.tone, colors) : null;
  const attachments = getServiceAttachments(service);

  function openAdd(itemType: 'labor' | 'part') {
    setEditingLine(emptyLine(itemType));
    setEditingIsNew(true);
    if (itemType === 'part') setProductPickerVisible(true);
  }

  function openEdit(line: EditableServiceLine) {
    setEditingLine({ ...line });
    setEditingIsNew(false);
  }

  function closeLineSheet() {
    setEditingLine(null);
    setEditingIsNew(false);
  }

  function saveLine() {
    if (!editingLine) return;
    const problem = findLineProblem([editingLine]);
    if (problem) {
      toast.error(problem);
      return;
    }
    setLines((current) => {
      const index = current.findIndex((line) => line.key === editingLine.key);
      if (index < 0) return [...current, editingLine];
      const next = [...current];
      next[index] = editingLine;
      return next;
    });
    closeLineSheet();
  }

  function removeLine(key: string) {
    setLines((current) => current.filter((line) => line.key !== key));
  }

  function handlePrint() {
    if (!service) return;
    const selectedBank = banks?.find((bank) => bank.id === service.bankId);
    openReceiptPreview(
      buildServiceReceipt(
        service,
        businessProfile,
        customer?.party || { name: customer?.name, phone: customer?.phone, address: customer?.address },
        selectedBank?.name,
      ),
    );
  }

  async function handleDelete() {
    const confirmed = await confirm({
      title: 'Delete this job?',
      message: 'The job and everything recorded against it will go.',
      confirmLabel: 'Delete job',
      destructive: true,
    });
    if (!confirmed) return;
    try {
      await servicesApi.remove(serviceId);
      await invalidateAfterBill(queryClient, [service?.partyId]);
      toast.success('Job deleted');
      router.back();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Please try again.');
    }
  }

  async function handleSave() {
    if (!service || saving) return;

    if (!locked) {
      const problem = findLineProblem(lines);
      if (problem) {
        toast.error(problem);
        return;
      }
    }

    if (paymentMethod === 'bank' && payment.receivedTotal > 0 && !bankId) {
      toast.error('Choose a bank account for bank payments.');
      return;
    }

    const payload: Record<string, unknown> = {
      status,
      notes,
      deliveryDate: delivery.trim(),
      receivedTotal: payment.receivedTotal,
      paymentMethod,
      bankId: paymentMethod === 'bank' ? bankId || undefined : undefined,
    };

    if (!locked) {
      if (itemised) {
        if (linesChanged(lines, service.items)) {
          payload.items = buildItemsPayload(lines, service.items);
        }
        payload.laborTotal = totals.laborTotal;
        payload.partsTotal = totals.partsTotal;
        payload.taxTotal = totals.taxTotal;
        payload.discountTotal = totals.discountTotal;
        payload.grandTotal = totals.grandTotal;
      } else {
        payload.grandTotal = manualGrand;
      }
    }

    setSaving(true);
    try {
      await servicesApi.update(serviceId, payload);
      await Promise.all([
        invalidateAfterBill(queryClient, [service.partyId]),
        queryClient.invalidateQueries({ queryKey: ['service', serviceId] }),
      ]);
      toast.success('Job updated');
      router.back();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (isLoading && !service) {
    return (
      <Screen scrollable topBarTitle="Job details">
        <SkeletonList count={5} />
      </Screen>
    );
  }

  if (!service) {
    return (
      <Screen scrollable topBarTitle="Job details">
        <View style={styles.missing}>
          <MaterialCommunityIcons name="file-remove-outline" size={36} color={colors.textMuted} />
          <Text style={styles.missingCopy}>This job is no longer available.</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      scrollable
      topBarTitle={customer?.name || `Job #${service.orderNo}`}
      topBarRight={
        <Pressable onPress={() => setMenuVisible(true)} hitSlop={8} style={styles.kebab}>
          <MaterialCommunityIcons name="dots-vertical" size={22} color={colors.text} />
        </Pressable>
      }
      footer={
        <StickyActionBar
          secondary={{ label: 'Print bill', onPress: handlePrint }}
          primary={{
            label: saving ? 'Saving…' : 'Save changes',
            tone: 'primary',
            onPress: () => void handleSave(),
          }}
        />
      }>
      {dirty ? (
        <View style={[styles.dirtyBanner, { backgroundColor: colors.warningSoft, borderColor: colors.warning }]}>
          <MaterialCommunityIcons name="content-save-alert-outline" size={18} color={colors.warning} />
          <Text style={[styles.dirtyCopy, { color: colors.warning }]}>
            Not saved yet — press Save changes at the bottom.
          </Text>
        </View>
      ) : null}

      {/* WHO AND WHERE IT STANDS */}
      <SurfaceCard>
        <View style={styles.customerRow}>
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            <Text style={[styles.avatarText, { color: colors.onPrimary }]}>
              {partyInitials(customer?.name || 'Customer')}
            </Text>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.customerName}>{customer?.name}</Text>
            <Text style={styles.muted}>
              Job #{service.orderNo || '—'}
              {customer?.phone ? ` · ${customer.phone}` : ''}
            </Text>
            {customer?.address ? <Text style={styles.soft}>{customer.address}</Text> : null}
          </View>
          {customer?.phone ? (
            <Pressable
              style={[styles.callPill, { backgroundColor: colors.successSoft }]}
              onPress={() => void Linking.openURL(`tel:${customer.phone}`)}>
              <MaterialCommunityIcons name="phone" size={18} color={colors.success} />
            </Pressable>
          ) : null}
        </View>

        {display && tone ? (
          <View style={styles.statusStrip}>
            <View style={[styles.statusPill, { backgroundColor: tone.bg }]}>
              <MaterialCommunityIcons name={display.icon} size={13} color={tone.text} />
              <Text style={[styles.statusText, { color: tone.text }]}>{display.label}</Text>
            </View>
            <Text style={styles.muted}>
              {isGym ? 'Expiry' : 'Due back'}: {delivery ? prettyDate(delivery) : 'not set'}
            </Text>
          </View>
        ) : null}

        <SegmentedTabs
          value={status === 'closed' ? 'closed' : 'in_progress'}
          onChange={(value) => setStatus(value as ServiceStatus)}
          options={[
            { label: 'In Progress', value: 'in_progress' },
            { label: isGym ? 'Completed' : 'Closed', value: 'closed' },
          ]}
        />
      </SurfaceCard>

      {/* THE BILL */}
      <ServiceItemsCard
        lines={lines}
        totals={{ ...totals, grandTotal }}
        currency={currency}
        locked={locked}
        onAdd={openAdd}
        onEdit={openEdit}
        onRemove={(line) => removeLine(line.key)}
      />

      {/* MONEY */}
      <SurfaceCard
        title="Payment"
        subtitle={`Bill ${formatCurrency(grandTotal, currency)} · ${
          payment.balanceDue > 0 ? `${formatCurrency(payment.balanceDue, currency)} still due` : 'settled'
        }`}>
        {!locked && itemised ? (
          <PercentAmountField
            label="Discount"
            base={totals.subTotal}
            amount={totals.discountTotal}
            onChangeAmount={(amount) => setDiscount(amount ?? 0)}
          />
        ) : null}

        {!locked && !itemised ? (
          <FormField
            label="Bill amount"
            value={manualTotal}
            onChangeText={setManualTotal}
            keyboardType="numeric"
            helperText="This job has no lines yet. Add a service or product to price it line by line."
          />
        ) : null}

        <View style={styles.shortcutRow}>
          {[
            { label: `Full (${formatCurrency(grandTotal, currency)})`, value: grandTotal },
            { label: 'Half', value: Math.round(grandTotal / 2) },
            { label: 'Nothing yet', value: 0 },
          ].map((shortcut) => {
            const active = payment.tendered === shortcut.value;
            return (
              <Pressable
                key={shortcut.label}
                style={[
                  styles.shortcutBtn,
                  active && { backgroundColor: colors.primary, borderColor: colors.primary },
                ]}
                onPress={() => setReceived(String(shortcut.value))}>
                <Text
                  style={[styles.shortcutText, active && { color: colors.onPrimary }]}
                  numberOfLines={1}>
                  {shortcut.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <FormField
          label="Amount received"
          value={received}
          onChangeText={setReceived}
          keyboardType="numeric"
        />

        {payment.changeDue > 0 ? (
          <View style={[styles.noticeBox, { backgroundColor: colors.successSoft, borderColor: colors.success }]}>
            <MaterialCommunityIcons name="cash-refund" size={20} color={colors.success} />
            <Text style={[styles.noticeCopy, { color: colors.success }]}>
              {formatCurrency(payment.changeDue, currency)} to give back — only{' '}
              {formatCurrency(payment.receivedTotal, currency)} will be kept against this job.
            </Text>
          </View>
        ) : null}

        <View style={[styles.dueBox, { backgroundColor: colors.backgroundAlt, borderColor: colors.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.dueLabel}>Bill total</Text>
            <Text style={styles.dueValue}>{formatCurrency(grandTotal, currency)}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.dueLabel}>Still due</Text>
            <Text
              style={[
                styles.dueValue,
                { color: payment.balanceDue > 0 ? colors.danger : colors.success },
              ]}>
              {formatCurrency(payment.balanceDue, currency)}
            </Text>
          </View>
        </View>

        <PaymentMethodSelector
          value={paymentMethod}
          onChange={(method) => setPaymentMethod(method as 'cash' | 'bank')}
          bankId={bankId}
          onBankChange={setBankId}
        />
      </SurfaceCard>

      {/* WHEN AND WHAT */}
      <SurfaceCard title="Job details">
        <DatePickerField
          label={isGym ? 'Expiry date' : 'Due back on'}
          value={delivery}
          onChangeText={setDelivery}
        />
        <FormField label="Notes" value={notes} onChangeText={setNotes} multiline placeholder="Problem, parts promised, anything to remember" />
      </SurfaceCard>

      {attachments.length ? (
        <SurfaceCard title="Photos" subtitle={`${attachments.length} attached`}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gallery}>
            {attachments.map((uri, index) => (
              <Pressable
                key={`${uri}-${index}`}
                style={[styles.thumb, { borderColor: colors.border }]}
                onPress={() => setPreviewImage(uri)}>
                <Image source={{ uri }} style={styles.thumbImage} resizeMode="cover" />
              </Pressable>
            ))}
          </ScrollView>
        </SurfaceCard>
      ) : null}

      <ServiceLineSheet
        visible={Boolean(editingLine)}
        line={editingLine}
        product={editingProduct ?? undefined}
        currency={currency}
        isNew={editingIsNew}
        onChange={setEditingLine}
        onPickProduct={() => setProductPickerVisible(true)}
        onRemove={
          editingIsNew
            ? undefined
            : () => {
                if (editingLine) removeLine(editingLine.key);
                closeLineSheet();
              }
        }
        onClose={closeLineSheet}
        onSave={saveLine}
      />

      <ProductPickerSheet
        visible={productPickerVisible}
        search={productSearch}
        onSearchChange={setProductSearch}
        products={products ?? []}
        onPick={(product) => {
          setPickedProduct(product);
          setEditingLine((current) => (current ? applyProductToLine(current, product) : current));
          setProductPickerVisible(false);
        }}
        onClose={() => setProductPickerVisible(false)}
      />

      <ActionSheet
        visible={menuVisible}
        title={`Job #${service.orderNo || ''}`}
        subtitle="What would you like to do?"
        onClose={() => setMenuVisible(false)}
        actions={[
          { id: 'print', label: 'View & print bill', icon: 'printer-outline', onPress: handlePrint },
          {
            id: 'delete',
            label: 'Delete job',
            icon: 'trash-can-outline',
            tone: 'danger',
            onPress: () => void handleDelete(),
          },
        ]}
      />

      <Modal visible={Boolean(previewImage)} transparent animationType="fade" onRequestClose={() => setPreviewImage(null)}>
        <View style={styles.imageBackdrop}>
          <Pressable style={styles.imageClose} onPress={() => setPreviewImage(null)}>
            <MaterialCommunityIcons name="close" size={26} color={colors.onPrimary} />
          </Pressable>
          {previewImage ? <Image source={{ uri: previewImage }} style={styles.fullImage} resizeMode="contain" /> : null}
        </View>
      </Modal>

      {saving ? (
        <View style={styles.savingOverlay} pointerEvents="none">
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : null}
    </Screen>
  );
}

const createStyles = (colors: AppPalette) =>
  StyleSheet.create({
    kebab: {
      width: 34,
      height: 34,
      alignItems: 'center',
      justifyContent: 'center',
    },
    missing: {
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.xxl,
    },
    missingCopy: {
      fontSize: typography.body,
      color: colors.textMuted,
    },
    dirtyBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderWidth: 1,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    dirtyCopy: {
      flex: 1,
      fontSize: typography.caption,
      fontWeight: '700',
    },
    customerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    avatar: {
      width: 46,
      height: 46,
      borderRadius: 23,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      fontSize: typography.body,
      fontWeight: '800',
    },
    customerName: {
      fontSize: typography.subheading,
      fontWeight: '800',
      color: colors.text,
    },
    muted: {
      fontSize: typography.caption,
      color: colors.textMuted,
    },
    soft: {
      fontSize: typography.caption,
      color: colors.textSoft,
    },
    callPill: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
    },
    statusStrip: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    statusPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderRadius: radius.pill,
    },
    statusText: {
      fontSize: 11,
      fontWeight: '800',
    },
    shortcutRow: {
      flexDirection: 'row',
      gap: spacing.xs,
    },
    shortcutBtn: {
      flex: 1,
      minHeight: 42,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.backgroundAlt,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.xs,
    },
    shortcutText: {
      fontSize: typography.caption,
      fontWeight: '700',
      color: colors.text,
    },
    noticeBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderWidth: 1,
      borderRadius: radius.md,
      padding: spacing.md,
    },
    noticeCopy: {
      flex: 1,
      fontSize: typography.caption,
      fontWeight: '600',
      lineHeight: 18,
    },
    dueBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderWidth: 1,
      borderRadius: radius.md,
      padding: spacing.md,
    },
    dueLabel: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.4,
      textTransform: 'uppercase',
      color: colors.textMuted,
    },
    dueValue: {
      fontSize: typography.subheading,
      fontWeight: '800',
      color: colors.text,
    },
    gallery: {
      gap: spacing.sm,
      paddingVertical: spacing.xs,
    },
    thumb: {
      width: 92,
      height: 92,
      borderRadius: radius.md,
      borderWidth: 1,
      overflow: 'hidden',
    },
    thumbImage: {
      width: '100%',
      height: '100%',
    },
    imageBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.92)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    imageClose: {
      position: 'absolute',
      top: 48,
      right: 24,
      zIndex: 2,
    },
    fullImage: {
      width: '100%',
      height: '80%',
    },
    savingOverlay: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
