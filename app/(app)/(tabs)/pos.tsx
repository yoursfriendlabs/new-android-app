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
import { PartyPickerFlow } from '@/src/shared/forms/PartyPickerFlow';
import { TopAppBar } from '@/src/shared/layout/TopAppBar';
import { BillSummaryBar } from '@/src/features/pos/components/BillSummaryBar';
import { OrderSessionSheet } from '@/src/features/pos/components/OrderSessionSheet';
import { PosCartPane } from '@/src/features/pos/components/PosCartPane';
import { PosContextBar } from '@/src/features/pos/components/PosContextBar';
import { PosProductGrid } from '@/src/features/pos/components/PosProductGrid';
import { PosCheckoutSheet } from '@/src/features/pos/components/PosCheckoutSheet';
import { BottomSheet } from '@/src/shared/feedback/BottomSheet';
import { useConfirm } from '@/src/shared/feedback/ConfirmProvider';
import { usePekkaHandoff } from '@/src/features/pekka/stores/pekka-handoff';
import { useToast } from '@/src/shared/feedback/ToastProvider';
import { haptics } from '@/src/shared/lib/haptics';
import { SkeletonCardGrid } from '@/src/shared/ui/Skeleton';
import { apiBillStatus } from '@/src/shared/lib/bill-status';
import { buildReceiptHtml } from '@/src/shared/lib/receipt';
import { uploadAttachments } from '@/src/shared/lib/uploads';
import { todayIso } from '@/src/shared/lib/format';
import { isCafeWorkspace } from '@/src/shared/lib/business';
import {
  buildCafeOrderAttributes,
  findOpenTableOrder,
  getCafeOrderAttributes,
  getCafeOrderTypeLabel,
} from '@/src/features/cafe/lib/cafeOrders';
import {
  invalidateAfterBill,
  useBanks,
  useNextSequences,
  useOrderAttributes,
  useParties,
  useProducts,
  useTables,
} from '@/src/shared/hooks/useAppQueries';
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
  const { updateCart } = usePosCart(products, setValue, (saleItemId) =>
    setRemovedLineIds((current) => (current.includes(saleItemId) ? current : [...current, saleItemId])),
  );

  const { tableId: paramTableId } = useLocalSearchParams<{ tableId?: string }>();
  const { data: tables = [] } = useTables({}, { enabled: cafeMode });
  const [activeTableId, setActiveTableId] = useState<string | null>(null);
  const [orderType, setOrderType] = useState<'takeaway' | 'delivery' | 'dine_in'>('takeaway');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tableModalVisible, setTableModalVisible] = useState(false);
  // A cafe order starts by saying where it is going, so the sheet opens itself.
  const [sessionChosen, setSessionChosen] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [removedLineIds, setRemovedLineIds] = useState<string[]>([]);

  const activeTable = tables.find((table) => table.id === activeTableId) ?? null;
  const activeTableName = activeTable?.name ?? (activeTableId ? `Table ${activeTableId}` : '');
  const sessionLabel =
    orderType === 'dine_in' ? activeTableName || 'Table' : getCafeOrderTypeLabel(orderType);

  const loadTableDraft = useCallback(async (tableId: string) => {
    try {
      // Only bills with money still on them can be an open table order.
      const res = await salesApi.list({ payment: 'due', limit: 200 });
      const tableName = tables.find((table) => table.id === tableId)?.name;
      const openOrder = findOpenTableOrder(extractListItems<Sale>(res), tableId, tableName);

      if (openOrder) {
        const fullSale = await salesApi.get(openOrder.id);
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
            saleItemId: item.id,
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
  }, [products, queryClient, reset, setValue, tables]);

  const handleSelectTable = async (tableId: string | null, type: 'takeaway' | 'delivery' | 'dine_in') => {
    setTableModalVisible(false);
    setActiveTableId(tableId);
    setOrderType(type);
    setSessionChosen(true);
    if (type === 'dine_in' && tableId) {
      await loadTableDraft(tableId);
    } else {
      setEditingId(null);
      void reset(createEmptyPosDraft());
      // A delivery needs somewhere to deliver to, so ask who it is for.
      if (type === 'delivery') setPartyPickerVisible(true);
    }
  };

  useEffect(() => {
    if (paramTableId) {
      void handleSelectTable(paramTableId, 'dine_in');
    }
  }, [paramTableId]);

  // Dine in, takeaway or delivery is the first thing a cafe decides, so ask it
  // before the menu rather than leaving takeaway silently assumed.
  useEffect(() => {
    if (!isReady || !cafeMode || sessionChosen || paramTableId) return;
    if (value.items.length > 0) {
      setSessionChosen(true);
      return;
    }
    setTableModalVisible(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, cafeMode, sessionChosen, paramTableId]);

  // A sale Pekka prepared from "sold 2 coke to Ram": load it for the user to check and save.
  const pekkaSale = usePekkaHandoff((state) => state.sale);
  useEffect(() => {
    if (!isReady || !pekkaSale) return;
    const draft = usePekkaHandoff.getState().takeSale();
    if (!draft) return;
    void (async () => {
      if (value.items.length > 0) {
        const replace = await confirm({
          title: 'Replace the current bill?',
          message: 'Pekka prepared a new sale. The items already in this bill will be removed.',
          confirmLabel: 'Replace',
          icon: 'robot-happy',
        });
        if (!replace) return;
      }
      // Pekka's sale is a counter sale, never an open table's bill.
      setActiveTableId(null);
      setOrderType('takeaway');
      setEditingId(null);
      setValue(() => ({
        ...createEmptyPosDraft(),
        items: draft.items,
        party: draft.party,
        fullyPaid: draft.fullyPaid,
        amountReceived: draft.amountReceived,
      }));
      toast.info('Pekka filled this sale. Check it, then save.');
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, pekkaSale]);

  /**
   * The order as the kitchen and the cashier see it: an open bill, nothing
   * charged yet, that more items can still join.
   */
  function buildOpenOrderPayload() {
    const existingStatus = getCafeOrderAttributes({ attributes: value.attributes }).orderStatus;
    return {
      partyId: value.party?.id || null,
      invoiceNo: value.invoiceNo,
      saleDate: value.saleDate,
      status: 'due',
      amountReceived: 0,
      paymentMethod: 'cash',
      notes: value.notes,
      subTotal,
      taxTotal,
      discount: value.discount,
      discountTotal: value.discount,
      grandTotal,
      createdBy: user?.id,
      tableId: orderType === 'dine_in' ? activeTableId : null,
      attributes: buildCafeOrderAttributes(value.attributes, {
        // A new order starts at New; one the kitchen already moved on keeps its stage.
        orderStatus: editingId ? existingStatus : 'new',
        orderType,
        tableNo: orderType === 'dine_in' ? activeTableName : '',
        customerName: value.party?.name ?? '',
        customerPhone: value.party?.phone ? String(value.party.phone) : '',
        customerAddress: value.party?.address ? String(value.party.address) : '',
      }),
      items: [
        ...value.items.map((item) => ({
          ...(item.saleItemId ? { id: item.saleItemId } : {}),
          productId: item.productId,
          name: item.name,
          quantity: item.quantity,
          unitType: item.unitType || 'primary',
          conversionRate: item.unitType === 'secondary' ? (item.secondaryConversionRate || 0) : 0,
          unitPrice: item.unitPrice,
          taxRate: item.taxRate,
          lineTotal: computeLineTotal(item),
        })),
        // Lines the waiter took off the order have to be removed server-side too.
        ...removedLineIds.map((id) => ({ id, _delete: true as const })),
      ],
    };
  }

  /** Saves the order without charging for it. Dine-in also claims its table. */
  async function persistOpenOrder({ silent = true } = {}) {
    if (!cafeMode || !value.items.length) return null;

    try {
      let orderId = editingId;
      if (orderId) {
        await salesApi.update(orderId, buildOpenOrderPayload());
      } else {
        const created = await salesApi.create(buildOpenOrderPayload());
        orderId = created?.id ?? null;
        if (orderId) setEditingId(orderId);
      }

      if (orderType === 'dine_in' && activeTableId && activeTable?.status !== 'occupied') {
        await tablesApi.update(activeTableId, { status: 'occupied' });
      }

      setRemovedLineIds([]);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tables-list'] }),
        queryClient.invalidateQueries({ queryKey: ['sales-list'] }),
      ]);
      return orderId;
    } catch (error) {
      if (!silent) {
        toast.error(error instanceof Error ? error.message : 'Could not save this order.');
      } else {
        console.error('Failed to save the open order', error);
      }
      return null;
    }
  }

  /** The waiter has taken the order: save it, tell them, and start a fresh one. */
  async function handleSaveOrder() {
    if (!value.items.length) {
      toast.error('Add at least one item before saving the order.');
      return;
    }
    setSavingOrder(true);
    const orderId = await persistOpenOrder({ silent: false });
    setSavingOrder(false);
    if (!orderId) return;

    haptics.success();
    toast.success(
      orderType === 'dine_in'
        ? `Order saved for ${activeTableName || 'the table'}. Add more any time.`
        : `${getCafeOrderTypeLabel(orderType)} order saved. It is on the kitchen board.`,
    );
    setActiveTableId(null);
    setOrderType('takeaway');
    setEditingId(null);
    setSessionChosen(false);
    setRemovedLineIds([]);
    await reset(createEmptyPosDraft());
  }

  /** A safety net: an order in progress survives a phone going to sleep. */
  useEffect(() => {
    if (!isReady || !cafeMode || !sessionChosen) return;
    if (orderType === 'dine_in' && !activeTableId) return;

    const timer = setTimeout(() => {
      if (value.items.length === 0) {
        // The last item came off an order that was already saved: drop it and
        // free the table rather than leaving an empty bill behind.
        if (!editingId) return;
        void (async () => {
          try {
            await salesApi.remove(editingId);
            if (orderType === 'dine_in' && activeTableId) {
              await tablesApi.update(activeTableId, { status: 'vacant' });
            }
            setEditingId(null);
            await Promise.all([
              queryClient.invalidateQueries({ queryKey: ['tables-list'] }),
              queryClient.invalidateQueries({ queryKey: ['sales-list'] }),
            ]);
          } catch (err) {
            console.error('Failed to discard the open order', err);
          }
        })();
        return;
      }

      void persistOpenOrder();
    }, 1800);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    value.items,
    value.discount,
    value.party,
    value.notes,
    activeTableId,
    activeTableName,
    orderType,
    sessionChosen,
    cafeMode,
    isReady,
    editingId,
    subTotal,
    taxTotal,
    grandTotal,
    user?.id,
    queryClient,
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
        setSessionChosen(false);
        setRemovedLineIds([]);
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
      // Merge the configured defaults in; replacing the object would throw away
      // the cafe order's own attributes (stage, type, table).
      attributes:
        orderAttributes?.reduce<Record<string, string>>(
          (result, attribute) => {
            result[attribute.key] = current.attributes[attribute.key] ?? String(attribute.defaultValue ?? '');
            return result;
          },
          { ...current.attributes },
        ) ?? current.attributes,
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
        // The server stores 'due' or 'paid' and nothing else — a bill saved as
        // 'partial' or 'unpaid' disappears from every open-bill list there is.
        status: apiBillStatus(grandTotal, amountReceived),
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
        // Closing a cafe bill also completes the order, so it leaves the kitchen
        // board and the floor map — both of which read order_status.
        attributes: cafeMode
          ? buildCafeOrderAttributes(value.attributes, {
              orderStatus:
                amountReceived >= grandTotal
                  ? 'completed'
                  : getCafeOrderAttributes({ attributes: value.attributes }).orderStatus,
              orderType,
              tableNo: orderType === 'dine_in' ? activeTableName : '',
              customerName: value.party?.name ?? '',
              customerPhone: value.party?.phone ? String(value.party.phone) : '',
              customerAddress: value.party?.address ? String(value.party.address) : '',
            })
          : value.attributes,
        tableId: orderType === 'dine_in' ? activeTableId : undefined,
        subTotal,
        taxTotal,
        discount: value.discount,
        discountTotal: value.discount,
        grandTotal,
        createdBy: user?.id,
        items: [
          ...value.items.map((item) => ({
            ...(item.saleItemId ? { id: item.saleItemId } : {}),
            productId: item.productId,
            quantity: item.quantity,
            unitType: item.unitType || 'primary',
            conversionRate: item.unitType === 'secondary' ? (item.secondaryConversionRate || 0) : 0,
            unitPrice: item.unitPrice,
            taxRate: item.taxRate,
            lineTotal: computeLineTotal(item),
          })),
          ...removedLineIds.map((id) => ({ id, _delete: true as const })),
        ],
      };

      const result = await submitWithOfflineQueue<Sale, typeof payload>({
        entityType: 'sale',
        method: editingId ? 'PATCH' : 'POST',
        path: editingId ? `/api/sales/${editingId}` : '/api/sales',
        body: payload,
      });

      // A settled dine-in bill frees the table.
      if (orderType === 'dine_in' && activeTableId && amountReceived >= grandTotal) {
        await tablesApi.update(activeTableId, { status: 'vacant' });
        await queryClient.invalidateQueries({ queryKey: ['tables-list'] });
      }

      const receiptData = {
        heading: 'Sale Invoice',
        reference: value.invoiceNo,
        date: value.saleDate,
        subtitle: value.party?.name ?? 'Walk-in customer',
        partyName: value.party?.name ?? 'Walk-in customer',
        partyPhone: value.party?.phone ? String(value.party.phone) : undefined,
        paymentMethod: value.paymentMethod,
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
        dueAmount: Math.max(grandTotal - amountReceived, 0),
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
        // Stock on the grid, the customer's balance and today's sales all changed.
        await invalidateAfterBill(queryClient, [value.party?.id]);
      }

      setActiveTableId(null);
      setOrderType('takeaway');
      setEditingId(null);
      setSessionChosen(false);
      setRemovedLineIds([]);
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
      secondaryLabel={cafeMode ? 'Save order' : undefined}
      onSecondaryPress={cafeMode ? () => void handleSaveOrder() : undefined}
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

                  if (editingId) {
                    try {
                      await salesApi.remove(editingId);
                      if (orderType === 'dine_in' && activeTableId) {
                        await tablesApi.update(activeTableId, { status: 'vacant' });
                      }
                    } catch (error) {
                      console.error(error);
                    }
                  }
                  setActiveTableId(null);
                  setOrderType('takeaway');
                  setEditingId(null);
                  setSessionChosen(false);
                  setRemovedLineIds([]);
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
          showSession={cafeMode}
          orderType={orderType}
          sessionLabel={sessionChosen ? sessionLabel : 'Choose'}
          onPickSession={() => setTableModalVisible(true)}
        />

        <OrderSessionSheet
          visible={tableModalVisible}
          requireChoice={!sessionChosen}
          onClose={() => {
            setTableModalVisible(false);
            // Dismissed without choosing: treat it as a takeaway counter sale
            // rather than asking again on every tap.
            setSessionChosen(true);
          }}
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
            <BillSummaryBar
              itemCount={cartItemCount}
              total={grandTotal}
              onPress={openCheckout}
              secondaryLabel={cafeMode ? 'Save order' : undefined}
              onSecondaryPress={cafeMode ? () => void handleSaveOrder() : undefined}
              secondaryBusy={savingOrder}
            />
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

      <PartyPickerFlow
        visible={partyPickerVisible}
        search={partySearch}
        onSearchChange={setPartySearch}
        parties={parties ?? []}
        createLabel="Add new customer"
        onPick={(party) => {
          setValue((current) => ({ ...current, party }));
          setPartyPickerVisible(false);
        }}
        onClose={() => setPartyPickerVisible(false)}
        title="Select Party for Sale"
        subtitle="Pick a customer, add a new one, or keep this bill as a cash sale."
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
