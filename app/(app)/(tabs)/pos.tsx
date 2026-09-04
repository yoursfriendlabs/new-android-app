import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { FlashList } from '@shopify/flash-list';
import { useFocusEffect } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { normalizeSale, unwrapEntity, extractListItems } from '@/src/api/normalize';
import { cacheRecentSales } from '@/src/data/cache';
import { submitWithOfflineQueue } from '@/src/data/sync';
import { SuccessSheet } from '@/src/shared/feedback/SuccessSheet';
import { PartyPickerSheet } from '@/src/shared/forms/PartyPickerSheet';
import { PartyFormSheet } from '@/src/features/parties/components/PartyFormSheet';
import { TopAppBar } from '@/src/shared/layout/TopAppBar';
import { BillSummaryBar } from '@/src/features/pos/components/BillSummaryBar';
import { PosCheckoutSheet } from '@/src/features/pos/components/PosCheckoutSheet';
import { ProductCard } from '@/src/features/pos/components/ProductCard';
import { ProductFilters } from '@/src/features/pos/components/ProductFilters';
import { BottomSheet } from '@/src/shared/feedback/BottomSheet';
import { SearchField } from '@/src/shared/ui/SearchField';
import { SurfaceCard } from '@/src/shared/ui/SurfaceCard';
import { TotalsCard } from '@/src/shared/ui/TotalsCard';
import { buildReceiptHtml } from '@/src/shared/lib/receipt';
import { uploadAttachments } from '@/src/shared/lib/uploads';
import { formatCurrency, todayIso } from '@/src/shared/lib/format';
import { isCafeWorkspace } from '@/src/shared/lib/business';
import { useBanks, useNextSequences, useOrderAttributes, useParties, useProducts, useTables } from '@/src/shared/hooks/useAppQueries';
import { salesApi, tablesApi } from '@/src/api';
import { useDebouncedValue } from '@/src/shared/hooks/useDebouncedValue';
import { useDraftState } from '@/src/shared/hooks/useDraftState';
import { useIsTablet } from '@/src/shared/hooks/useIsTablet';
import { usePosTotals } from '@/src/features/pos/hooks/usePosTotals';
import { usePosCart } from '@/src/features/pos/hooks/usePosCart';
import { computeGrandTotal, computeLineTotal, computeSubTotal, computeTaxTotal } from '@/src/shared/lib/totals';
import { radius, spacing, typography } from '@/src/theme';
import { useAuthStore } from '@/src/stores/auth-store';
import { useReceiptStore } from '@/src/stores/receipt-store';
import type { PosDraft } from '@/src/types/forms';
import { partyInitials } from '@/src/features/parties/lib/party';
import type { Sale } from '@/src/types/models';
import { usePalette } from '@/src/stores/theme-store';
import { useThemedStyles } from '@/src/theme/use-themed-styles';
import type { AppPalette } from '@/src/theme/app-palette';

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
    fullyPaid: true,
    items: [],
  };
}

export default function PosScreen() {
  const colors = usePalette();
  const styles = useThemedStyles(createStyles);
  const isTablet = useIsTablet();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const businessProfile = useAuthStore((state) => state.businessProfile);
  const setReceipt = useReceiptStore((state) => state.setReceipt);
  const cafeMode = isCafeWorkspace({
    businessType: String(businessProfile?.businessType ?? ''),
    enabledModules: businessProfile?.enabledModules,
  });

  const [search, setSearch] = useState('');
  const [partySearch, setPartySearch] = useState('');
  const [category, setCategory] = useState('All');
  const [categoryPickerVisible, setCategoryPickerVisible] = useState(false);
  const [checkoutVisible, setCheckoutVisible] = useState(false);
  const [partyPickerVisible, setPartyPickerVisible] = useState(false);
  const [partyCreateVisible, setPartyCreateVisible] = useState(false);
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

  const { tableId: paramTableId } = useLocalSearchParams<{ tableId?: string }>();
  const { data: tables = [] } = useTables({}, { enabled: cafeMode });
  const [activeTableId, setActiveTableId] = useState<string | null>(null);
  const [orderType, setOrderType] = useState<'takeaway' | 'delivery' | 'dine_in'>('takeaway');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tableModalVisible, setTableModalVisible] = useState(false);

  const loadTableDraft = useCallback(async (tableId: string) => {
    try {
      const res = await salesApi.list({ limit: 120 });
      const dueSales = extractListItems<Sale>(res).filter(
        (s) => s.tableId === tableId && s.status === 'due'
      );

      if (dueSales.length > 0) {
        const draftSale = dueSales[0];
        const fullSale = await salesApi.get(draftSale.id);
        setEditingId(fullSale.id);
        setValue({
          invoiceNo: fullSale.invoiceNo,
          saleDate: fullSale.saleDate,
          party: fullSale.partyId ? ({ id: fullSale.partyId, name: fullSale.partyName || 'Customer', type: 'customer' } as any) : null,
          notes: fullSale.notes || '',
          attributes: (fullSale.attributes as any) || {},
          attachments: fullSale.attachments || [],
          discount: fullSale.discount || 0,
          taxOverride: fullSale.taxTotal || undefined,
          paymentMethod: (fullSale.paymentMethod as any) || 'cash',
          bankId: fullSale.bankId,
          paymentNote: fullSale.paymentNote || '',
          amountReceived: fullSale.amountReceived || 0,
          fullyPaid: fullSale.status === 'paid',
          items: (fullSale.items || []).map((item: any) => ({
            productId: item.productId,
            name: item.name || item.productName || 'Product',
            quantity: item.quantity,
            unit: item.unitType || 'primary',
            unitType: (item.unitType as any) || 'primary',
            unitPrice: item.unitPrice,
            taxRate: item.taxRate || 0,
            ...(() => {
              const prod = (products ?? []).find(p => p.id === item.productId);
              return {
                primaryUnit: prod?.primaryUnit || item.unitType || 'primary',
                secondaryUnit: prod?.secondaryUnit,
                secondaryConversionRate: prod?.secondaryConversionRate || item.conversionRate,
              };
            })()
          }))
        });
      } else {
        setEditingId(null);
        void reset(createEmptyPosDraft());
        await tablesApi.update(tableId, { status: 'occupied' });
        await queryClient.invalidateQueries({ queryKey: ['tables-list'] });
      }
    } catch (err) {
      console.error('Failed to load table draft', err);
    }
  }, [products, queryClient, reset, setValue]);

  const handleSelectTable = async (tableId: string | null, type: 'takeaway' | 'delivery' | 'dine_in') => {
    setTableModalVisible(false);
    setActiveTableId(tableId);
    setOrderType(type);
    if (type === 'dine_in' && tableId) {
      await loadTableDraft(tableId);
    } else {
      setEditingId(null);
      void reset(createEmptyPosDraft());
    }
  };

  useEffect(() => {
    if (paramTableId) {
      void handleSelectTable(paramTableId, 'dine_in');
    }
  }, [paramTableId]);

  useEffect(() => {
    if (!isReady || orderType !== 'dine_in' || !activeTableId) {
      return;
    }

    const activeTable = tables.find(t => t.id === activeTableId);
    const tableName = activeTable ? activeTable.name : `Table ${activeTableId}`;

    const timer = setTimeout(async () => {
      if (value.items.length === 0) {
        if (editingId) {
          try {
            await salesApi.remove(editingId);
            await tablesApi.update(activeTableId, { status: 'vacant' });
            setEditingId(null);
            await Promise.all([
              queryClient.invalidateQueries({ queryKey: ['tables-list'] }),
              queryClient.invalidateQueries({ queryKey: ['sales-list'] }),
            ]);
          } catch (err) {
            console.error('Failed to discard draft', err);
          }
        }
        return;
      }

      try {
        const payload = {
          partyId: value.party?.id || null,
          invoiceNo: value.invoiceNo,
          saleDate: value.saleDate,
          status: 'due',
          amountReceived: 0,
          paymentMethod: 'cash',
          subTotal,
          taxTotal,
          discount: value.discount,
          grandTotal,
          createdBy: user?.id,
          tableId: activeTableId,
          attributes: {
            ...value.attributes,
            order_status: 'new',
            order_type: 'dine_in',
            table_no: tableName,
          },
          items: value.items.map((item) => ({
            productId: item.productId,
            name: item.name,
            quantity: item.quantity,
            unitType: item.unitType || 'primary',
            conversionRate: item.unitType === 'secondary' ? (item.secondaryConversionRate || 0) : 0,
            unitPrice: item.unitPrice,
            taxRate: item.taxRate,
            lineTotal: item.quantity * item.unitPrice,
          })),
        };

        if (editingId) {
          await salesApi.update(editingId, payload);
        } else {
          const res = await salesApi.create(payload);
          if (res.id) {
            setEditingId(res.id);
          }
        }

        if (activeTable?.status !== 'occupied') {
          await tablesApi.update(activeTableId, { status: 'occupied' });
          await queryClient.invalidateQueries({ queryKey: ['tables-list'] });
        }
      } catch (err) {
        console.error('Failed to auto-save draft', err);
      }
    }, 1800);

    return () => clearTimeout(timer);
  }, [
    value.items,
    value.discount,
    value.party,
    value.notes,
    activeTableId,
    orderType,
    isReady,
    editingId,
    tables,
    subTotal,
    taxTotal,
    grandTotal,
    user?.id,
    queryClient
  ]);

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
        setActiveTableId(null);
        setOrderType('takeaway');
        setEditingId(null);
        setTableModalVisible(false);
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

  function openCheckout() {
    if (!value.items.length) {
      Alert.alert('Add items first', 'You need at least one item in the bill before checkout.');
      return;
    }
    setValue((current) =>
      current.fullyPaid ? { ...current, amountReceived: grandTotal } : current,
    );
    setCheckoutVisible(true);
  }

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
        method: editingId ? 'PATCH' : 'POST',
        path: editingId ? `/api/sales/${editingId}` : '/api/sales',
        body: payload,
      });

      // Release table if dine-in and fully paid
      if (orderType === 'dine_in' && activeTableId) {
        if (amountReceived >= grandTotal) {
          await tablesApi.update(activeTableId, { status: 'vacant' });
        }
      }

      const receiptData = {
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
      };

      const receiptHtml = buildReceiptHtml(receiptData);

      setReceipt({
        title: value.invoiceNo,
        subtitle: value.party?.name ?? 'Walk-in customer',
        html: receiptHtml,
        data: receiptData,
      });

      if (result.data) {
        await cacheRecentSales([normalizeSale(unwrapEntity(result.data))]);
      }

      setActiveTableId(null);
      setOrderType('takeaway');
      setEditingId(null);
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
        {!value.items.length ? <Text style={styles.emptyCart}>No items yet. Search and tap a product to add it.</Text> : null}
      </View>
      <TotalsCard
        subTotal={subTotal}
        taxTotal={taxTotal}
        discountTotal={value.discount}
        grandTotal={grandTotal}
        amountReceived={value.fullyPaid ? grandTotal : value.amountReceived}
      />
      <Pressable style={styles.checkoutButton} onPress={openCheckout}>
        <Text style={styles.checkoutLabel}>Checkout</Text>
      </Pressable>
    </SurfaceCard>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.container}>
        <TopAppBar
          currentSegment="pos"
          leadingMode="brand"
          showBack={false}
          right={
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Pressable
                style={styles.clearCartButton}
                hitSlop={8}
                onPress={() => router.push('/(app)/sales' as any)}>
                <MaterialCommunityIcons color={colors.text} name="receipt-text-outline" size={22} />
              </Pressable>
              <Pressable
                style={styles.clearCartButton}
                hitSlop={8}
                onPress={() => {
                  if (!value.items.length) return;
                  Alert.alert(
                    'Clear cart',
                    'Remove all items from this sale?',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Clear',
                        style: 'destructive',
                        onPress: async () => {
                          if (orderType === 'dine_in' && activeTableId && editingId) {
                            try {
                              await salesApi.remove(editingId);
                              await tablesApi.update(activeTableId, { status: 'vacant' });
                            } catch (e) {
                              console.error(e);
                            }
                          }
                          setActiveTableId(null);
                          setOrderType('takeaway');
                          setEditingId(null);
                          void reset(createEmptyPosDraft());
                          await queryClient.invalidateQueries({ queryKey: ['tables-list'] });
                        },
                      },
                    ],
                  );
                }}>
                <MaterialCommunityIcons color={value.items.length ? colors.danger : colors.textSoft} name="trash-can-outline" size={22} />
              </Pressable>
            </View>
          }
        />

        <View style={styles.contextBar}>
          <Pressable style={styles.contextRow} onPress={() => setPartyPickerVisible(true)}>
            <View style={[styles.contextAvatar, { backgroundColor: colors.primary }]}>
              <Text style={styles.contextAvatarText}>
                {value.party?.name ? partyInitials(value.party.name) : 'W'}
              </Text>
            </View>
            <View style={styles.contextCopy}>
              <Text style={styles.contextKicker}>Customer</Text>
              <Text numberOfLines={1} style={styles.contextValue}>
                {value.party?.name ?? 'Walk-in'}
              </Text>
            </View>
            <MaterialCommunityIcons color={colors.textMuted} name="chevron-down" size={18} />
          </Pressable>

          {cafeMode && tables.length > 0 ? (
            <>
              <View style={styles.contextDivider} />
              <Pressable style={styles.contextRow} onPress={() => setTableModalVisible(true)}>
                <View style={[styles.contextAvatar, { backgroundColor: colors.accentSoft }]}>
                  <MaterialCommunityIcons
                    color={colors.primary}
                    name={
                      orderType === 'delivery'
                        ? 'truck-delivery-outline'
                        : orderType === 'dine_in'
                          ? 'table-chair'
                          : 'shopping-outline'
                    }
                    size={18}
                  />
                </View>
                <View style={styles.contextCopy}>
                  <Text style={styles.contextKicker}>Order</Text>
                  <Text numberOfLines={1} style={styles.contextValue}>
                    {orderType === 'dine_in'
                      ? tables.find((table) => table.id === activeTableId)?.name ?? 'Table'
                      : orderType === 'delivery'
                        ? 'Delivery'
                        : 'Walk-in'}
                  </Text>
                </View>
                <MaterialCommunityIcons color={colors.textMuted} name="chevron-down" size={18} />
              </Pressable>
            </>
          ) : null}
        </View>

        {/* Table/Session Selector Modal */}
        <BottomSheet
          visible={tableModalVisible}
          title="Select Order Session"
          subtitle="Choose table seating for dine-in, or select takeaway/delivery options."
          onClose={() => setTableModalVisible(false)}
          fullHeight
        >
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.tableModalContent}>
            <Text style={styles.tableModalSectionTitle}>Standard Options</Text>
            <View style={styles.standardSessionRow}>
              <Pressable
                style={[styles.standardSessionCard, orderType === 'takeaway' && styles.sessionCardSelected]}
                onPress={() => void handleSelectTable(null, 'takeaway')}
              >
                <MaterialCommunityIcons
                  name="shopping-outline"
                  size={24}
                  color={orderType === 'takeaway' ? colors.primary : colors.textSoft}
                />
                <Text style={[styles.sessionCardLabel, orderType === 'takeaway' && styles.sessionCardLabelActive]}>
                  Walk-in / Takeaway
                </Text>
              </Pressable>
              <Pressable
                style={[styles.standardSessionCard, orderType === 'delivery' && styles.sessionCardSelected]}
                onPress={() => void handleSelectTable(null, 'delivery')}
              >
                <MaterialCommunityIcons
                  name="truck-delivery-outline"
                  size={24}
                  color={orderType === 'delivery' ? colors.primary : colors.textSoft}
                />
                <Text style={[styles.sessionCardLabel, orderType === 'delivery' && styles.sessionCardLabelActive]}>
                  Home Delivery
                </Text>
              </Pressable>
            </View>

            {cafeMode && tables.length > 0 ? (
              <>
                <Text style={styles.tableModalSectionTitle}>Tables</Text>
                <View style={styles.tablesGridModal}>
                  {tables.map((table) => {
                    const isSelected = activeTableId === table.id;
                    const isOccupied = table.status === 'occupied';
                    return (
                      <Pressable
                        key={table.id}
                        style={[
                          styles.modalTableCard,
                          isSelected && styles.sessionCardSelected,
                          isOccupied && !isSelected && styles.modalTableCardOccupied,
                        ]}
                        onPress={() => void handleSelectTable(table.id, 'dine_in')}
                      >
                        <Text style={[styles.modalTableCardName, isSelected && styles.sessionCardLabelActive]}>
                          {table.name}
                        </Text>
                        <Text style={styles.modalTableCardCapacity}>
                          {table.capacity ?? 4} seats{isOccupied ? ' · Busy' : ''}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : null}
          </ScrollView>
        </BottomSheet>

        {isTablet ? (
          <View style={styles.tabletLayout}>
            <View style={styles.tabletProducts}>{productsPane}</View>
            <View style={styles.tabletBill}>{billPane}</View>
          </View>
        ) : (
          <>
            {productsPane}
            <BillSummaryBar itemCount={cartItemCount} total={grandTotal} onPress={openCheckout} />
          </>
        )}
      </View>

      <PosCheckoutSheet
        visible={checkoutVisible}
        cafeMode={cafeMode}
        value={value}
        setValue={setValue}
        subTotal={subTotal}
        taxTotal={taxTotal}
        grandTotal={grandTotal}
        banks={activeBanks}
        orderAttributes={orderAttributes ?? []}
        onClose={() => setCheckoutVisible(false)}
        onSelectParty={() => setPartyPickerVisible(true)}
        onEditItems={() => setCheckoutVisible(false)}
        onSave={(mode) => void saveSale(mode)}
        onAddImage={() => void addImageAttachment()}
        onRemoveAttachment={removeAttachment}
      />

      <BottomSheet
        visible={categoryPickerVisible}
        title="Choose Category"
        subtitle="Filter the product grid by category without leaving Quick POS."
        onClose={() => setCategoryPickerVisible(false)}
        fullHeight>
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
        createLabel="+ Add New Customer"
        onCreatePress={() => {
          setPartyPickerVisible(false);
          setPartyCreateVisible(true);
        }}
        onPick={(party) => {
          setValue((current) => ({ ...current, party }));
          setPartyPickerVisible(false);
        }}
        onClose={() => setPartyPickerVisible(false)}
        title="Select Party for Sale"
        subtitle="Pick a customer or keep this bill as a cash sale."
      />

      <PartyFormSheet
        visible={partyCreateVisible}
        onClose={() => setPartyCreateVisible(false)}
        onSaved={(newParty) => {
          setValue((current) => ({ ...current, party: newParty }));
          setPartyCreateVisible(false);
        }}
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

const createStyles = (colors: AppPalette) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
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
    color: colors.textMuted,
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
    backgroundColor: colors.surfaceMuted,
  },
  filterChipLabel: {
    fontSize: typography.subheading,
    fontWeight: '600',
    color: colors.text,
  },
  addItemChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
  },
  addItemChipLabel: {
    fontSize: typography.subheading,
    fontWeight: '600',
    color: colors.text,
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
    color: colors.text,
  },
  billMeta: {
    fontSize: typography.label,
    color: colors.textMuted,
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
    backgroundColor: colors.backgroundAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  billButtonLabel: {
    fontSize: typography.body,
    fontWeight: '800',
    color: colors.text,
  },
  billQuantity: {
    minWidth: 18,
    textAlign: 'center',
    fontWeight: '700',
    color: colors.text,
  },
  billLineAmount: {
    fontSize: typography.body,
    fontWeight: '700',
    color: colors.text,
  },
  emptyCart: {
    fontSize: typography.body,
    color: colors.textMuted,
  },
  checkoutButton: {
    minHeight: 50,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkoutLabel: {
    color: colors.white,
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
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    gap: spacing.xs,
  },
  primaryFooterButton: {
    flex: 1,
    minHeight: 58,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  secondaryFooterLabel: {
    color: colors.text,
    fontSize: typography.subheading,
    fontWeight: '800',
  },
  primaryFooterLabel: {
    color: colors.white,
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
    backgroundColor: colors.backgroundAlt,
  },
  bankChipActive: {
    backgroundColor: colors.primary,
  },
  bankChipLabel: {
    color: colors.text,
    fontWeight: '700',
  },
  bankChipLabelActive: {
    color: colors.white,
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
    borderColor: colors.border,
    backgroundColor: colors.backgroundAlt,
  },
  emptyBankText: {
    flex: 1,
    fontSize: typography.body,
    color: colors.textMuted,
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
    backgroundColor: colors.backgroundAlt,
  },
  quickPaymentLabel: {
    color: colors.text,
    fontWeight: '700',
  },
  fullToggle: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullToggleActive: {
    backgroundColor: colors.successSoft,
    borderColor: colors.success,
  },
  fullToggleLabel: {
    color: colors.text,
    fontWeight: '700',
  },
  fullToggleLabelActive: {
    color: colors.success,
  },
  invoiceSplitCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
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
    color: colors.textSoft,
  },
  invoiceSplitValue: {
    fontSize: 22,
    fontWeight: '500',
    color: colors.text,
  },
  invoiceDivider: {
    width: 1,
    backgroundColor: colors.border,
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
    borderColor: colors.border,
    backgroundColor: colors.surface,
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
    backgroundColor: colors.primary,
  },
  partyCardIconText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '800',
  },
  partyCardTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: colors.text,
  },
  partyCardSubtitle: {
    fontSize: typography.body,
    color: colors.textMuted,
  },
  changePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    minHeight: 44,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  changePillLabel: {
    fontSize: typography.subheading,
    fontWeight: '700',
    color: colors.primary,
  },
  addItemsCard: {
    minHeight: 88,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  addItemsLabel: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.primary,
  },
  sectionCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
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
    color: colors.text,
  },
  chargeCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
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
    color: colors.textMuted,
  },
  chargeSuffix: {
    fontSize: typography.subheading,
    color: colors.textMuted,
  },
  chargeInput: {
    minWidth: 92,
    minHeight: 42,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    fontSize: typography.subheading,
    color: colors.text,
    textAlign: 'right',
  },
  chargeStatic: {
    fontSize: typography.subheading,
    color: colors.text,
  },
  chargeValue: {
    fontSize: typography.subheading,
    color: colors.text,
  },
  itemsListCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  totalCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
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
    color: colors.text,
  },
  totalValue: {
    fontSize: typography.heading,
    fontWeight: '700',
    color: colors.text,
  },
  paymentModeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  paymentModeLabel: {
    fontSize: typography.subheading,
    color: colors.textSoft,
  },
  paymentModeValueWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  paymentModeValue: {
    fontSize: typography.subheading,
    color: colors.text,
  },
  addImagesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  addImagesLabel: {
    fontSize: typography.subheading,
    fontWeight: '700',
    color: colors.primary,
  },
  attachmentsPreviewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  attachmentCard: {
    width: 110,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xs,
    gap: spacing.xs,
  },
  attachmentPreview: {
    width: '100%',
    height: 84,
    borderRadius: radius.sm,
    backgroundColor: colors.backgroundAlt,
  },
  attachmentFallback: {
    width: '100%',
    height: 84,
    borderRadius: radius.sm,
    backgroundColor: colors.backgroundAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachmentName: {
    fontSize: typography.caption,
    color: colors.textMuted,
  },
  attachmentRemoveButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
  },
  categoryPickerList: {
    gap: spacing.sm,
    paddingBottom: spacing.lg,
  },
  categoryPickerItem: {
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: colors.backgroundAlt,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryPickerItemActive: {
    backgroundColor: colors.primary,
  },
  categoryPickerLabel: {
    fontSize: typography.body,
    fontWeight: '700',
    color: colors.text,
  },
  categoryPickerLabelActive: {
    color: colors.white,
  },
  contextBar: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  contextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  contextDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
  },
  contextAvatar: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contextAvatarText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '800',
  },
  contextCopy: {
    flex: 1,
    gap: 1,
  },
  contextKicker: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSoft,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  contextValue: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },
  customerSelectorBar: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
    backgroundColor: colors.successSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerLabel: {
    fontSize: typography.caption,
    fontWeight: '700',
    color: colors.textSoft,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  customerName: {
    fontSize: typography.body,
    fontWeight: '800',
    color: colors.text,
  },
  customerChangeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.successSoft,
    borderWidth: 1,
    borderColor: colors.success,
  },
  customerChangeLabel: {
    fontSize: typography.label,
    fontWeight: '700',
    color: colors.success,
  },
  clearCartButton: {
    padding: spacing.xs,
  },
  billItemContainer: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
    backgroundColor: colors.backgroundAlt,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  unitChipLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  unitChipLabelActive: {
    color: colors.white,
  },
  sessionHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  sessionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sessionAvatar: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSoft,
    textTransform: 'uppercase',
  },
  sessionName: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },
  sessionChangeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  sessionChangeLabel: {
    fontSize: typography.label,
    fontWeight: '700',
    color: colors.primary,
  },
  tableModalContent: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  tableModalSectionTitle: {
    fontSize: typography.label,
    fontWeight: '800',
    color: colors.textSoft,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.sm,
  },
  standardSessionRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  standardSessionCard: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.backgroundWarm,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: 80,
  },
  sessionCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.accentSoft,
  },
  sessionCardLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSoft,
    textAlign: 'center',
  },
  sessionCardLabelActive: {
    color: colors.primary,
  },
  tablesGridModal: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  modalTableCard: {
    flexBasis: '30%',
    flexGrow: 1,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.backgroundWarm,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 64,
  },
  modalTableCardOccupied: {
    borderColor: '#eeddc8',
    backgroundColor: '#fffbeb',
  },
  modalTableCardName: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
  },
  modalTableCardCapacity: {
    fontSize: 10,
    color: colors.textMuted,
  },
});
