import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ApiError } from '@/src/api/client';
import { normalizeService, unwrapEntity } from '@/src/api/normalize';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { cacheRecentServices } from '@/src/data/cache';
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
import { getAttachmentLabel, isImageAttachment, uploadAttachments } from '@/src/lib/uploads';
import { formatCurrency, todayIso } from '@/src/lib/format';
import { computeGrandTotal, computeLineTotal, computeSubTotal, computeTaxTotal } from '@/src/lib/totals';
import { useBanks, useNextSequences, useOrderAttributes, useParties, useProducts } from '@/src/hooks/useAppQueries';
import { useDebouncedValue } from '@/src/hooks/useDebouncedValue';
import { useDraftState } from '@/src/hooks/useDraftState';
import { generateId } from '@/src/lib/id';
import { palette, radius, spacing, typography } from '@/src/theme';
import { useReceiptStore } from '@/src/stores/receipt-store';
import type { DraftServiceLine, ServiceDraft } from '@/src/types/forms';
import type { Service } from '@/src/types/models';

const steps = ['Customer', 'Job', 'Items', 'Payment', 'Review'] as const;

function createEmptyServiceDraft(): ServiceDraft {
  return {
    customer: null,
    orderNo: `SO-${Date.now().toString().slice(-6)}`,
    status: 'open',
    deliveryDate: todayIso(),
    notes: '',
    paymentMethod: 'cash',
    bankId: undefined,
    paymentNote: '',
    receivedTotal: 0,
    discount: 0,
    attributes: {
      Device: '',
    },
    attachments: [],
    items: [],
  };
}

function createLine(itemType: 'labor' | 'part'): DraftServiceLine {
  return {
    id: generateId(itemType),
    itemType,
    product: null,
    description: '',
    quantity: 1,
    unitType: 'primary',
    unitPrice: 0,
    taxRate: itemType === 'part' ? 13 : 0,
  };
}

export default function ServiceCreateScreen() {
  const setReceipt = useReceiptStore((state) => state.setReceipt);
  const [stepIndex, setStepIndex] = useState(0);
  const [partySearch, setPartySearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [partyPickerVisible, setPartyPickerVisible] = useState(false);
  const [productPickerVisible, setProductPickerVisible] = useState(false);
  const [targetLineId, setTargetLineId] = useState<string | null>(null);
  const [successVisible, setSuccessVisible] = useState(false);
  const [queued, setQueued] = useState(false);
  const [formError, setFormError] = useState('');
  const [orderNumberError, setOrderNumberError] = useState('');
  const debouncedPartySearch = useDebouncedValue(partySearch);
  const debouncedProductSearch = useDebouncedValue(productSearch);
  const { data: parties } = useParties(debouncedPartySearch, 'customer');
  const { data: products } = useProducts(debouncedProductSearch);
  const { data: banks } = useBanks();
  const { data: nextSequences } = useNextSequences();
  const { data: orderAttributes } = useOrderAttributes('service');
  const activeBanks = (banks ?? []).filter((bank) => bank.isActive);
  const draft = useDraftState<ServiceDraft>('draft:service', createEmptyServiceDraft());

  useEffect(() => {
    if (!draft.isReady) return;

    draft.setValue((current) => {
      const seededAttributes = orderAttributes?.reduce<Record<string, string>>((result, attribute) => {
        result[attribute.key] =
          current.attributes[attribute.key] ??
          String(attribute.defaultValue ?? '');
        return result;
      }, {}) ?? current.attributes;

      return {
        ...current,
        orderNo:
          current.orderNo.startsWith('SO-') && nextSequences?.service
            ? nextSequences.service
            : current.orderNo,
        attributes: seededAttributes,
      };
    });
  }, [draft.isReady, draft.setValue, nextSequences?.service, orderAttributes]);

  const laborTotal = useMemo(
    () =>
      computeSubTotal(
        draft.value.items
          .filter((item) => item.itemType === 'labor')
          .map((item) => ({ quantity: item.quantity, unitPrice: item.unitPrice, taxRate: item.taxRate })),
      ),
    [draft.value.items],
  );
  const partsTotal = useMemo(
    () =>
      computeSubTotal(
        draft.value.items
          .filter((item) => item.itemType === 'part')
          .map((item) => ({ quantity: item.quantity, unitPrice: item.unitPrice, taxRate: item.taxRate })),
      ),
    [draft.value.items],
  );
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

  function updateLine(id: string, patch: Partial<DraftServiceLine>) {
    draft.setValue((current) => ({
      ...current,
      items: current.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));
  }

  function removeLine(id: string) {
    draft.setValue((current) => ({
      ...current,
      items: current.items.filter((item) => item.id !== id),
    }));
  }

  async function addPhotoAttachment() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: 5,
    });
    if (!result.canceled && result.assets?.length) {
      draft.setValue((current) => ({
        ...current,
        attachments: [...current.attachments, ...result.assets.map((asset) => asset.uri)],
      }));
    }
  }

  async function addDocumentAttachment() {
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (!result.canceled && result.assets?.[0]?.uri) {
      draft.setValue((current) => ({
        ...current,
        attachments: [...current.attachments, result.assets[0].uri],
      }));
    }
  }

  function removeAttachment(uri: string) {
    draft.setValue((current) => ({
      ...current,
      attachments: current.attachments.filter((attachment) => attachment !== uri),
    }));
  }

  async function saveService() {
    setFormError('');
    setOrderNumberError('');

    if (!draft.value.customer?.id) {
      setFormError('Select a customer before saving the service order.');
      setStepIndex(0);
      return;
    }

    if (draft.value.paymentMethod === 'bank' && draft?.value?.receivedTotal > 0 && !draft.value.bankId) {
      setFormError('Choose a bank account for bank payments.');
      setStepIndex(3);
      return;
    }

    const invalidSecondaryLine = draft.value.items.find(
      (item) =>
        item.itemType === 'part' &&
        item.unitType === 'secondary' &&
        !item.product?.secondaryConversionRate,
    );

    if (invalidSecondaryLine) {
      setFormError('This product is missing a secondary unit conversion rate.');
      setStepIndex(2);
      return;
    }

    try {
      const uploadedAttachmentUrls = await uploadAttachments(draft.value.attachments);

      const payload = {
        partyId: draft.value.customer.id,
        orderNo: draft.value.orderNo,
        status: draft.value.status,
        notes: draft.value.notes,
        deliveryDate: draft.value.deliveryDate,
        paymentMethod: draft.value.paymentMethod,
        bankId:
          draft.value.paymentMethod === 'bank' ? draft.value.bankId : undefined,
        paymentNote: draft.value.paymentNote,
        attachment: uploadedAttachmentUrls[0],
        attachments: uploadedAttachmentUrls,
        attributes: {
          ...draft.value.attributes,
          discount: draft.value.discount,
          discountTotal: draft.value.discount,
        },
        laborTotal,
        partsTotal,
        subTotal,
        taxTotal,
        discount: draft.value.discount,
        discountTotal: draft?.value?.discount,
        grandTotal,
        receivedTotal: draft?.value?.receivedTotal,
        createdBy: undefined,
        items: draft.value.items.map((item) => ({
          itemType: item.itemType,
          description: item.description || item.product?.name || '',
          productId: item.product?.id ?? '',
          quantity: item.quantity,
          unitType: item.unitType,
          conversionRate:
            item.unitType === 'secondary'
              ? item.product?.secondaryConversionRate ?? 0
              : 0,
          unitPrice: item.unitPrice,
          taxRate: item.taxRate,
          lineTotal: computeLineTotal(item),
        })),
      };

      const result = await submitWithOfflineQueue<Service, typeof payload>({
        entityType: 'service',
        method: 'POST',
        path: '/api/services',
        body: payload,
      });

      setReceipt({
        title: draft.value.orderNo,
        subtitle: draft.value.customer.name,
        html: buildReceiptHtml({
          heading: 'Service Order',
          reference: draft.value.orderNo,
          date: draft.value.deliveryDate,
          subtitle: draft.value.customer.name,
          lines: draft.value.items.map((item) => ({
            name: item.product?.name ?? (item.description || item.itemType),
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            lineTotal: computeLineTotal(item),
          })),
          subTotal,
          taxTotal,
          discountTotal: draft.value?.discount,
          grandTotal,
          amountReceived: draft.value?.receivedTotal,
        }),
      });

      if (result.data) {
        await cacheRecentServices([normalizeService(unwrapEntity(result.data))]);
      }

      await draft.reset(createEmptyServiceDraft());
      setQueued(result.queued);
      setSuccessVisible(true);
      setStepIndex(0);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to save the service order.';

      if (
        error instanceof ApiError &&
        error.status === 409 &&
        message === 'Service order number already exists'
      ) {
        setOrderNumberError(message);
        setFormError(message);
        setStepIndex(1);
        return;
      }

      setFormError(message);
    }
  }

  const content = (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      <View style={styles.wizardHeader}>
        <View style={styles.progressTimeline}>
          <View style={styles.progressLineBg} />
          <View
            style={[
              styles.progressLineActive,
              { width: `${(stepIndex / (steps.length - 1)) * 100}%` },
            ]}
          />
          <View style={styles.nodesContainer}>
            {steps.map((step, index) => {
              const isCompleted = index < stepIndex;
              const isActive = index === stepIndex;
              
              return (
                <View key={step} style={styles.stepNodeWrapper}>
                  <View
                    style={[
                      styles.stepCircle,
                      isCompleted && styles.stepCircleCompleted,
                      isActive && styles.stepCircleActive,
                    ]}>
                    {isCompleted ? (
                      <MaterialCommunityIcons name="check" size={14} color={palette.white} />
                    ) : (
                      <Text
                        style={[
                          styles.stepNodeText,
                          isActive && styles.stepNodeTextActive,
                        ]}>
                        {index + 1}
                      </Text>
                    )}
                  </View>
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.stepNodeLabel,
                      isActive && styles.stepNodeLabelActive,
                    ]}>
                    {step}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>

      {formError ? (
        <SurfaceCard>
          <Text style={styles.errorText}>{formError}</Text>
        </SurfaceCard>
      ) : null}

      {stepIndex === 0 ? (
        <SurfaceCard title="Customer Details" subtitle="Select a customer to associate with this service order.">
          {draft.value.customer ? (
            <View style={styles.selectedCustomerCard}>
              <View style={styles.customerAvatarLarge}>
                <Text style={styles.customerAvatarText}>
                  {draft.value.customer.name.slice(0, 2).toUpperCase()}
                </Text>
              </View>
              <View style={styles.customerDetailsCopy}>
                <Text style={styles.selectedCustomerName}>{draft.value.customer.name}</Text>
                {draft.value.customer.phone ? (
                  <View style={styles.detailRowMini}>
                    <MaterialCommunityIcons name="phone" size={14} color={palette.textSoft} />
                    <Text style={styles.selectedCustomerPhone}>{draft.value.customer.phone}</Text>
                  </View>
                ) : null}
                {draft.value.customer.address ? (
                  <View style={styles.detailRowMini}>
                    <MaterialCommunityIcons name="map-marker" size={14} color={palette.textSoft} />
                    <Text style={styles.selectedCustomerPhone}>{draft.value.customer.address}</Text>
                  </View>
                ) : null}
              </View>
              <Pressable style={styles.swapCustomerBtn} onPress={() => setPartyPickerVisible(true)}>
                <MaterialCommunityIcons name="swap-horizontal" size={18} color={palette.primary} />
                <Text style={styles.swapCustomerBtnLabel}>Change</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable style={styles.emptySelectorCard} onPress={() => setPartyPickerVisible(true)}>
              <View style={styles.emptySelectorIconWrap}>
                <MaterialCommunityIcons name="account-search-outline" size={32} color={palette.textSoft} />
              </View>
              <Text style={styles.emptySelectorLabel}>Select Customer for Service</Text>
              <Text style={styles.emptySelectorSub}>Tap to search your customer database</Text>
            </Pressable>
          )}
        </SurfaceCard>
      ) : null}

      {stepIndex === 1 ? (
        <SurfaceCard title="Job details" subtitle="Order, status, delivery, notes, and optional custom attributes.">
          <FormField
            label="Order number"
            value={draft.value.orderNo}
            onChangeText={(orderNo) => {
              setOrderNumberError('');
              setFormError('');
              draft.setValue((current) => ({ ...current, orderNo }));
            }}
            error={orderNumberError}
            helperText="The backend keeps service order numbers unique per business."
          />
          <SegmentedTabs
            value={draft.value.status as 'open' | 'in_progress' | 'ready'}
            onChange={(status) => draft.setValue((current) => ({ ...current, status }))}
            options={[
              { label: 'Open', value: 'open' },
              { label: 'In progress', value: 'in_progress' },
              { label: 'Ready', value: 'ready' },
            ]}
          />
          <FormField
            label="Delivery date"
            value={draft.value.deliveryDate}
            onChangeText={(deliveryDate) => draft.setValue((current) => ({ ...current, deliveryDate }))}
          />
          <FormField
            label="Notes"
            value={draft.value.notes}
            onChangeText={(notes) => draft.setValue((current) => ({ ...current, notes }))}
            multiline
          />
          <View style={styles.attributeWrap}>
            {(orderAttributes ?? []).map((attribute, index) => {
              const attributeValue = draft.value.attributes[attribute.key] ?? '';
              const label = attribute.required ? `${attribute.label} *` : attribute.label;

              if (attribute.fieldType === 'select' && attribute.options?.length) {
                return (
                  <View key={`${attribute.key}-${index}`} style={styles.attributeRow}>
                    <Text style={styles.attributeLabel}>{label}</Text>
                    <SegmentedTabs
                      value={String(attributeValue || attribute.options[0] || '')}
                      onChange={(nextValue) =>
                        draft.setValue((current) => ({
                          ...current,
                          attributes: { ...current.attributes, [attribute.key]: nextValue },
                        }))
                      }
                      options={attribute.options.map((option) => ({ label: option, value: option }))}
                    />
                  </View>
                );
              }

              if (attribute.fieldType === 'toggle') {
                return (
                  <View key={`${attribute.key}-${index}`} style={styles.attributeRow}>
                    <Text style={styles.attributeLabel}>{label}</Text>
                    <SegmentedTabs
                      value={String(attributeValue || 'false')}
                      onChange={(nextValue) =>
                        draft.setValue((current) => ({
                          ...current,
                          attributes: { ...current.attributes, [attribute.key]: nextValue },
                        }))
                      }
                      options={[
                        { label: 'No', value: 'false' },
                        { label: 'Yes', value: 'true' },
                      ]}
                    />
                  </View>
                );
              }

              return (
                <FormField
                  key={`${attribute.key}-${index}`}
                  label={label}
                  value={String(attributeValue)}
                  onChangeText={(nextValue) =>
                    draft.setValue((current) => ({
                      ...current,
                      attributes: { ...current.attributes, [attribute.key]: nextValue },
                    }))
                  }
                  keyboardType={attribute.fieldType === 'number' ? 'numeric' : 'default'}
                  multiline={attribute.fieldType === 'textarea'}
                  placeholder={attribute.placeholder}
                />
              );
            })}
          </View>
          <View style={styles.attachmentsActions}>
            <Pressable style={styles.secondaryButton} onPress={addPhotoAttachment}>
              <Text style={styles.secondaryButtonLabel}>Add photo</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={addDocumentAttachment}>
              <Text style={styles.secondaryButtonLabel}>Add file</Text>
            </Pressable>
          </View>
          {draft.value.attachments.length ? (
            <View style={styles.attachmentsPreviewGrid}>
              {draft.value.attachments.map((attachment) => (
                <View key={attachment} style={styles.attachmentCard}>
                  {isImageAttachment(attachment) ? (
                    <Image source={{ uri: attachment }} style={styles.attachmentPreview} />
                  ) : (
                    <View style={styles.attachmentFallback}>
                      <MaterialCommunityIcons color={palette.textMuted} name="file-outline" size={24} />
                    </View>
                  )}
                  <Text numberOfLines={1} style={styles.attachmentText}>
                    {getAttachmentLabel(attachment)}
                  </Text>
                  <Pressable style={styles.attachmentRemoveButton} onPress={() => removeAttachment(attachment)}>
                    <MaterialCommunityIcons color={palette.danger} name="close-circle" size={18} />
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}
        </SurfaceCard>
      ) : null}

      {stepIndex === 2 ? (
        <SurfaceCard title="Items and labor" subtitle="Labor and parts stay together so the final job total is always obvious.">
          <View style={styles.actionsRow}>
            <Pressable style={styles.secondaryButton} onPress={() => draft.setValue((current) => ({ ...current, items: [...current.items, createLine('labor')] }))}>
              <Text style={styles.secondaryButtonLabel}>+ Add labor</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => draft.setValue((current) => ({ ...current, items: [...current.items, createLine('part')] }))}>
              <Text style={styles.secondaryButtonLabel}>+ Add part</Text>
            </Pressable>
          </View>
          {draft.value.items.map((item) => (
            <View key={item.id} style={[styles.lineCard, item.itemType === 'labor' ? styles.lineCardLabor : styles.lineCardPart]}>
              <View style={styles.lineCardTop}>
                <View style={styles.lineBadge}>
                  <MaterialCommunityIcons
                    name={item.itemType === 'labor' ? 'wrench-outline' : 'package-variant-closed'}
                    size={16}
                    color={item.itemType === 'labor' ? palette.info : palette.success}
                  />
                  <Text style={[styles.lineBadgeLabel, { color: item.itemType === 'labor' ? palette.info : palette.success }]}>
                    {item.itemType === 'labor' ? 'Labor Job' : 'Part Item'}
                  </Text>
                </View>
                <Pressable onPress={() => removeLine(item.id)}>
                  <MaterialCommunityIcons name="delete-outline" size={20} color={palette.danger} />
                </Pressable>
              </View>
              {item.itemType === 'part' ? (
                <>
                  <Pressable
                    style={styles.selector}
                    onPress={() => {
                      setTargetLineId(item.id);
                      setProductPickerVisible(true);
                    }}>
                    <Text style={styles.selectorTitle}>{item.product?.name ?? 'Select part product'}</Text>
                    <Text style={styles.selectorSubtitle}>
                      {item.product ? `Stock ${item.product.stockOnHand ?? 0}` : 'Search products from inventory'}
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
                </>
              ) : null}
              <FormField
                label="Description"
                value={item.description}
                onChangeText={(description) => updateLine(item.id, { description })}
              />
              <FormField
                label="Quantity"
                value={String(item.quantity)}
                onChangeText={(quantity) => updateLine(item.id, { quantity: Number(quantity || 0) })}
                keyboardType="numeric"
              />
              <FormField
                label="Unit price"
                value={String(item.unitPrice)}
                onChangeText={(unitPrice) => updateLine(item.id, { unitPrice: Number(unitPrice || 0) })}
                keyboardType="numeric"
              />
              <FormField
                label="Tax rate"
                value={String(item.taxRate)}
                onChangeText={(taxRate) => updateLine(item.id, { taxRate: Number(taxRate || 0) })}
                keyboardType="numeric"
              />
              <Text style={styles.lineTotal}>Line total {formatCurrency(computeLineTotal(item))}</Text>
            </View>
          ))}
        </SurfaceCard>
      ) : null}

      {stepIndex === 3 ? (
        <SurfaceCard title="Payment" subtitle="Keep the payment step short and default it to cash unless the user changes it.">
          <FormField
            label="Amount received"
            value={String(draft?.value?.receivedTotal)}
            onChangeText={(receivedTotal) => draft.setValue((current) => ({ ...current, receivedTotal: Number(receivedTotal || 0) }))}
            keyboardType="numeric"
          />
          <PaymentMethodSelector
            value={draft.value.paymentMethod}
            onChange={(paymentMethod) => draft.setValue((current) => ({ ...current, paymentMethod }))}
          />
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
          <FormField
            label="Payment note"
            value={draft.value.paymentNote}
            onChangeText={(paymentNote) => draft.setValue((current) => ({ ...current, paymentNote }))}
          />
          <FormField
            label="Discount"
            value={String(draft.value.discount)}
            onChangeText={(discount) => draft.setValue((current) => ({ ...current, discount: Number(discount || 0) }))}
            keyboardType="numeric"
          />
        </SurfaceCard>
      ) : null}

      {stepIndex === 4 ? (
        <SurfaceCard title="Review Service Order" subtitle="One last glance before you save the service order.">
          <Text style={styles.reviewHeading}>{draft.value.customer?.name ?? 'No customer selected'}</Text>
          <Text style={styles.reviewMeta}>
            {draft.value.orderNo}  •  Delivery {draft.value.deliveryDate}
          </Text>
          
          <TotalsCard
            subTotal={subTotal}
            taxTotal={taxTotal}
            discountTotal={draft.value?.discount}
            grandTotal={grandTotal}
            amountReceived={draft.value?.receivedTotal}
          />
          
          <Text style={styles.reviewSectionHeading}>Order Details</Text>
          <View style={styles.reviewTableCard}>
            <View style={styles.reviewTableHeader}>
              <Text style={[styles.tableCol, styles.tableColMain, styles.tableHeadText]}>Description</Text>
              <Text style={[styles.tableCol, styles.tableColQty, styles.tableHeadText]}>Qty</Text>
              <Text style={[styles.tableCol, styles.tableColPrice, styles.tableHeadText]}>Line Total</Text>
            </View>
            <View style={styles.tableDivider} />
            {draft.value.items.map((item) => (
              <View key={item.id} style={styles.reviewTableRow}>
                <View style={[styles.tableCol, styles.tableColMain]}>
                  <Text style={styles.reviewItemName}>{item.product?.name ?? item.description ?? 'Service item'}</Text>
                  <Text style={styles.reviewItemMeta}>
                    {item.itemType === 'labor' ? 'Labor Estimate' : 'Part'}  •  {formatCurrency(item.unitPrice)}
                  </Text>
                </View>
                <Text style={[styles.tableCol, styles.tableColQty, styles.reviewItemQty]}>{item.quantity}</Text>
                <Text style={[styles.tableCol, styles.tableColPrice, styles.reviewItemTotal]}>
                  {formatCurrency(computeLineTotal(item))}
                </Text>
              </View>
            ))}
            {!draft.value.items.length && (
              <Text style={styles.emptyTableText}>No items added to this service job yet.</Text>
            )}
          </View>
        </SurfaceCard>
      ) : null}
    </ScrollView>
  );

  return (
    <Screen
      footer={
        <StickyActionBar
          secondary={{
            label: stepIndex === 0 ? 'Close' : 'Back',
            onPress: () => {
              if (stepIndex === 0) {
                router.back();
              } else {
                setStepIndex((current) => current - 1);
              }
            },
          }}
          primary={{
            label: stepIndex === steps.length - 1 ? 'Save service' : 'Next',
            onPress: () => {
              if (stepIndex === steps.length - 1) {
                void saveService();
              } else {
                setStepIndex((current) => current + 1);
              }
            },
          }}
        />
      }>
      {content}

      <PartyPickerSheet
        visible={partyPickerVisible}
        search={partySearch}
        onSearchChange={setPartySearch}
        parties={parties ?? []}
        onPick={(party) => {
          draft.setValue((current) => ({ ...current, customer: party }));
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
              unitPrice: product.salePrice,
              taxRate: product.taxRate ?? 13,
            });
          }
          setProductPickerVisible(false);
        }}
        onClose={() => setProductPickerVisible(false)}
      />

      <SuccessSheet
        visible={successVisible}
        queued={queued}
        title="Service order saved"
        message="You can view the invoice summary now or close this flow and start the next job."
        onClose={() => setSuccessVisible(false)}
        actions={[
          {
            label: 'View invoice',
            onPress: () => {
              setSuccessVisible(false);
              router.push('/(app)/invoice');
            },
          },
          {
            label: 'Close form',
            onPress: () => {
              setSuccessVisible(false);
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
  errorText: {
    color: palette.danger,
    fontSize: typography.body,
    fontWeight: '700',
    lineHeight: 22,
  },
  wizardHeader: {
    backgroundColor: palette.surface,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.xs,
  },
  progressTimeline: {
    position: 'relative',
    justifyContent: 'center',
    height: 54,
    paddingHorizontal: spacing.lg,
  },
  progressLineBg: {
    position: 'absolute',
    left: 44,
    right: 44,
    height: 3,
    backgroundColor: palette.border,
    top: 16,
    zIndex: 1,
  },
  progressLineActive: {
    position: 'absolute',
    left: 44,
    height: 3,
    backgroundColor: palette.primary,
    top: 16,
    zIndex: 2,
  },
  nodesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 3,
  },
  stepNodeWrapper: {
    alignItems: 'center',
    width: 52,
  },
  stepCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: palette.surface,
    borderWidth: 2,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleActive: {
    borderColor: palette.primary,
    backgroundColor: palette.surface,
  },
  stepCircleCompleted: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  stepNodeText: {
    fontSize: typography.caption,
    fontWeight: '800',
    color: palette.textSoft,
  },
  stepNodeTextActive: {
    color: palette.primary,
  },
  stepNodeLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: palette.textSoft,
    marginTop: spacing.xxs,
    textTransform: 'uppercase',
  },
  stepNodeLabelActive: {
    color: palette.primary,
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
  selectedCustomerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.surfaceMuted,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: palette.border,
    gap: spacing.md,
  },
  customerAvatarLarge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerAvatarText: {
    color: palette.white,
    fontWeight: '800',
    fontSize: typography.subheading,
  },
  customerDetailsCopy: {
    flex: 1,
    gap: 4,
  },
  selectedCustomerName: {
    fontSize: typography.subheading,
    fontWeight: '800',
    color: palette.text,
  },
  selectedCustomerPhone: {
    fontSize: typography.label,
    color: palette.textMuted,
    fontWeight: '600',
  },
  detailRowMini: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  swapCustomerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  swapCustomerBtnLabel: {
    fontSize: typography.label,
    fontWeight: '700',
    color: palette.primary,
  },
  emptySelectorCard: {
    height: 140,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: palette.borderStrong,
    backgroundColor: palette.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  emptySelectorIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: palette.backgroundAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptySelectorLabel: {
    fontSize: typography.body,
    fontWeight: '800',
    color: palette.text,
  },
  emptySelectorSub: {
    fontSize: typography.label,
    color: palette.textSoft,
  },
  lineCardLabor: {
    borderColor: palette.info,
    borderLeftWidth: 4,
  },
  lineCardPart: {
    borderColor: palette.success,
    borderLeftWidth: 4,
  },
  lineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: palette.backgroundAlt,
  },
  lineBadgeLabel: {
    fontSize: typography.caption,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  reviewSectionHeading: {
    fontSize: typography.subheading,
    fontWeight: '800',
    color: palette.text,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  reviewTableCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    overflow: 'hidden',
  },
  reviewTableHeader: {
    flexDirection: 'row',
    backgroundColor: palette.backgroundWarm,
    padding: spacing.md,
  },
  tableCol: {
    justifyContent: 'center',
  },
  tableColMain: {
    flex: 2,
  },
  tableColQty: {
    width: 40,
    textAlign: 'center',
  },
  tableColPrice: {
    width: 90,
    textAlign: 'right',
  },
  tableHeadText: {
    fontSize: typography.label,
    fontWeight: '700',
    color: palette.textMuted,
    textTransform: 'uppercase',
  },
  tableDivider: {
    height: 1,
    backgroundColor: palette.border,
  },
  reviewTableRow: {
    flexDirection: 'row',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  reviewItemName: {
    fontSize: typography.body,
    fontWeight: '800',
    color: palette.text,
  },
  reviewItemMeta: {
    fontSize: typography.caption,
    color: palette.textSoft,
  },
  reviewItemQty: {
    fontSize: typography.body,
    fontWeight: '700',
    color: palette.text,
    textAlign: 'center',
  },
  reviewItemTotal: {
    fontSize: typography.body,
    fontWeight: '800',
    color: palette.text,
    textAlign: 'right',
  },
  emptyTableText: {
    padding: spacing.lg,
    color: palette.textSoft,
    textAlign: 'center',
  },
  attributeWrap: {
    gap: spacing.md,
  },
  attributeRow: {
    gap: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: palette.surfaceMuted,
    padding: spacing.md,
  },
  attributeLabel: {
    fontSize: typography.label,
    fontWeight: '700',
    color: palette.textMuted,
  },
  removeMini: {
    alignSelf: 'flex-start',
  },
  removeMiniLabel: {
    color: palette.danger,
    fontWeight: '700',
  },
  secondaryButton: {
    minHeight: 46,
    borderRadius: radius.md,
    backgroundColor: palette.backgroundAlt,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  secondaryButtonLabel: {
    color: palette.text,
    fontWeight: '700',
  },
  attachmentsActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  attachmentsPreviewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  attachmentCard: {
    width: 110,
    borderRadius: radius.md,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    padding: spacing.xs,
    gap: spacing.xs,
  },
  attachmentPreview: {
    width: '100%',
    height: 84,
    borderRadius: radius.sm,
    backgroundColor: palette.backgroundAlt,
  },
  attachmentFallback: {
    width: '100%',
    height: 84,
    borderRadius: radius.sm,
    backgroundColor: palette.backgroundAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachmentText: {
    color: palette.textMuted,
    fontSize: typography.caption,
  },
  attachmentRemoveButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    borderRadius: radius.pill,
    backgroundColor: palette.white,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  lineCard: {
    borderRadius: radius.md,
    backgroundColor: palette.surfaceMuted,
    padding: spacing.md,
    gap: spacing.sm,
  },
  lineCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lineCardTitle: {
    fontSize: typography.body,
    fontWeight: '700',
    color: palette.text,
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
  reviewHeading: {
    fontSize: typography.heading,
    fontWeight: '800',
    color: palette.text,
  },
  reviewMeta: {
    fontSize: typography.body,
    color: palette.textMuted,
  },
  reviewLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  reviewLineLabel: {
    flex: 1,
    fontSize: typography.body,
    color: palette.text,
  },
  reviewLineValue: {
    fontSize: typography.body,
    fontWeight: '700',
    color: palette.text,
  },
});
