import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useFocusEffect } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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
import { OrderSessionSheet } from '@/src/features/pos/components/OrderSessionSheet';
import { PosCartPane } from '@/src/features/pos/components/PosCartPane';
import { PosContextBar } from '@/src/features/pos/components/PosContextBar';
import { PosProductGrid } from '@/src/features/pos/components/PosProductGrid';
import { PosCheckoutSheet } from '@/src/features/pos/components/PosCheckoutSheet';
import { BottomSheet } from '@/src/shared/feedback/BottomSheet';
import { useConfirm } from '@/src/shared/feedback/ConfirmProvider';
import { useToast } from '@/src/shared/feedback/ToastProvider';
import { haptics } from '@/src/shared/lib/haptics';
import { SkeletonCardGrid } from '@/src/shared/ui/Skeleton';
import { buildReceiptHtml } from '@/src/shared/lib/receipt';
import { uploadAttachments } from '@/src/shared/lib/uploads';
import { todayIso } from '@/src/shared/lib/format';
import { isCafeWorkspace } from '@/src/shared/lib/business';
import { useBanks, useNextSequences, useOrderAttributes, useParties, useProducts, useTables } from '@/src/shared/hooks/useAppQueries';
import { salesApi, tablesApi } from '@/src/api';
import { useDebouncedValue } from '@/src/shared/hooks/useDebouncedValue';
import { useDraftState } from '@/src/shared/hooks/useDraftState';
import { useIsTablet } from '@/src/shared/hooks/useIsTablet';
import { usePosTotals } from '@/src/features/pos/hooks/usePosTotals';
import { usePosCart } from '@/src/features/pos/hooks/usePosCart';
import { computeLineTotal } from '@/src/shared/lib/totals';
import { radius, spacing, typography } from '@/src/theme';
import { useAuthStore } from '@/src/stores/auth-store';
import { useReceiptStore } from '@/src/stores/receipt-store';
import type { PosDraft } from '@/src/types/forms';
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
  const toast = useToast();
  const confirm = useConfirm();
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
  const productsQuery = useProducts(debouncedSearch);
  const products = productsQuery.data;
  const [refreshing, setRefreshing] = useState(false);
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
      toast.error('Add at least one item before checkout.');
      return;
    }
    setValue((current) =>
      current.fullyPaid ? { ...current, amountReceived: grandTotal } : current,
    );
    setCheckoutVisible(true);
  }

  async function saveSale(mode: 'save' | 'print') {
    if (!value.items.length) {
      toast.error('Add at least one item before saving.');
      return;
    }

    const amountReceived = value.fullyPaid ? grandTotal : value.amountReceived;
    if (value.paymentMethod === 'bank' && amountReceived > 0 && !value.bankId) {
      toast.error('Select a bank account for bank payments.');
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
      haptics.success();
      setSuccessState({ visible: true, queued: result.queued });

      if (mode === 'print') {
        router.push('/(app)/print-preview');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save the sale. Please try again.');
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
        <TopAppBar currentSegment="pos" leadingMode="brand" showBack={false} />
        <View style={styles.loadingWrap}>
          <SkeletonCardGrid columns={isTablet ? 3 : 2} count={isTablet ? 9 : 6} />
        </View>
      </SafeAreaView>
    );
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await productsQuery.refetch();
    } finally {
      setRefreshing(false);
    }
  }

  const productsPane = (
    <PosProductGrid
      products={visibleProducts}
      cartItems={value.items}
      loading={productsQuery.isLoading}
      refreshing={refreshing}
      onRefresh={() => void handleRefresh()}
      onAdd={(productId) => updateCart(productId, 'add')}
      onSubtract={(productId) => updateCart(productId, 'subtract')}
      search={search}
      setSearch={setSearch}
      category={category}
      setCategory={setCategory}
      categoryOptions={categoryOptions}
      isTablet={isTablet}
      filtered={Boolean(search) || category !== 'All'}
    />
  );

  const billPane = (
    <PosCartPane
      items={value.items}
      products={products ?? []}
      subTotal={subTotal}
      taxTotal={taxTotal}
      discountTotal={value.discount}
      grandTotal={grandTotal}
      amountReceived={value.fullyPaid ? grandTotal : value.amountReceived}
      onAdd={(productId) => updateCart(productId, 'add')}
      onSubtract={(productId) => updateCart(productId, 'subtract')}
      onToggleUnit={toggleItemUnit}
      onCheckout={openCheckout}
    />
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
                onPress={async () => {
                  if (!value.items.length) return;
                  const confirmed = await confirm({
                    title: 'Clear this bill?',
                    message: 'Every item on the current sale will be removed.',
                    confirmLabel: 'Clear',
                    destructive: true,
                  });
                  if (!confirmed) return;

                  if (orderType === 'dine_in' && activeTableId && editingId) {
                    try {
                      await salesApi.remove(editingId);
                      await tablesApi.update(activeTableId, { status: 'vacant' });
                    } catch (error) {
                      console.error(error);
                    }
                  }
                  setActiveTableId(null);
                  setOrderType('takeaway');
                  setEditingId(null);
                  void reset(createEmptyPosDraft());
                  await queryClient.invalidateQueries({ queryKey: ['tables-list'] });
                  toast.success('Bill cleared');
                }}>
                <MaterialCommunityIcons color={value.items.length ? colors.danger : colors.textSoft} name="trash-can-outline" size={22} />
              </Pressable>
            </View>
          }
        />

        <PosContextBar
          partyName={value.party?.name}
          onPickParty={() => setPartyPickerVisible(true)}
          showSession={cafeMode && tables.length > 0}
          orderType={orderType}
          sessionLabel={
            orderType === 'dine_in'
              ? tables.find((table) => table.id === activeTableId)?.name ?? 'Table'
              : orderType === 'delivery'
                ? 'Delivery'
                : 'Walk-in'
          }
          onPickSession={() => setTableModalVisible(true)}
        />

        <OrderSessionSheet
          visible={tableModalVisible}
          onClose={() => setTableModalVisible(false)}
          orderType={orderType}
          activeTableId={activeTableId}
          tables={tables}
          showTables={cafeMode}
          onSelect={(tableId, type) => void handleSelectTable(tableId, type)}
        />

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
    padding: spacing.md,
  },
  clearCartButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  tabletLayout: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  tabletProducts: {
    flex: 2,
  },
  tabletBill: {
    flex: 1,
    minWidth: 320,
  },
  categoryPickerList: {
    gap: spacing.xs,
    paddingBottom: spacing.lg,
  },
  categoryPickerItem: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.backgroundAlt,
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
    color: colors.onPrimary,
  },
});
