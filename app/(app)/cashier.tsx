import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { salesApi, tablesApi } from '@/src/api';
import { BottomSheet } from '@/src/components/feedback/BottomSheet';
import { SuccessSheet } from '@/src/components/feedback/SuccessSheet';
import { FormField } from '@/src/components/forms/FormField';
import { PaymentMethodSelector } from '@/src/components/forms/PaymentMethodSelector';
import { Screen } from '@/src/components/layout/Screen';
import { PageHeading } from '@/src/components/ui/PageHeading';
import { SurfaceCard } from '@/src/components/ui/SurfaceCard';
import { TotalsCard } from '@/src/components/ui/TotalsCard';
import { SearchField } from '@/src/components/ui/SearchField';
import { useBanks, useSalesList, useTables, useCategories } from '@/src/hooks/useAppQueries';
import { formatCurrency } from '@/src/lib/format';
import { buildReceiptHtml } from '@/src/lib/receipt';
import { computeLineTotal } from '@/src/lib/totals';
import { palette, radius, spacing, typography, shadows } from '@/src/theme';
import type { Sale, Table } from '@/src/types/models';
import { useReceiptStore } from '@/src/stores/receipt-store';

export default function CashierScreen() {
  const queryClient = useQueryClient();
  const setReceipt = useReceiptStore((state) => state.setReceipt);

  // Queries
  const { data: tables = [], isLoading: loadingTables } = useTables();
  const { data: sales = [], isLoading: loadingSales } = useSalesList({ limit: 120 });
  const { data: categories = [] } = useCategories();
  const { data: banks = [] } = useBanks();

  const activeBanks = useMemo(() => banks.filter((b) => b.isActive), [banks]);

  const floors = useMemo(() => {
    return categories.filter((cat: any) => cat.type === 'table');
  }, [categories]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFloorFilter, setSelectedFloorFilter] = useState('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('all');

  // Derive active due sales and link to tables
  const unpaidSales = useMemo(() => {
    return (sales ?? []).filter((s) => s.status === 'due');
  }, [sales]);

  const mappedTables = useMemo(() => {
    return tables.map((table) => {
      const matchedSale = unpaidSales.find((s) => s.tableId === table.id);
      return {
        ...table,
        matchedSale,
      };
    });
  }, [tables, unpaidSales]);

  const filteredTables = useMemo(() => {
    return mappedTables.filter((table) => {
      if (searchQuery && !table.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      
      if (selectedFloorFilter !== 'all') {
        if (selectedFloorFilter === 'unassigned') {
          if (table.categoryId || table.category?.id) return false;
        } else {
          const catId = table.categoryId || table.category?.id;
          if (String(catId) !== String(selectedFloorFilter)) return false;
        }
      }

      if (selectedStatusFilter !== 'all') {
        const isOccupied = !!table.matchedSale;
        if (selectedStatusFilter === 'vacant' && isOccupied) return false;
        if (selectedStatusFilter === 'occupied' && !isOccupied) return false;
      }

      return true;
    });
  }, [mappedTables, searchQuery, selectedFloorFilter, selectedStatusFilter]);

  // Counters
  const counters = useMemo(() => {
    const total = tables.length;
    const occupied = mappedTables.filter((t) => t.matchedSale).length;
    const vacant = total - occupied;
    const totalOpenAmount = unpaidSales.reduce(
      (sum, s) => sum + Number(s.dueAmount ?? s.grandTotal ?? 0),
      0
    );
    return { total, occupied, vacant, totalOpenAmount };
  }, [tables, mappedTables, unpaidSales]);

  // Billing Modal states
  const [selectedTable, setSelectedTable] = useState<any>(null);
  const [loadingSaleDetails, setLoadingSaleDetails] = useState(false);
  const [saleDetails, setSaleDetails] = useState<Sale | null>(null);

  // Form states inside billing sheet
  const [discount, setDiscount] = useState('0');
  const [taxRate, setTaxRate] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank'>('cash');
  const [bankId, setBankId] = useState('');
  const [amountReceived, setAmountReceived] = useState('0');
  const [paymentNote, setPaymentNote] = useState('');
  const [submittingCheckout, setSubmittingCheckout] = useState(false);
  const [releasingTable, setReleasingTable] = useState(false);

  // Success Sheet
  const [successVisible, setSuccessVisible] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const activeTableSaleId = selectedTable?.matchedSale?.id;

  const handleTableTap = async (table: any) => {
    if (!table.matchedSale) {
      Alert.alert('Vacant Table', `${table.name} is currently vacant. There are no unpaid bills.`);
      return;
    }

    setSelectedTable(table);
    setLoadingSaleDetails(true);
    setDiscount('0');
    setTaxRate('0');
    setPaymentMethod('cash');
    setBankId('');
    setAmountReceived('0');
    setPaymentNote('');

    try {
      const fullSale = await salesApi.get(table.matchedSale.id);
      setSaleDetails(fullSale);
      setDiscount(String(fullSale.discount || 0));
      setTaxRate(String(fullSale.items?.[0]?.taxRate || 0));
      setAmountReceived(String(fullSale.grandTotal || 0));
    } catch (err) {
      Alert.alert('Error', 'Unable to fetch billing details.');
      setSelectedTable(null);
    } finally {
      setLoadingSaleDetails(false);
    }
  };

  // Derived Totals during edit
  const localTotals = useMemo(() => {
    if (!saleDetails) return { subTotal: 0, taxTotal: 0, grandTotal: 0 };
    const items = saleDetails.items || [];
    const discNum = Number(discount) || 0;
    const taxRateNum = Number(taxRate) || 0;

    const subTotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    const discTotal = discNum;
    const taxableAmount = Math.max(subTotal - discTotal, 0);
    const taxTotal = (taxableAmount * taxRateNum) / 100;
    const grandTotal = taxableAmount + taxTotal;

    return {
      subTotal,
      taxTotal,
      grandTotal,
    };
  }, [saleDetails, discount, taxRate]);

  // Cash Selection Pad choices
  const cashPadAmounts = useMemo(() => {
    const total = localTotals.grandTotal;
    if (total <= 0) return [];
    const choices = [50, 100, 500, 1000];
    const rounded = choices.map((opt) => Math.ceil(total / opt) * opt);
    const unique = Array.from(new Set([total, ...rounded]))
      .filter((v) => v >= total)
      .sort((a, b) => a - b);
    return unique.slice(0, 5);
  }, [localTotals.grandTotal]);

  const handleReleaseTable = async () => {
    if (!selectedTable) return;
    Alert.alert(
      'Release Table',
      `Are you sure you want to release "${selectedTable.name}" and mark it vacant? This does not delete any draft order.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Release',
          style: 'destructive',
          onPress: async () => {
            setReleasingTable(true);
            try {
              await tablesApi.update(selectedTable.id, { status: 'vacant' });
              await queryClient.invalidateQueries({ queryKey: ['tables-list'] });
              await queryClient.invalidateQueries({ queryKey: ['sales-list'] });
              Alert.alert('Success', 'Table released successfully.');
              setSelectedTable(null);
            } catch (error) {
              Alert.alert('Error', 'Failed to release table.');
            } finally {
              setReleasingTable(false);
            }
          },
        },
      ]
    );
  };

  const handleCheckout = async () => {
    if (!saleDetails || !selectedTable) return;

    const receivedAmt = Number(amountReceived || 0);
    const finalTotal = localTotals.grandTotal;

    if (paymentMethod === 'bank' && receivedAmt > 0 && !bankId) {
      Alert.alert('Required field', 'Please select a bank account.');
      return;
    }

    setSubmittingCheckout(true);
    try {
      const isPaid = receivedAmt >= finalTotal;
      const status = isPaid ? 'paid' : receivedAmt > 0 ? 'partial' : 'unpaid';

      const payload = {
        status,
        amountReceived: receivedAmt,
        paymentMethod: receivedAmt > 0 ? paymentMethod : 'cash',
        bankId: receivedAmt > 0 && paymentMethod === 'bank' ? bankId : undefined,
        paymentNote: paymentNote.trim() || undefined,
        subTotal: localTotals.subTotal,
        taxTotal: localTotals.taxTotal,
        discount: Number(discount) || 0,
        discountTotal: Number(discount) || 0,
        grandTotal: finalTotal,
        items: (saleDetails.items || []).map((item) => ({
          id: item.id,
          productId: item.productId,
          quantity: item.quantity,
          unitType: item.unitType || 'primary',
          conversionRate: item.conversionRate || 0,
          unitPrice: item.unitPrice,
          taxRate: item.taxRate || 0,
          lineTotal: item.quantity * item.unitPrice,
        })),
      };

      // PATCH sale
      await salesApi.update(saleDetails.id, payload);

      // PATCH table if fully paid
      if (isPaid) {
        await tablesApi.update(selectedTable.id, { status: 'vacant' });
      }

      // Build printable receipt HTML
      const receiptHtml = buildReceiptHtml({
        heading: 'Cashier Receipt',
        reference: saleDetails.invoiceNo,
        date: new Date().toISOString().split('T')[0],
        subtitle: `Table: ${selectedTable.name}`,
        lines: (saleDetails.items || []).map((item) => ({
          name: String(item.name || 'Menu Item'),
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineTotal: item.quantity * item.unitPrice,
        })),
        subTotal: localTotals.subTotal,
        taxTotal: localTotals.taxTotal,
        discountTotal: Number(discount) || 0,
        grandTotal: finalTotal,
        amountReceived: receivedAmt,
      });

      setReceipt({
        title: saleDetails.invoiceNo,
        subtitle: `Table: ${selectedTable.name}`,
        html: receiptHtml,
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tables-list'] }),
        queryClient.invalidateQueries({ queryKey: ['sales-list'] }),
        queryClient.invalidateQueries({ queryKey: ['recent-sales'] }),
      ]);

      setSuccessMessage(
        isPaid
          ? `Bill processed in full. Table ${selectedTable.name} has been released.`
          : `Partial checkout saved. Table ${selectedTable.name} remains occupied.`
      );
      setSelectedTable(null);
      setSuccessVisible(true);
    } catch (error) {
      Alert.alert('Checkout Failed', error instanceof Error ? error.message : 'Save billing failed.');
    } finally {
      setSubmittingCheckout(false);
    }
  };

  return (
    <Screen topBarTitle="Cashier Billing" topBarLeading="back">
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <PageHeading
          title="Billing Counter"
          subtitle="Quick cashier checkout and payment collection on occupied tables."
        />

        {/* Counter Summary Cards */}
        <SurfaceCard>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{counters.total}</Text>
              <Text style={styles.summaryLabel}>Total Tables</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={[styles.summaryValue, { color: '#10b981' }]}>{counters.vacant}</Text>
              <Text style={styles.summaryLabel}>Vacant</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={[styles.summaryValue, { color: '#f59e0b' }]}>{counters.occupied}</Text>
              <Text style={styles.summaryLabel}>Occupied</Text>
            </View>
            <View style={[styles.summaryCard, { flexBasis: '100%' }]}>
              <Text style={[styles.summaryValue, { color: palette.primary }]}>
                {formatCurrency(counters.totalOpenAmount)}
              </Text>
              <Text style={styles.summaryLabel}>Total Open Bills</Text>
            </View>
          </View>
        </SurfaceCard>

        {/* Search & Filters */}
        <SurfaceCard style={{ marginBottom: spacing.xs }}>
          <SearchField
            placeholder="Search occupied/vacant tables by name..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <View style={{ gap: spacing.xs, marginTop: spacing.sm }}>
            {/* Floor Filter Chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
              <Pressable
                style={[styles.filterChip, selectedFloorFilter === 'all' && styles.filterChipActive]}
                onPress={() => setSelectedFloorFilter('all')}
              >
                <Text style={[styles.filterChipLabel, selectedFloorFilter === 'all' && styles.filterChipLabelActive]}>
                  All Floors
                </Text>
              </Pressable>
              {floors.map((floor) => (
                <Pressable
                  key={floor.id}
                  style={[styles.filterChip, selectedFloorFilter === floor.id && styles.filterChipActive]}
                  onPress={() => setSelectedFloorFilter(floor.id)}
                >
                  <Text style={[styles.filterChipLabel, selectedFloorFilter === floor.id && styles.filterChipLabelActive]}>
                    {floor.name}
                  </Text>
                </Pressable>
              ))}
              <Pressable
                style={[styles.filterChip, selectedFloorFilter === 'unassigned' && styles.filterChipActive]}
                onPress={() => setSelectedFloorFilter('unassigned')}
              >
                <Text style={[styles.filterChipLabel, selectedFloorFilter === 'unassigned' && styles.filterChipLabelActive]}>
                  Unassigned
                </Text>
              </Pressable>
            </ScrollView>

            {/* Status Filter Chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
              <Pressable
                style={[styles.filterChip, selectedStatusFilter === 'all' && styles.filterChipActive]}
                onPress={() => setSelectedStatusFilter('all')}
              >
                <Text style={[styles.filterChipLabel, selectedStatusFilter === 'all' && styles.filterChipLabelActive]}>
                  All Statuses
                </Text>
              </Pressable>
              <Pressable
                style={[styles.filterChip, selectedStatusFilter === 'vacant' && styles.filterChipActive]}
                onPress={() => setSelectedStatusFilter('vacant')}
              >
                <Text style={[styles.filterChipLabel, selectedStatusFilter === 'vacant' && styles.filterChipLabelActive]}>
                  Vacant
                </Text>
              </Pressable>
              <Pressable
                style={[styles.filterChip, selectedStatusFilter === 'occupied' && styles.filterChipActive]}
                onPress={() => setSelectedStatusFilter('occupied')}
              >
                <Text style={[styles.filterChipLabel, selectedStatusFilter === 'occupied' && styles.filterChipLabelActive]}>
                  Occupied
                </Text>
              </Pressable>
            </ScrollView>
          </View>
        </SurfaceCard>

        {/* Tables Grid Layout */}
        <SurfaceCard title="Seating Maps" subtitle="Tap occupied table to open detailed billing card.">
          {loadingTables || loadingSales ? (
            <ActivityIndicator color={palette.primary} size="large" style={styles.loader} />
          ) : (
            <View style={styles.tablesGrid}>
              {filteredTables.map((table) => {
                const isOccupied = !!table.matchedSale;
                const grandTotal = table.matchedSale ? Number(table.matchedSale.grandTotal) : 0;
                const matchedFloor = floors.find((f) => f.id === table.categoryId);
                const floorName = table.category?.name || matchedFloor?.name || 'No Floor';

                return (
                  <Pressable
                    key={table.id}
                    style={[
                      styles.tableBtnCard,
                      isOccupied ? styles.tableBtnOccupied : styles.tableBtnVacant,
                    ]}
                    onPress={() => void handleTableTap(table)}
                  >
                    <View style={styles.tableCardHeader}>
                      <Text numberOfLines={1} ellipsizeMode="tail" style={styles.tableCardTitle}>{table.name}</Text>
                      <View
                        style={[
                          styles.tableStatusDot,
                          { backgroundColor: isOccupied ? '#f59e0b' : '#10b981' },
                        ]}
                      />
                    </View>

                    <Text numberOfLines={1} ellipsizeMode="tail" style={styles.tableCardFloorText}>
                      Floor: {floorName}
                    </Text>

                    {isOccupied ? (
                      <View style={styles.tableCardInfo}>
                        <Text style={styles.tableBillDueLabel}>Amount Due:</Text>
                        <Text style={styles.tableBillDueVal}>{formatCurrency(grandTotal)}</Text>
                      </View>
                    ) : (
                      <Text style={styles.tableVacantInfo}>Vacant</Text>
                    )}
                  </Pressable>
                );
              })}
              {filteredTables.length === 0 ? (
                <View style={styles.empty}>
                  <MaterialCommunityIcons color={palette.textSoft} name="table-large-remove" size={36} />
                  <Text style={styles.emptyText}>No matching tables found.</Text>
                </View>
              ) : null}
            </View>
          )}
        </SurfaceCard>
      </ScrollView>

      {/* Payment Checkout Sheet */}
      <BottomSheet
        visible={Boolean(selectedTable)}
        title={selectedTable?.name || 'Seating Bill'}
        subtitle="Review order items, calculate tax/discount, and process checkout."
        onClose={() => setSelectedTable(null)}
        fullHeight
        footer={
          <View style={styles.sheetFooter}>
            <Pressable
              style={styles.releaseTableBtn}
              onPress={() => void handleReleaseTable()}
              disabled={releasingTable}
            >
              {releasingTable ? (
                <ActivityIndicator color={palette.danger} />
              ) : (
                <Text style={styles.releaseTableBtnText}>Release Table</Text>
              )}
            </Pressable>
            <Pressable
              style={styles.checkoutSubmitBtn}
              onPress={() => void handleCheckout()}
              disabled={submittingCheckout || loadingSaleDetails}
            >
              {submittingCheckout ? (
                <ActivityIndicator color={palette.white} />
              ) : (
                <Text style={styles.checkoutSubmitBtnText}>Process Checkout</Text>
              )}
            </Pressable>
          </View>
        }
      >
        {loadingSaleDetails ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={palette.primary} size="large" />
            <Text style={styles.loadingText}>Fetching order details...</Text>
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.sheetContent}
          >
            {/* Items Summary Card */}
            <SurfaceCard title="Order Items" subtitle="Line summary from the active draft order.">
              <View style={styles.itemsList}>
                {(saleDetails?.items || []).map((item, idx) => (
                  <View key={idx} style={styles.itemRow}>
                    <View style={styles.itemMeta}>
                      <Text style={styles.itemTitle}>{String(item.name || 'Menu Item')}</Text>
                      <Text style={styles.itemSubtitle}>
                        {item.quantity} x {formatCurrency(item.unitPrice)}
                      </Text>
                    </View>
                    <Text style={styles.itemTotalVal}>
                      {formatCurrency(item.quantity * item.unitPrice)}
                    </Text>
                  </View>
                ))}
              </View>
            </SurfaceCard>

            {/* Calculations Form */}
            <SurfaceCard title="Adjustments & Checkout" subtitle="Tax rates, discount deductions, and cash received amount.">
              <View style={styles.formRow}>
                <View style={{ flex: 1 }}>
                  <FormField
                    label="Discount Deducted (रू)"
                    value={discount}
                    keyboardType="numeric"
                    onChangeText={setDiscount}
                  />
                </View>
                <View style={{ width: spacing.md }} />
                <View style={{ flex: 1 }}>
                  <FormField
                    label="Tax Rate (%)"
                    value={taxRate}
                    keyboardType="numeric"
                    onChangeText={setTaxRate}
                  />
                </View>
              </View>

              {/* Totals Summary */}
              <TotalsCard
                subTotal={localTotals.subTotal}
                taxTotal={localTotals.taxTotal}
                discountTotal={Number(discount) || 0}
                grandTotal={localTotals.grandTotal}
                amountReceived={Number(amountReceived || 0)}
              />

              {/* Cash selections pad */}
              <Text style={styles.formFieldLabel}>Quick Cash Pad</Text>
              <View style={styles.cashPadRow}>
                {cashPadAmounts.map((amt) => (
                  <Pressable
                    key={amt}
                    style={styles.cashChip}
                    onPress={() => setAmountReceived(String(amt))}
                  >
                    <Text style={styles.cashChipText}>
                      {amt === localTotals.grandTotal ? 'Exact' : `रू ${amt}`}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <FormField
                label="Cash Received (रू) *"
                value={amountReceived}
                keyboardType="numeric"
                onChangeText={setAmountReceived}
              />

              <PaymentMethodSelector value={paymentMethod} onChange={setPaymentMethod} />

              {paymentMethod === 'bank' ? (
                <View style={styles.bankSelectWrap}>
                  <Text style={styles.formFieldLabel}>Select Bank Account</Text>
                  <View style={styles.banksGrid}>
                    {activeBanks.map((bank) => {
                      const active = bankId === bank.id;
                      return (
                        <Pressable
                          key={bank.id}
                          style={[styles.bankChipBtn, active && styles.bankChipBtnActive]}
                          onPress={() => setBankId(bank.id)}
                        >
                          <Text style={[styles.bankChipBtnLabel, active && styles.bankChipBtnLabelActive]}>
                            {bank.name}
                          </Text>
                        </Pressable>
                      );
                    })}
                    {activeBanks.length === 0 ? (
                      <Text style={styles.emptyBanksHelp}>No active bank accounts found.</Text>
                    ) : null}
                  </View>
                </View>
              ) : null}

              <FormField
                label="Payment Notes"
                value={paymentNote}
                placeholder="e.g. Received via Cash / QR code"
                onChangeText={setPaymentNote}
                multiline
              />
            </SurfaceCard>
          </ScrollView>
        )}
      </BottomSheet>

      {/* Checkout Success Sheet */}
      <SuccessSheet
        visible={successVisible}
        title="Checkout Completed"
        message={successMessage}
        actions={[
          {
            label: 'Open Print Preview',
            primary: true,
            onPress: () => {
              setSuccessVisible(false);
              router.push('/(app)/print-preview');
            },
          },
          {
            label: 'Done',
            onPress: () => setSuccessVisible(false),
          },
        ]}
        onClose={() => setSuccessVisible(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  loader: {
    paddingVertical: spacing.xl,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  summaryCard: {
    flexBasis: '30%',
    flexGrow: 1,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: palette.backgroundWarm,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: typography.heading,
    fontWeight: '800',
    color: palette.text,
    marginBottom: 2,
  },
  summaryLabel: {
    fontSize: typography.caption,
    fontWeight: '600',
    color: palette.textMuted,
  },
  tablesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  tableBtnCard: {
    flexBasis: '47%',
    flexGrow: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    minHeight: 125, // expanded to avoid text cutoff
    justifyContent: 'space-between',
  },
  tableCardFloorText: {
    fontSize: 12,
    color: palette.textMuted,
    marginTop: 2,
    marginBottom: 4,
  },
  chipsScroll: {
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    minHeight: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterChipActive: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  filterChipLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.textSoft,
  },
  filterChipLabelActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  tableBtnVacant: {
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    borderStyle: 'dashed',
  },
  tableBtnOccupied: {
    borderColor: palette.accentMuted || '#eeddc8',
    backgroundColor: '#fffbeb',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  tableCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tableCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: palette.text,
  },
  tableStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  tableCardInfo: {
    marginTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: spacing.xs,
  },
  tableBillDueLabel: {
    fontSize: 11,
    color: palette.textMuted,
  },
  tableBillDueVal: {
    fontSize: 14,
    fontWeight: '800',
    color: palette.primary,
  },
  tableVacantInfo: {
    fontSize: 12,
    color: palette.textMuted,
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  emptyText: {
    fontSize: typography.body,
    color: palette.textMuted,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.md,
  },
  loadingText: {
    fontSize: typography.body,
    color: palette.textSoft,
  },
  sheetContent: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  sheetFooter: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  releaseTableBtn: {
    flex: 1,
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: palette.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.danger,
  },
  releaseTableBtnText: {
    color: palette.danger,
    fontSize: typography.body,
    fontWeight: '800',
  },
  checkoutSubmitBtn: {
    flex: 1.2,
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkoutSubmitBtnText: {
    color: palette.white,
    fontSize: typography.body,
    fontWeight: '800',
  },
  itemsList: {
    gap: spacing.sm,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  itemMeta: {
    flex: 1,
    gap: 2,
  },
  itemTitle: {
    fontSize: typography.body,
    fontWeight: '700',
    color: palette.text,
  },
  itemSubtitle: {
    fontSize: typography.caption,
    color: palette.textMuted,
  },
  itemTotalVal: {
    fontSize: typography.body,
    fontWeight: '800',
    color: palette.text,
  },
  formRow: {
    flexDirection: 'row',
  },
  formFieldLabel: {
    fontSize: typography.label,
    fontWeight: '800',
    color: palette.textSoft,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.xs,
    marginBottom: spacing.xxs,
  },
  cashPadRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  cashChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: palette.backgroundWarm,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.pill,
  },
  cashChipText: {
    fontSize: typography.caption,
    fontWeight: '700',
    color: palette.text,
  },
  bankSelectWrap: {
    marginVertical: spacing.xs,
  },
  banksGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  bankChipBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: palette.backgroundWarm,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.pill,
  },
  bankChipBtnActive: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  bankChipBtnLabel: {
    fontSize: typography.caption,
    fontWeight: '700',
    color: palette.text,
  },
  bankChipBtnLabelActive: {
    color: palette.white,
  },
  emptyBanksHelp: {
    fontSize: typography.caption,
    color: palette.textMuted,
    fontStyle: 'italic',
  },
});
