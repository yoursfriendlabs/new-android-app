import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { FlashList } from '@shopify/flash-list';
import { useFocusEffect } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { normalizeSale, unwrapEntity } from '@/src/api/normalize';
import { cacheRecentSales } from '@/src/data/cache';
import { submitWithOfflineQueue } from '@/src/data/sync';
import { SuccessSheet } from '@/src/components/feedback/SuccessSheet';
import { PartyPickerSheet } from '@/src/components/forms/PartyPickerSheet';
import { FormField } from '@/src/components/forms/FormField';
import { PaymentMethodSelector } from '@/src/components/forms/PaymentMethodSelector';
import { TopAppBar } from '@/src/components/layout/TopAppBar';
import { BillSummaryBar } from '@/src/components/pos/BillSummaryBar';
import { ProductCard } from '@/src/components/pos/ProductCard';
import { ProductFilters } from '@/src/components/pos/ProductFilters';
import { BottomSheet } from '@/src/components/feedback/BottomSheet';
import { SearchField } from '@/src/components/ui/SearchField';
import { SurfaceCard } from '@/src/components/ui/SurfaceCard';
import { TotalsCard } from '@/src/components/ui/TotalsCard';
import { buildReceiptHtml } from '@/src/lib/receipt';
import { getAttachmentLabel, isImageAttachment, uploadAttachments } from '@/src/lib/uploads';
import { formatCurrency, todayIso } from '@/src/lib/format';
import { useBanks, useNextSequences, useOrderAttributes, useParties, useProducts } from '@/src/hooks/useAppQueries';
import { useDebouncedValue } from '@/src/hooks/useDebouncedValue';
import { useDraftState } from '@/src/hooks/useDraftState';
import { useIsTablet } from '@/src/hooks/useIsTablet';
import { usePosTotals } from '@/src/features/pos/usePosTotals';
import { usePosCart } from '@/src/features/pos/usePosCart';
import { computeGrandTotal, computeLineTotal, computeSubTotal, computeTaxTotal } from '@/src/lib/totals';
import { palette, radius, spacing, typography } from '@/src/theme';
import { useAuthStore } from '@/src/stores/auth-store';
import { useReceiptStore } from '@/src/stores/receipt-store';
import type { PosDraft } from '@/src/types/forms';
import type { Sale } from '@/src/types/models';

function createEmptyPosDraft(): PosDraft {
  return {
    invoiceNo: `SAL-${Date.now().toString().slice(-6)}`,
    saleDate: todayIso(),
    party: null,
    notes: '',
    attributes: {},
    attachments: [],
    discount: 0,
    taxOverride: undefined,
    paymentMethod: 'cash',
    bankId: undefined,
    paymentNote: '',
    amountReceived: 0,
    fullyPaid: false,
    items: [],
  };
}

export default function PosScreen() {
  const isTablet = useIsTablet();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const setReceipt = useReceiptStore((state) => state.setReceipt);
  const [search, setSearch] = useState('');
  const [partySearch, setPartySearch] = useState('');
  const [category, setCategory] = useState('All');
  const [categoryPickerVisible, setCategoryPickerVisible] = useState(false);
  const [checkoutVisible, setCheckoutVisible] = useState(false);
  const [partyPickerVisible, setPartyPickerVisible] = useState(false);
  const [successState, setSuccessState] = useState<{ visible: boolean; queued: boolean }>({
    visible: false,
    queued: false,
  });
  const debouncedSearch = useDebouncedValue(search);
  const debouncedPartySearch = useDebouncedValue(partySearch);
  const { data: products } = useProducts(debouncedSearch);
  const { data: parties } = useParties(debouncedPartySearch, 'customer');
  const { data: banks } = useBanks();
  const { data: nextSequences } = useNextSequences();
  const { data: orderAttributes } = useOrderAttributes('sale');
  const { isReady, reset, setValue, value } = useDraftState<PosDraft>('draft:pos', createEmptyPosDraft());
  const { subTotal, taxTotal, grandTotal, cartItemCount } = usePosTotals(value);
  const { updateCart } = usePosCart(products, setValue);

  function toggleItemUnit(productId: string, unitType: 'primary' | 'secondary') {
    const product = (products ?? []).find((p) => p.id === productId);
    if (!product) return;

    setValue((current) => {
      const items = current.items.map((item) => {
        if (item.productId === productId) {
          const isSecondary = unitType === 'secondary';
          const convRate = item.secondaryConversionRate || 1;
          const unitPrice = isSecondary 
            ? Number((product.salePrice / convRate).toFixed(2))
            : product.salePrice;
          const unit = isSecondary && item.secondaryUnit ? item.secondaryUnit : item.primaryUnit || product.primaryUnit;

          return {
            ...item,
            unitType,
            unit,
            unitPrice,
          };
        }
        return item;
      });

      return {
        ...current,
        items,
      };
    });
  }

  useFocusEffect(
    useCallback(() => {
      return () => {
        setSearch('');
        setPartySearch('');
        setCategory('All');
        setCategoryPickerVisible(false);
        setCheckoutVisible(false);
        setPartyPickerVisible(false);
        setSuccessState({ visible: false, queued: false });
        void reset(createEmptyPosDraft());
        queryClient.removeQueries({ queryKey: ['products'] });
        queryClient.removeQueries({ queryKey: ['parties'] });
        queryClient.removeQueries({ queryKey: ['banks'] });
        queryClient.removeQueries({ queryKey: ['next-sequences'] });
        queryClient.removeQueries({ queryKey: ['order-attributes', 'sale'] });
      };
    }, [queryClient, reset]),
  );

  useEffect(() => {
    if (!isReady) return;

    setValue((current) => ({
      ...current,
      invoiceNo:
        current.invoiceNo.startsWith('SAL-') && nextSequences?.sale
          ? nextSequences.sale
          : current.invoiceNo,
      attributes:
        orderAttributes?.reduce<Record<string, string>>((result, attribute) => {
          result[attribute.key] = current.attributes[attribute.key] ?? String(attribute.defaultValue ?? '');
          return result;
        }, {}) ?? current.attributes,
    }));
  }, [isReady, nextSequences?.sale, orderAttributes, setValue]);

  const categoryOptions = useMemo(() => {
    const derivedCategories = Array.from(
      new Set(
        (products ?? [])
          .map((product) => product.categoryName)
          .filter((entry): entry is string => Boolean(entry)),
      ),
    );
    return ['All', ...derivedCategories];
  }, [products]);

  const visibleProducts = useMemo(() => {
    const nextProducts = products ?? [];
    if (category === 'All') {
      return nextProducts;
    }
    return nextProducts.filter((product) => product.categoryName === category);
  }, [category, products]);

  const activeBanks = (banks ?? []).filter((bank) => bank.isActive);

  async function saveSale(mode: 'save' | 'print') {
    if (!value.items.length) {
      Alert.alert('Add items first', 'You need at least one item in the bill before saving.');
      return;
    }

    const amountReceived = value.fullyPaid ? grandTotal : value.amountReceived;
    if (value.paymentMethod === 'bank' && amountReceived > 0 && !value.bankId) {
      Alert.alert('Bank required', 'Select a bank account for bank payments.');
      return;
    }

    try {
      const uploadedAttachments = await uploadAttachments(value.attachments);

      const payload = {
        partyId: value.party?.id,
        invoiceNo: value.invoiceNo,
        saleDate: value.saleDate,
        status:
          amountReceived >= grandTotal
            ? 'paid'
            : amountReceived > 0
              ? 'partial'
              : 'unpaid',
        notes: value.notes,
        amountReceived,
        paymentMethod: amountReceived > 0 ? value.paymentMethod : 'cash',
        bankId:
          amountReceived > 0 && value.paymentMethod === 'bank'
            ? value.bankId
            : undefined,
        paymentNote: value.paymentNote,
        attachment: uploadedAttachments[0],
        attachments: uploadedAttachments,
        attributes: value.attributes,
        subTotal,
        taxTotal,
        discount: value.discount,
        discountTotal: value.discount,
        grandTotal,
        createdBy: user?.id,
        items: value.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitType: item.unitType || 'primary',
          conversionRate: item.unitType === 'secondary' ? (item.secondaryConversionRate || 0) : 0,
          unitPrice: item.unitPrice,
          taxRate: item.taxRate,
          lineTotal: computeLineTotal(item),
        })),
      };

      const result = await submitWithOfflineQueue<Sale, typeof payload>({
        entityType: 'sale',
        method: 'POST',
        path: '/api/sales',
        body: payload,
      });

      const receiptHtml = buildReceiptHtml({
        heading: 'Sale Invoice',
        reference: value.invoiceNo,
        date: value.saleDate,
        subtitle: value.party?.name ?? 'Walk-in customer',
        lines: value.items.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineTotal: computeLineTotal(item),
        })),
        subTotal,
        taxTotal,
        discountTotal: value.discount,
        grandTotal,
        amountReceived,
      });

      setReceipt({
        title: value.invoiceNo,
        subtitle: value.party?.name ?? 'Walk-in customer',
        html: receiptHtml,
      });

      if (result.data) {
        await cacheRecentSales([normalizeSale(unwrapEntity(result.data))]);
      }

      await reset(createEmptyPosDraft());
      setCheckoutVisible(false);
      setSuccessState({ visible: true, queued: result.queued });

      if (mode === 'print') {
        router.push('/(app)/print-preview');
      }
    } catch (error) {
      Alert.alert(
        'Unable to save sale',
        error instanceof Error ? error.message : 'Please try again.',
      );
    }
  }

  async function addImageAttachment() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: 5,
    });

    if (result.canceled || !result.assets?.length) {
      return;
    }

    setValue((current) => ({
      ...current,
      attachments: [...current.attachments, ...result.assets.map((asset) => asset.uri)],
    }));
  }

  function removeAttachment(uri: string) {
    setValue((current) => ({
      ...current,
      attachments: current.attachments.filter((attachment) => attachment !== uri),
    }));
  }

  if (!isReady) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.loadingWrap}>
          <Text style={styles.loading}>Loading POS...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const productFilters = (
    <ProductFilters
      search={search}
      setSearch={setSearch}
      category={category}
      setCategory={setCategory}
      categoryOptions={categoryOptions}
    />
  );

  const productList = (
    <FlashList
      data={visibleProducts}
      key={isTablet ? 'tablet-grid' : 'phone-grid'}
      numColumns={isTablet ? 3 : 2}
      style={styles.productList}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={isTablet ? null : productFilters}
      renderItem={({ item }) => {
        const quantity = value.items.find((cartItem) => cartItem.productId === item.id)?.quantity ?? 0;
        return (
          <View style={styles.productGridItem}>
            <ProductCard
              product={item}
              quantity={quantity}
              onAdd={() => updateCart(item.id, 'add')}
              onSubtract={() => updateCart(item.id, 'subtract')}
            />
          </View>
        );
      }}
      keyExtractor={(item) => item.id}
      contentContainerStyle={isTablet ? styles.productListContentTablet : styles.productListContentPhone}
    />
  );

  const productsPane = isTablet ? (
    <View style={styles.productsPane}>
      <View style={styles.tabletFilters}>{productFilters}</View>
      {productList}
    </View>
  ) : (
    <View style={styles.productsPane}>
      {productList}
    </View>
  );

  const billPane = (
    <SurfaceCard>
      <View style={styles.billItems}>
        {value.items.map((item) => {
          const product = (products ?? []).find((p) => p.id === item.productId);
          return (
            <View key={item.productId} style={styles.billItemContainer}>
              <View style={styles.billRow}>
                <View style={styles.billCopy}>
                  <Text style={styles.billTitle}>{item.name}</Text>
                  <Text style={styles.billMeta}>
                    {item.quantity} {item.unit} x {formatCurrency(item.unitPrice)}
                  </Text>
                </View>
                <View style={styles.billControls}>
                  <Pressable style={styles.billButton} onPress={() => updateCart(item.productId, 'subtract')}>
                    <Text style={styles.billButtonLabel}>-</Text>
                  </Pressable>
                  <Text style={styles.billQuantity}>{item.quantity}</Text>
                  <Pressable style={styles.billButton} onPress={() => updateCart(item.productId, 'add')}>
                    <Text style={styles.billButtonLabel}>+</Text>
                  </Pressable>
                </View>
              </View>
              {item.secondaryUnit ? (
                <View style={styles.unitSelectorRow}>
                  <Pressable
                    style={[
                      styles.unitChip,
                      item.unitType !== 'secondary' && styles.unitChipActive,
                    ]}
                    onPress={() => toggleItemUnit(item.productId, 'primary')}
                  >
                    <Text
                      style={[
                        styles.unitChipLabel,
                        item.unitType !== 'secondary' && styles.unitChipLabelActive,
                      ]}
                    >
                      {item.primaryUnit || 'Primary'} ({formatCurrency(product?.salePrice ?? item.unitPrice)})
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.unitChip,
                      item.unitType === 'secondary' && styles.unitChipActive,
                    ]}
                    onPress={() => toggleItemUnit(item.productId, 'secondary')}
                  >
                    <Text
                      style={[
                        styles.unitChipLabel,
                        item.unitType === 'secondary' && styles.unitChipLabelActive,
                      ]}
                    >
                      {item.secondaryUnit} ({formatCurrency(product?.salePrice && item.secondaryConversionRate ? Number((product.salePrice / item.secondaryConversionRate).toFixed(2)) : item.unitPrice)})
                    </Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          );
        })}
        {!value.items.length ? <Text style={styles.emptyCart}>No items yet. Search and tap Quick add.</Text> : null}
      </View>
      <TotalsCard
        subTotal={subTotal}
        taxTotal={taxTotal}
        discountTotal={value.discount}
        grandTotal={grandTotal}
        amountReceived={value.fullyPaid ? grandTotal : value.amountReceived}
      />
      <Pressable style={styles.checkoutButton} onPress={() => setCheckoutVisible(true)}>
        <Text style={styles.checkoutLabel}>Open checkout</Text>
      </Pressable>
    </SurfaceCard>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.container}>
        <TopAppBar 
          currentSegment="pos" 
          titleOverride="Quick POS" 
          leadingMode="back" 
          showBack={true} 
          right={
            <Pressable 
              style={styles.clearCartButton} 
              onPress={() => {
                if (!value.items.length) return;
                Alert.alert(
                  'Clear POS Cart',
                  'Are you sure you want to clear all items in the cart?',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Clear', onPress: () => void reset(createEmptyPosDraft()), style: 'destructive' }
                  ]
                );
              }}
            >
              <MaterialCommunityIcons color={value.items.length ? palette.danger : palette.textSoft} name="trash-can-outline" size={22} />
            </Pressable>
          }
        />
        
        <View style={styles.customerSelectorBar}>
          <View style={styles.customerInfo}>
            <View style={styles.customerAvatar}>
              <MaterialCommunityIcons name="account-circle-outline" size={20} color={palette.success} />
            </View>
            <View>
              <Text style={styles.customerLabel}>Selected Customer</Text>
              <Text style={styles.customerName}>{value.party?.name ?? 'Walk-in Customer'}</Text>
            </View>
          </View>
          <Pressable style={styles.customerChangeBtn} onPress={() => setPartyPickerVisible(true)}>
            <Text style={styles.customerChangeLabel}>Change Customer</Text>
            <MaterialCommunityIcons name="swap-horizontal" size={16} color={palette.success} />
          </Pressable>
        </View>

        {isTablet ? (
          <View style={styles.tabletLayout}>
            <View style={styles.tabletProducts}>{productsPane}</View>
            <View style={styles.tabletBill}>{billPane}</View>
          </View>
        ) : (
          <>
            {productsPane}
            <BillSummaryBar itemCount={cartItemCount} total={grandTotal} onPress={() => setCheckoutVisible(true)} />
          </>
        )}
      </View>

      <BottomSheet
        visible={checkoutVisible}
        title="Confirm Sale"
        subtitle="Review billing details, payment mode, and notes before saving."
        onClose={() => setCheckoutVisible(false)}
        fullHeight={!isTablet}
        footer={
          <View style={styles.sheetFooter}>
            <Pressable style={styles.secondaryFooterButton} onPress={() => saveSale('print')}>
              <MaterialCommunityIcons color={palette.warning} name="crown-outline" size={20} />
              <Text style={styles.secondaryFooterLabel}>Save & print</Text>
            </Pressable>
            <Pressable style={styles.primaryFooterButton} onPress={() => saveSale('save')}>
              <MaterialCommunityIcons color={palette.white} name="content-save-outline" size={20} />
              <Text style={styles.primaryFooterLabel}>Save Only</Text>
            </Pressable>
          </View>
        }>
        <ScrollView
          style={styles.checkoutScroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.checkoutContent}>
          <View style={styles.invoiceSplitCard}>
            <View style={styles.invoiceSplitColumn}>
              <Text style={styles.invoiceSplitLabel}>Invoice Number</Text>
              <Text style={styles.invoiceSplitValue}>{value.invoiceNo}</Text>
            </View>
            <View style={styles.invoiceDivider} />
            <Pressable style={styles.invoiceSplitColumn} onPress={() => {}}>
              <Text style={styles.invoiceSplitLabel}>Date</Text>
              <View style={styles.invoiceDateRow}>
                <Text style={styles.invoiceSplitValue}>{value.saleDate}</Text>
                <MaterialCommunityIcons color={palette.textSoft} name="calendar-month-outline" size={22} />
              </View>
            </Pressable>
          </View>

          <Pressable style={styles.partyCard} onPress={() => setPartyPickerVisible(true)}>
            <View style={styles.partyCardLead}>
              <View style={styles.partyCardIcon}>
                <MaterialCommunityIcons color={palette.white} name="cash" size={26} />
              </View>
              <View>
                <Text style={styles.partyCardTitle}>{value.party?.name ?? 'Cash Sale'}</Text>
                <Text style={styles.partyCardSubtitle}>{value.party?.phone ?? 'Tap to change party'}</Text>
              </View>
            </View>
            <View style={styles.changePill}>
              <MaterialCommunityIcons color={palette.success} name="swap-horizontal" size={18} />
              <Text style={styles.changePillLabel}>Change</Text>
            </View>
          </Pressable>

          <Pressable style={styles.addItemsCard} onPress={() => setCheckoutVisible(false)}>
            <MaterialCommunityIcons color={palette.success} name="plus-circle" size={22} />
            <Text style={styles.addItemsLabel}>Add Items</Text>
          </Pressable>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeaderTitle}>Billing Items ({value.items.length})</Text>
              <Pressable onPress={() => setCheckoutVisible(false)}>
                <MaterialCommunityIcons color={palette.success} name="plus-circle" size={24} />
              </Pressable>
            </View>
            <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
              {value.items.map((item) => {
                const product = (products ?? []).find((p) => p.id === item.productId);
                return (
                  <View key={item.productId} style={styles.billItemContainer}>
                    <View style={styles.billRow}>
                      <View style={styles.billCopy}>
                        <Text style={styles.billTitle}>{item.name}</Text>
                        <Text style={styles.billMeta}>
                          Qty: {item.quantity} {item.unit} x {formatCurrency(item.unitPrice)}
                        </Text>
                      </View>
                      <Text style={styles.billLineAmount}>{formatCurrency(computeLineTotal(item))}</Text>
                    </View>
                    {item.secondaryUnit ? (
                      <View style={styles.unitSelectorRow}>
                        <Pressable
                          style={[
                            styles.unitChip,
                            item.unitType !== 'secondary' && styles.unitChipActive,
                          ]}
                          onPress={() => toggleItemUnit(item.productId, 'primary')}
                        >
                          <Text
                            style={[
                              styles.unitChipLabel,
                              item.unitType !== 'secondary' && styles.unitChipLabelActive,
                            ]}
                          >
                            {item.primaryUnit || 'Primary'} ({formatCurrency(product?.salePrice ?? item.unitPrice)})
                          </Text>
                        </Pressable>
                        <Pressable
                          style={[
                            styles.unitChip,
                            item.unitType === 'secondary' && styles.unitChipActive,
                          ]}
                          onPress={() => toggleItemUnit(item.productId, 'secondary')}
                        >
                          <Text
                            style={[
                              styles.unitChipLabel,
                              item.unitType === 'secondary' && styles.unitChipLabelActive,
                            ]}
                          >
                            {item.secondaryUnit} ({formatCurrency(product?.salePrice && item.secondaryConversionRate ? Number((product.salePrice / item.secondaryConversionRate).toFixed(2)) : item.unitPrice)})
                          </Text>
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                );
              })}
              {!value.items.length ? (
                <Text style={styles.emptyCart}>No items yet. Go back to add items.</Text>
              ) : null}
            </View>
          </View>

          <View style={styles.chargeCard}>
            <View style={styles.chargeRow}>
              <MaterialCommunityIcons color={palette.warning} name="tag-outline" size={22} />
              <Text style={styles.chargeLabel}>Discount</Text>
              <Text style={styles.chargeSuffix}>Rs.</Text>
              <TextInput
                value={String(value.discount || '')}
                onChangeText={(discount) => setValue((current) => ({ ...current, discount: Number(discount || 0) }))}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={palette.textSoft}
                style={styles.chargeInput}
              />
            </View>
            <View style={styles.chargeRow}>
              <MaterialCommunityIcons color={palette.info} name="percent-outline" size={22} />
              <Text style={styles.chargeLabel}>Tax</Text>
              <Text style={styles.chargeStatic}>VAT 13%</Text>
              <Text style={styles.chargeValue}>{formatCurrency(taxTotal)}</Text>
            </View>
          </View>

          <View style={styles.totalCard}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Amount</Text>
              <Text style={styles.totalValue}>{formatCurrency(grandTotal)}</Text>
            </View>
            <View style={styles.paymentModeRow}>
              <Text style={styles.paymentModeLabel}>Payment Mode</Text>
              <View style={styles.paymentModeValueWrap}>
                <Text style={styles.paymentModeValue}>{value.paymentMethod === 'bank' ? 'Bank' : 'Cash'}</Text>
                <MaterialCommunityIcons color={palette.textSoft} name="chevron-right" size={20} />
              </View>
            </View>
          </View>

          <PaymentMethodSelector
            value={value.paymentMethod}
            onChange={(paymentMethod) => setValue((current) => ({ ...current, paymentMethod }))}
            activeBackgroundColor={palette.success}
          />
          {value.paymentMethod === 'bank' ? (
            <View style={styles.bankWrap}>
              {activeBanks.length > 0 ? (
                activeBanks.map((bank) => (
                  <Pressable
                    key={bank.id}
                    style={[styles.bankChip, value.bankId === bank.id && styles.bankChipActive]}
                    onPress={() => setValue((current) => ({ ...current, bankId: bank.id }))}>
                    <Text
                      style={[
                        styles.bankChipLabel,
                        value.bankId === bank.id && styles.bankChipLabelActive,
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
            label="Amount received"
            value={String(value.fullyPaid ? grandTotal : value.amountReceived)}
            onChangeText={(amountReceived) =>
              setValue((current) => ({
                ...current,
                fullyPaid: false,
                amountReceived: Number(amountReceived || 0),
              }))
            }
            keyboardType="numeric"
          />
          <FormField
            label="Payment note"
            value={value.paymentNote}
            onChangeText={(paymentNote) => setValue((current) => ({ ...current, paymentNote }))}
          />
          <View style={styles.quickPayments}>
            {[
              { label: 'No payment', amount: 0 },
              { label: '50%', amount: grandTotal / 2 },
              { label: 'Full', amount: grandTotal },
            ].map((option) => (
              <Pressable
                key={option.label}
                style={styles.quickPaymentChip}
                onPress={() =>
                  setValue((current) => ({
                    ...current,
                    fullyPaid: option.amount === grandTotal,
                    amountReceived: Math.round(option.amount),
                  }))
                }>
                <Text style={styles.quickPaymentLabel}>{option.label}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            style={[styles.fullToggle, value.fullyPaid && styles.fullToggleActive]}
            onPress={() =>
              setValue((current) => ({
                ...current,
                fullyPaid: !current.fullyPaid,
                amountReceived: !current.fullyPaid ? grandTotal : current.amountReceived,
              }))
            }>
            <Text style={[styles.fullToggleLabel, value.fullyPaid && styles.fullToggleLabelActive]}>
              Mark invoice fully paid
            </Text>
          </Pressable>
          <FormField
            label="Notes or remarks"
            value={value.notes}
            placeholder="Notes or Remarks"
            onChangeText={(notes) => setValue((current) => ({ ...current, notes }))}
            multiline
          />
          <Pressable style={styles.addImagesRow} onPress={() => void addImageAttachment()}>
            <MaterialCommunityIcons color={palette.success} name="image-plus-outline" size={22} />
            <Text style={styles.addImagesLabel}>
              Add Images {value?.attachments?.length ? `(${value.attachments.length})` : ''}
            </Text>
          </Pressable>
          {value.attachments.length ? (
            <View style={styles.attachmentsPreviewGrid}>
              {value.attachments.map((attachment) => (
                <View key={attachment} style={styles.attachmentCard}>
                  {isImageAttachment(attachment) ? (
                    <Image source={{ uri: attachment }} style={styles.attachmentPreview} />
                  ) : (
                    <View style={styles.attachmentFallback}>
                      <MaterialCommunityIcons color={palette.textMuted} name="file-outline" size={24} />
                    </View>
                  )}
                  <Text numberOfLines={1} style={styles.attachmentName}>
                    {getAttachmentLabel(attachment)}
                  </Text>
                  <Pressable style={styles.attachmentRemoveButton} onPress={() => removeAttachment(attachment)}>
                    <MaterialCommunityIcons color={palette.danger} name="close-circle" size={18} />
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}
          {(orderAttributes ?? []).map((attribute) => (
            <FormField
              key={attribute.id || attribute.key}
              label={attribute.required ? `${attribute.label} *` : attribute.label}
              value={String(value.attributes[attribute.key] ?? '')}
              onChangeText={(nextValue) =>
                setValue((current) => ({
                  ...current,
                  attributes: { ...current.attributes, [attribute.key]: nextValue },
                }))
              }
              keyboardType={attribute.fieldType === 'number' ? 'numeric' : 'default'}
              multiline={attribute.fieldType === 'textarea'}
              placeholder={attribute.placeholder}
            />
          ))}
        </ScrollView>
      </BottomSheet>

      <BottomSheet
        visible={categoryPickerVisible}
        title="Choose Category"
        subtitle="Filter the product grid by category without leaving Quick POS."
        onClose={() => setCategoryPickerVisible(false)}>
        <View style={styles.categoryPickerList}>
          {categoryOptions.map((option) => (
            <Pressable
              key={option}
              style={[styles.categoryPickerItem, category === option && styles.categoryPickerItemActive]}
              onPress={() => {
                setCategory(option);
                setCategoryPickerVisible(false);
              }}>
              <Text style={[styles.categoryPickerLabel, category === option && styles.categoryPickerLabelActive]}>
                {option}
              </Text>
            </Pressable>
          ))}
        </View>
      </BottomSheet>

      <PartyPickerSheet
        visible={partyPickerVisible}
        search={partySearch}
        onSearchChange={setPartySearch}
        parties={parties ?? []}
        onPick={(party) => {
          setValue((current) => ({ ...current, party }));
          setPartyPickerVisible(false);
        }}
        onClose={() => setPartyPickerVisible(false)}
        title="Select Party for Sale"
        subtitle="Pick a customer or keep this bill as a cash sale."
      />

      <SuccessSheet
        visible={successState.visible}
        queued={successState.queued}
        title="Sale recorded"
        message="You can jump to the invoice, preview print, or start a fresh bill immediately."
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
            label: 'Open print preview',
            onPress: () => {
              setSuccessState({ visible: false, queued: false });
              router.push('/(app)/print-preview');
            },
          },
          {
            label: 'Start new sale',
            onPress: () => setSuccessState({ visible: false, queued: false }),
            primary: true,
          },
        ]}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.background,
  },
  container: {
    flex: 1,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loading: {
    color: palette.textMuted,
    fontSize: typography.body,
  },
  productsPane: {
    flex: 1,
    minHeight: 0,
  },
  productList: {
    flex: 1,
  },
  filtersBlock: {
    gap: spacing.md,
    paddingTop: spacing.sm,
  },
  posSearchField: {
    minHeight: 74,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
  },
  posSearchInput: {
    fontSize: 18,
  },
  filterActions: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    minHeight: 52,
    borderRadius: radius.pill,
    backgroundColor: palette.surfaceMuted,
  },
  filterChipLabel: {
    fontSize: typography.subheading,
    fontWeight: '600',
    color: palette.text,
  },
  addItemChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: palette.surfaceMuted,
  },
  addItemChipLabel: {
    fontSize: typography.subheading,
    fontWeight: '600',
    color: palette.text,
  },
  productListContentPhone: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 108,
    paddingTop: spacing.md,
  },
  productListContentTablet: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    paddingTop: spacing.md,
  },
  tabletFilters: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  productGridItem: {
    flex: 1,
    paddingBottom: spacing.sm,
    paddingHorizontal: 4,
  },
  tabletLayout: {
    flex: 1,
    flexDirection: 'row',
  },
  tabletProducts: {
    flex: 1.55,
  },
  tabletBill: {
    width: 360,
    paddingTop: spacing.md,
    paddingRight: spacing.lg,
    paddingBottom: spacing.md,
  },
  billItems: {
    gap: spacing.sm,
  },
  billRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingBottom: spacing.xxs,
  },
  billCopy: {
    flex: 1,
    gap: spacing.xxs,
  },
  billTitle: {
    fontSize: typography.body,
    fontWeight: '700',
    color: palette.text,
  },
  billMeta: {
    fontSize: typography.label,
    color: palette.textMuted,
  },
  billControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  billButton: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: palette.backgroundAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  billButtonLabel: {
    fontSize: typography.body,
    fontWeight: '800',
    color: palette.text,
  },
  billQuantity: {
    minWidth: 18,
    textAlign: 'center',
    fontWeight: '700',
    color: palette.text,
  },
  billLineAmount: {
    fontSize: typography.body,
    fontWeight: '700',
    color: palette.text,
  },
  emptyCart: {
    fontSize: typography.body,
    color: palette.textMuted,
  },
  checkoutButton: {
    minHeight: 50,
    borderRadius: radius.md,
    backgroundColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkoutLabel: {
    color: palette.white,
    fontSize: typography.body,
    fontWeight: '800',
  },
  sheetFooter: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  secondaryFooterButton: {
    flex: 1,
    minHeight: 58,
    borderRadius: radius.md,
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.border,
    flexDirection: 'row',
    gap: spacing.xs,
  },
  primaryFooterButton: {
    flex: 1,
    minHeight: 58,
    borderRadius: radius.md,
    backgroundColor: palette.success,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  secondaryFooterLabel: {
    color: palette.text,
    fontSize: typography.subheading,
    fontWeight: '800',
  },
  primaryFooterLabel: {
    color: palette.white,
    fontSize: typography.subheading,
    fontWeight: '800',
  },
  checkoutContent: {
    gap: spacing.md,
    paddingBottom: spacing.lg,
  },
  checkoutScroll: {
    flex: 1,
    minHeight: 0,
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
  quickPayments: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  quickPaymentChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: palette.backgroundAlt,
  },
  quickPaymentLabel: {
    color: palette.text,
    fontWeight: '700',
  },
  fullToggle: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullToggleActive: {
    backgroundColor: palette.successSoft,
    borderColor: palette.success,
  },
  fullToggleLabel: {
    color: palette.text,
    fontWeight: '700',
  },
  fullToggleLabelActive: {
    color: palette.success,
  },
  invoiceSplitCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  invoiceSplitColumn: {
    flex: 1,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  invoiceSplitLabel: {
    fontSize: typography.body,
    color: palette.textSoft,
  },
  invoiceSplitValue: {
    fontSize: 22,
    fontWeight: '500',
    color: palette.text,
  },
  invoiceDivider: {
    width: 1,
    backgroundColor: palette.border,
  },
  invoiceDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  partyCard: {
    minHeight: 92,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  partyCardLead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  partyCardIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.success,
  },
  partyCardTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: palette.text,
  },
  partyCardSubtitle: {
    fontSize: typography.body,
    color: palette.textMuted,
  },
  changePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    minHeight: 44,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  changePillLabel: {
    fontSize: typography.subheading,
    fontWeight: '700',
    color: palette.success,
  },
  addItemsCard: {
    minHeight: 88,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  addItemsLabel: {
    fontSize: 22,
    fontWeight: '700',
    color: palette.success,
  },
  sectionCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    padding: spacing.lg,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionHeaderTitle: {
    fontSize: typography.heading,
    fontWeight: '700',
    color: palette.text,
  },
  chargeCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    padding: spacing.lg,
    gap: spacing.md,
  },
  chargeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  chargeLabel: {
    flex: 1,
    fontSize: typography.heading,
    color: palette.textMuted,
  },
  chargeSuffix: {
    fontSize: typography.subheading,
    color: palette.textMuted,
  },
  chargeInput: {
    minWidth: 92,
    minHeight: 42,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    fontSize: typography.subheading,
    color: palette.text,
    textAlign: 'right',
  },
  chargeStatic: {
    fontSize: typography.subheading,
    color: palette.text,
  },
  chargeValue: {
    fontSize: typography.subheading,
    color: palette.text,
  },
  itemsListCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  totalCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  totalLabel: {
    fontSize: typography.heading,
    fontWeight: '700',
    color: palette.text,
  },
  totalValue: {
    fontSize: typography.heading,
    fontWeight: '700',
    color: palette.text,
  },
  paymentModeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  paymentModeLabel: {
    fontSize: typography.subheading,
    color: palette.textSoft,
  },
  paymentModeValueWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  paymentModeValue: {
    fontSize: typography.subheading,
    color: palette.text,
  },
  addImagesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  addImagesLabel: {
    fontSize: typography.subheading,
    fontWeight: '700',
    color: palette.success,
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
  attachmentName: {
    fontSize: typography.caption,
    color: palette.textMuted,
  },
  attachmentRemoveButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    borderRadius: radius.pill,
    backgroundColor: palette.white,
  },
  categoryPickerList: {
    gap: spacing.sm,
    paddingBottom: spacing.lg,
  },
  categoryPickerItem: {
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: palette.backgroundAlt,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryPickerItemActive: {
    backgroundColor: palette.success,
  },
  categoryPickerLabel: {
    fontSize: typography.body,
    fontWeight: '700',
    color: palette.text,
  },
  categoryPickerLabelActive: {
    color: palette.white,
  },
  customerSelectorBar: {
    backgroundColor: palette.surface,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  customerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  customerAvatar: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: palette.successSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerLabel: {
    fontSize: typography.caption,
    fontWeight: '700',
    color: palette.textSoft,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  customerName: {
    fontSize: typography.body,
    fontWeight: '800',
    color: palette.text,
  },
  customerChangeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: palette.successSoft,
    borderWidth: 1,
    borderColor: palette.success,
  },
  customerChangeLabel: {
    fontSize: typography.label,
    fontWeight: '700',
    color: palette.success,
  },
  clearCartButton: {
    padding: spacing.xs,
  },
  billItemContainer: {
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  unitSelectorRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xxs,
  },
  unitChip: {
    flex: 1,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: palette.backgroundAlt,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitChipActive: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  unitChipLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.text,
  },
  unitChipLabelActive: {
    color: palette.white,
  },
});
