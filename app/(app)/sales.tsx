import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { salesApi } from '@/src/api';
import { BottomSheet } from '@/src/shared/feedback/BottomSheet';
import { FormField } from '@/src/shared/forms/FormField';
import { PaymentMethodSelector } from '@/src/shared/forms/PaymentMethodSelector';
import { Screen } from '@/src/shared/layout/Screen';
import { SearchField } from '@/src/shared/ui/SearchField';
import { SegmentedTabs } from '@/src/shared/ui/SegmentedTabs';
import { SurfaceCard } from '@/src/shared/ui/SurfaceCard';
import { StickyActionBar } from '@/src/shared/ui/StickyActionBar';
import { formatCurrency, prettyDate } from '@/src/shared/lib/format';
import { partyInitials } from '@/src/features/parties/lib/party';
import { buildReceiptHtml } from '@/src/shared/lib/receipt';
import { shareHtmlAsPdf } from '@/src/shared/lib/report-pdf';
import { useBanks, useParties, useSalesList } from '@/src/shared/hooks/useAppQueries';
import { useDebouncedValue } from '@/src/shared/hooks/useDebouncedValue';
import { radius, shadows, spacing, typography } from '@/src/theme';
import type { Party, Sale } from '@/src/types/models';
import { useAuthStore } from '@/src/stores/auth-store';
import { useReceiptStore } from '@/src/stores/receipt-store';
import { usePalette } from '@/src/stores/theme-store';
import { useThemedStyles } from '@/src/theme/use-themed-styles';
import type { AppPalette } from '@/src/theme/app-palette';

type SaleFilter = 'all' | 'paid' | 'due' | 'cancelled';
type StatusTone = 'info' | 'warning' | 'success' | 'danger' | 'muted';

function dueAmount(total: number, paid: number) {
  return Math.max(0, Number(total || 0) - Number(paid || 0));
}

function isPaid(item: Sale) {
  return dueAmount(item.grandTotal, item.amountReceived) < 0.5;
}

function isPartial(item: Sale) {
  const due = dueAmount(item.grandTotal, item.amountReceived);
  return due > 0.5 && Number(item.amountReceived || 0) > 0;
}

function getSaleDisplay(item: Sale) {
  if (item.status === 'cancelled' || item.status === 'void') {
    return { label: 'Cancelled', tone: 'muted' as StatusTone, icon: 'close-circle-outline' as const };
  }
  if (isPaid(item)) {
    return { label: 'Paid', tone: 'success' as StatusTone, icon: 'check-circle-outline' as const };
  }
  if (isPartial(item)) {
    return { label: 'Partial', tone: 'warning' as StatusTone, icon: 'clock-outline' as const };
  }
  return { label: 'Credit / Due', tone: 'danger' as StatusTone, icon: 'alert-circle-outline' as const };
}

function getToneColors(tone: StatusTone, colors: AppPalette) {
  if (tone === 'danger') return { bg: colors.dangerSoft, text: colors.danger, border: colors.danger };
  if (tone === 'success') return { bg: colors.successSoft, text: colors.success, border: colors.success };
  if (tone === 'warning') return { bg: colors.warningSoft, text: colors.warning, border: colors.warning };
  if (tone === 'info') return { bg: colors.accentSoft, text: colors.accent, border: colors.accent };
  return { bg: colors.backgroundAlt, text: colors.textMuted, border: colors.border };
}

function resolveSaleCustomer(item: Sale, partyMap?: Map<string, Party>) {
  const directParty = (item as any).party || (item as any).Party || (item as any).customer;
  const directName = (item as any).partyName || directParty?.name || (item as any).customerName;
  const directPhone = directParty?.phone || (item as any).customerPhone || (item as any).phone;

  if (item.partyId && partyMap?.has(item.partyId)) {
    const matched = partyMap.get(item.partyId)!;
    return {
      name: directName || matched.name || 'Customer',
      phone: directPhone || matched.phone || '',
      address: matched.address || '',
      party: matched,
    };
  }

  return {
    name: directName || 'Walk-in Customer',
    phone: directPhone || '',
    address: directParty?.address || '',
    party: directParty,
  };
}

export default function DetailedSalesScreen() {
  const colors = usePalette();
  const styles = useThemedStyles(createStyles);
  const queryClient = useQueryClient();
  const currency = useAuthStore((state) => state.businessProfile?.currencyCode) || 'NPR';
  const setReceipt = useReceiptStore((state) => state.setReceipt);

  const [filter, setFilter] = useState<SaleFilter>('all');
  const [search, setSearch] = useState('');
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [amountReceivedDraft, setAmountReceivedDraft] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank'>('cash');
  const [bankId, setBankId] = useState('');
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState(false);

  const salesQuery = useSalesList({ limit: 150 });
  const partiesQuery = useParties('', 'both');
  const { data: banks } = useBanks();
  const activeBanks = useMemo(() => (banks ?? []).filter((bank) => bank.isActive), [banks]);

  const partyMap = useMemo(() => {
    return new Map((partiesQuery.data ?? []).map((p) => [p.id, p]));
  }, [partiesQuery.data]);

  const debouncedSearch = useDebouncedValue(search);
  const sales = salesQuery.data ?? [];

  const counts = useMemo(() => {
    let paidCount = 0;
    let dueCount = 0;
    let totalSales = 0;
    let totalDue = 0;

    for (const item of sales) {
      if (item.status === 'cancelled' || item.status === 'void') continue;
      const due = dueAmount(item.grandTotal, item.amountReceived);
      totalSales += Number(item.grandTotal || 0);
      totalDue += due;

      if (isPaid(item)) {
        paidCount += 1;
      } else {
        dueCount += 1;
      }
    }

    return {
      all: sales.length,
      paid: paidCount,
      due: dueCount,
      totalSales,
      totalDue,
    };
  }, [sales]);

  const visibleSales = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    return sales.filter((item) => {
      if (filter === 'paid' && !isPaid(item)) return false;
      if (filter === 'due' && (isPaid(item) || item.status === 'cancelled')) return false;
      if (filter === 'cancelled' && item.status !== 'cancelled' && item.status !== 'void') return false;
      if (!query) return true;

      const customer = resolveSaleCustomer(item, partyMap);
      const searchTargets = [
        item.invoiceNo,
        customer.name,
        customer.phone,
        item.status,
        item.notes,
      ]
        .filter(Boolean)
        .map((val) => String(val).toLowerCase());

      return searchTargets.some((target) => target.includes(query));
    });
  }, [debouncedSearch, filter, partyMap, sales]);

  function openSale(sale: Sale) {
    setSelectedSale(sale);
    setAmountReceivedDraft(String(sale.amountReceived ?? 0));
    setPaymentMethod((sale.paymentMethod as 'cash' | 'bank') ?? 'cash');
    setBankId(sale.bankId ?? '');
  }

  async function saveSalePayment() {
    if (!selectedSale) return;
    setSaving(true);
    try {
      await salesApi.update(selectedSale.id, {
        amountReceived: Number(amountReceivedDraft || 0),
        paymentMethod,
        bankId: paymentMethod === 'bank' ? bankId || undefined : undefined,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['sales-list'] }),
        queryClient.invalidateQueries({ queryKey: ['recent-sales'] }),
      ]);
      setSelectedSale(null);
    } catch (error) {
      Alert.alert('Unable to update payment', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function handlePrintReceipt(sale: Sale) {
    const customer = resolveSaleCustomer(sale, partyMap);
    const receiptData = {
      heading: 'Tax Invoice / Bill',
      reference: sale.invoiceNo,
      date: sale.saleDate,
      subtitle: customer.name,
      lines: (sale.items ?? []).map((item) => ({
        name: (item as any).product?.name || item.productId || 'Item',
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
      })),
      subTotal: sale.subTotal,
      taxTotal: sale.taxTotal,
      discountTotal: sale.discountTotal ?? sale.discount ?? 0,
      grandTotal: sale.grandTotal,
      amountReceived: sale.amountReceived,
    };
    const html = buildReceiptHtml(receiptData);

    setReceipt({
      title: sale.invoiceNo,
      subtitle: customer.name,
      html,
      data: receiptData,
    });
    router.push('/(app)/print-preview');
  }

  async function handleShareReceiptPdf(sale: Sale) {
    try {
      setSharing(true);
      const customer = resolveSaleCustomer(sale, partyMap);
      const html = buildReceiptHtml({
        heading: 'Sales Invoice',
        reference: sale.invoiceNo,
        date: sale.saleDate,
        subtitle: customer.name,
        lines: (sale.items ?? []).map((item) => ({
          name: (item as any).product?.name || item.productId || 'Item',
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineTotal: item.lineTotal,
        })),
        subTotal: sale.subTotal,
        taxTotal: sale.taxTotal,
        discountTotal: sale.discountTotal ?? sale.discount ?? 0,
        grandTotal: sale.grandTotal,
        amountReceived: sale.amountReceived,
      });

      await shareHtmlAsPdf(html, `Invoice-${sale.invoiceNo}`);
    } catch (error) {
      Alert.alert('Unable to export receipt', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSharing(false);
    }
  }

  const selectedCustomer = selectedSale ? resolveSaleCustomer(selectedSale, partyMap) : null;
  const selectedDisplay = selectedSale ? getSaleDisplay(selectedSale) : null;
  const selectedDue = selectedSale ? dueAmount(Number(selectedSale.grandTotal || 0), Number(selectedSale.amountReceived || 0)) : 0;

  return (
    <Screen
      scrollable={false}
      padded={false}
      topBarTitle="Sales & Invoices"
      footer={
        <StickyActionBar
          primary={{
            label: 'New POS Sale',
            onPress: () => router.push('/(app)/(tabs)/pos'),
          }}
        />
      }>
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets={true}
        refreshControl={
          <RefreshControl
            refreshing={salesQuery.isRefetching || partiesQuery.isRefetching}
            onRefresh={() => {
              void salesQuery.refetch();
              void partiesQuery.refetch();
            }}
          />
        }
        contentContainerStyle={styles.scroll}>
        
        {/* KPI Summary Dashboard Tiles */}
        <View style={styles.statsGrid}>
          <View style={[styles.statTile, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.statIconBox, { backgroundColor: colors.accentSoft }]}>
              <MaterialCommunityIcons name="cash-register" size={20} color={colors.accent} />
            </View>
            <Text style={[styles.statValue, { color: colors.text }]} numberOfLines={1}>
              {formatCurrency(counts.totalSales, currency)}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Total Sales</Text>
          </View>

          <View style={[styles.statTile, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.statIconBox, { backgroundColor: colors.successSoft }]}>
              <MaterialCommunityIcons name="check-circle-outline" size={20} color={colors.success} />
            </View>
            <Text style={[styles.statValue, { color: colors.success }]}>{counts.paid}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Paid Bills</Text>
          </View>

          <View style={[styles.statTile, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.statIconBox, { backgroundColor: colors.dangerSoft }]}>
              <MaterialCommunityIcons name="clock-alert-outline" size={20} color={colors.danger} />
            </View>
            <Text style={[styles.statValue, { color: colors.danger }]}>{counts.due}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Credit Sales</Text>
          </View>

          <View style={[styles.statTile, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.statIconBox, { backgroundColor: colors.warningSoft }]}>
              <MaterialCommunityIcons name="cash-multiple" size={20} color={colors.warning} />
            </View>
            <Text style={[styles.statValue, { color: colors.warning }]} numberOfLines={1}>
              {formatCurrency(counts.totalDue, currency)}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Pending Due</Text>
          </View>
        </View>

        {/* Live Search and Filters */}
        <SearchField
          placeholder="Search customer, phone, or invoice #"
          value={search}
          onChangeText={setSearch}
        />

        <SegmentedTabs
          value={filter}
          onChange={setFilter}
          options={[
            { label: `All (${counts.all})`, value: 'all' },
            { label: `Paid (${counts.paid})`, value: 'paid' },
            { label: `Credit (${counts.due})`, value: 'due' },
            { label: 'Cancelled', value: 'cancelled' },
          ]}
        />

        {/* Empty State */}
        {!salesQuery.isLoading && !visibleSales.length ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.accentSoft }]}>
              <MaterialCommunityIcons name="cash-register" size={32} color={colors.accent} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {sales.length ? 'No matching sales records' : 'No sales recorded yet'}
            </Text>
            <Text style={[styles.emptyCopy, { color: colors.textMuted }]}>
              {sales.length
                ? 'Try a different search term or filter.'
                : 'Create sales quickly from the Quick POS register.'}
            </Text>
            <Pressable
              style={[styles.emptyActionBtn, { backgroundColor: colors.primary }]}
              onPress={() => router.push('/(app)/(tabs)/pos')}>
              <Text style={styles.emptyActionBtnText}>Open Quick POS</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Sales List */}
        <View style={styles.list}>
          {visibleSales.map((item) => {
            const customer = resolveSaleCustomer(item, partyMap);
            const display = getSaleDisplay(item);
            const tone = getToneColors(display.tone, colors);
            const due = dueAmount(item.grandTotal, item.amountReceived);

            return (
              <Pressable
                key={item.id}
                onPress={() => openSale(item)}
                style={({ pressed }) => [
                  styles.card,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                  pressed && styles.cardPressed,
                ]}>
                
                {/* Header Row: Customer Info + Status Pill */}
                <View style={styles.cardHeader}>
                  <View style={styles.customerWrap}>
                    <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                      <Text style={[styles.avatarText, { color: colors.white }]}>
                        {partyInitials(customer.name)}
                      </Text>
                    </View>
                    <View style={styles.customerCopy}>
                      <View style={styles.customerNameRow}>
                        <Text style={[styles.customerName, { color: colors.text }]} numberOfLines={1}>
                          {customer.name}
                        </Text>
                        {item.invoiceNo ? (
                          <View style={[styles.orderNoPill, { backgroundColor: colors.backgroundAlt }]}>
                            <Text style={[styles.orderNoText, { color: colors.textMuted }]}>
                              #{item.invoiceNo}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      {customer.phone ? (
                        <Text style={[styles.customerPhone, { color: colors.textMuted }]}>
                          {customer.phone}
                        </Text>
                      ) : (
                        <Text style={[styles.customerPhone, { color: colors.textSoft }]}>
                          Walk-in
                        </Text>
                      )}
                    </View>
                  </View>

                  <View style={[styles.statusBadge, { backgroundColor: tone.bg }]}>
                    <MaterialCommunityIcons name={display.icon} size={12} color={tone.text} />
                    <Text style={[styles.statusBadgeText, { color: tone.text }]}>
                      {display.label}
                    </Text>
                  </View>
                </View>

                {/* Timeline and Line Items Meta */}
                <View style={styles.metaRow}>
                  <View style={styles.metaItem}>
                    <MaterialCommunityIcons name="calendar-month" size={14} color={colors.textMuted} />
                    <Text style={[styles.metaText, { color: colors.textMuted }]}>
                      {prettyDate(item.saleDate)}
                    </Text>
                  </View>
                  {item.items?.length ? (
                    <View style={styles.metaItem}>
                      <MaterialCommunityIcons name="format-list-bulleted" size={14} color={colors.textMuted} />
                      <Text style={[styles.metaText, { color: colors.textMuted }]}>
                        {item.items.length} {item.items.length === 1 ? 'item' : 'items'}
                      </Text>
                    </View>
                  ) : null}
                  <View style={styles.metaItem}>
                    <MaterialCommunityIcons name="credit-card-outline" size={14} color={colors.textMuted} />
                    <Text style={[styles.metaText, { color: colors.textMuted, textTransform: 'capitalize' }]}>
                      {item.paymentMethod || 'cash'}
                    </Text>
                  </View>
                </View>

                {/* Financial Strip & Action Row */}
                <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
                  <View style={styles.financialCol}>
                    <View style={styles.financialNumbersRow}>
                      <Text style={[styles.grandTotalLabel, { color: colors.textMuted }]}>
                        Total: <Text style={{ color: colors.text, fontWeight: '700' }}>{formatCurrency(item.grandTotal, currency)}</Text>
                      </Text>
                      <Text style={[styles.grandTotalLabel, { color: colors.textMuted }]}>
                        Paid: <Text style={{ color: colors.success, fontWeight: '700' }}>{formatCurrency(item.amountReceived || 0, currency)}</Text>
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.dueAmount,
                        { color: due > 0 ? colors.danger : colors.success },
                      ]}>
                      {due > 0 ? `Due: ${formatCurrency(due, currency)}` : 'Fully Paid'}
                    </Text>
                  </View>

                  {/* Quick Action Buttons */}
                  <View style={styles.quickActions}>
                    <Pressable
                      style={[styles.quickActionBtn, { backgroundColor: colors.accentSoft }]}
                      onPress={() => handlePrintReceipt(item)}>
                      <MaterialCommunityIcons name="printer-outline" size={14} color={colors.accent} />
                      <Text style={[styles.quickActionText, { color: colors.accent }]}>Receipt</Text>
                    </Pressable>

                    {customer.phone ? (
                      <Pressable
                        style={[styles.callBtn, { backgroundColor: colors.backgroundAlt }]}
                        onPress={() => void Linking.openURL(`tel:${customer.phone}`)}>
                        <MaterialCommunityIcons name="phone-outline" size={16} color={colors.primary} />
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {/* Sale Detail and Settlement Sheet */}
      <BottomSheet
        visible={Boolean(selectedSale)}
        title={selectedCustomer?.name || selectedSale?.invoiceNo || 'Sale Details'}
        subtitle={
          selectedSale
            ? `Invoice #${selectedSale.invoiceNo || 'N/A'} · ${selectedDisplay?.label ?? ''}`
            : 'Sale update'
        }
        onClose={() => setSelectedSale(null)}
        fullHeight
        footer={
          <View style={styles.footerActions}>
            <Pressable
              style={[styles.secondaryButton, { backgroundColor: colors.backgroundAlt }]}
              onPress={() => selectedSale && void handleShareReceiptPdf(selectedSale)}>
              {sharing ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Text style={[styles.secondaryLabel, { color: colors.text }]}>Share PDF</Text>
              )}
            </Pressable>
            <Pressable
              disabled={saving}
              style={[styles.primaryButton, { backgroundColor: colors.primary }]}
              onPress={() => void saveSalePayment()}>
              {saving ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.primaryLabel}>Save Settlement</Text>
              )}
            </Pressable>
          </View>
        }>
        {selectedSale ? (
          <View style={styles.sheetContent}>
            
            {/* Customer Contact Card */}
            <SurfaceCard title="Customer Information">
              <View style={styles.customerDetailRow}>
                <View style={[styles.avatarLarge, { backgroundColor: colors.primary }]}>
                  <Text style={[styles.avatarLargeText, { color: colors.white }]}>
                    {partyInitials(selectedCustomer?.name || 'Customer')}
                  </Text>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[styles.detailCustomerName, { color: colors.text }]}>
                    {selectedCustomer?.name}
                  </Text>
                  <Text style={[styles.helperText, { color: colors.textMuted }]}>
                    {selectedCustomer?.phone || 'Walk-in Customer'}
                  </Text>
                  {selectedCustomer?.address ? (
                    <Text style={[styles.helperText, { color: colors.textSoft }]}>
                      {selectedCustomer.address}
                    </Text>
                  ) : null}
                </View>
                {selectedCustomer?.phone ? (
                  <Pressable
                    style={[styles.callActionPill, { backgroundColor: colors.successSoft }]}
                    onPress={() => void Linking.openURL(`tel:${selectedCustomer.phone}`)}>
                    <MaterialCommunityIcons name="phone" size={18} color={colors.success} />
                    <Text style={[styles.callActionText, { color: colors.success }]}>Call</Text>
                  </Pressable>
                ) : null}
              </View>
            </SurfaceCard>

            {/* Payment & Balance Due */}
            <SurfaceCard
              title="Payment Settlement"
              subtitle={`Grand Total: ${formatCurrency(Number(selectedSale.grandTotal || 0), currency)} · Remaining Due: ${formatCurrency(selectedDue, currency)}`}>
              <FormField
                label="Amount Paid So Far (रू)"
                value={amountReceivedDraft}
                onChangeText={setAmountReceivedDraft}
                keyboardType="numeric"
              />
              <PaymentMethodSelector
                value={paymentMethod}
                onChange={setPaymentMethod}
                bankId={bankId}
                onBankChange={setBankId}
              />
            </SurfaceCard>

            {/* Itemized Lines */}
            <SurfaceCard title="Sold Items" subtitle={`${selectedSale.items?.length || 0} items on this invoice`}>
              <View style={styles.itemList}>
                {(selectedSale.items ?? []).map((item, index) => (
                  <View key={`${selectedSale.id}-${index}`} style={[styles.itemRow, { backgroundColor: colors.backgroundAlt }]}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={[styles.itemTitle, { color: colors.text }]}>
                        {(item as any).product?.name || item.productId || 'Item'}
                      </Text>
                      <Text style={[styles.itemMeta, { color: colors.textMuted }]}>
                        Qty: {item.quantity} {item.unitType || ''} @ {formatCurrency(item.unitPrice, currency)}
                      </Text>
                    </View>
                    <Text style={[styles.itemAmount, { color: colors.primary }]}>
                      {formatCurrency(item.lineTotal, currency)}
                    </Text>
                  </View>
                ))}
                {!selectedSale.items?.length ? (
                  <Text style={styles.helperText}>No line items recorded on this sale.</Text>
                ) : null}
              </View>
            </SurfaceCard>

            {/* Notes and Dates */}
            <SurfaceCard title="Invoice Meta">
              <View style={styles.timelineRow}>
                <Text style={[styles.helperText, { color: colors.textMuted }]}>
                  Date: <Text style={{ fontWeight: '700', color: colors.text }}>{prettyDate(selectedSale.saleDate)}</Text>
                </Text>
              </View>
              {selectedSale.notes ? (
                <Text style={[styles.notesText, { color: colors.text }]}>
                  {selectedSale.notes}
                </Text>
              ) : (
                <Text style={[styles.helperText, { color: colors.textSoft }]}>No notes provided.</Text>
              )}
            </SurfaceCard>
          </View>
        ) : null}
      </BottomSheet>
    </Screen>
  );
}

const createStyles = (colors: AppPalette) =>
  StyleSheet.create({
    scroll: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.xxxl,
      gap: spacing.md,
    },
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    statTile: {
      flex: 1,
      minWidth: '47%',
      borderRadius: radius.lg,
      borderWidth: 1,
      padding: spacing.md,
      gap: 4,
      ...shadows.card,
    },
    statIconBox: {
      width: 34,
      height: 34,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 2,
    },
    statValue: {
      fontSize: typography.heading,
      fontWeight: '800',
      letterSpacing: -0.4,
    },
    statLabel: {
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    list: {
      gap: spacing.md,
      marginTop: spacing.xs,
    },
    card: {
      borderRadius: radius.lg,
      borderWidth: 1,
      padding: spacing.md,
      gap: spacing.sm,
      ...shadows.card,
    },
    cardPressed: {
      opacity: 0.94,
      transform: [{ scale: 0.995 }],
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    customerWrap: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    avatar: {
      width: 42,
      height: 42,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      fontSize: 15,
      fontWeight: '800',
    },
    customerCopy: {
      flex: 1,
      gap: 2,
    },
    customerNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    customerName: {
      fontSize: typography.body,
      fontWeight: '800',
      flexShrink: 1,
    },
    orderNoPill: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: radius.pill,
    },
    orderNoText: {
      fontSize: 10,
      fontWeight: '700',
    },
    customerPhone: {
      fontSize: typography.caption,
      fontWeight: '500',
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: radius.pill,
    },
    statusBadgeText: {
      fontSize: 10,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.3,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: 2,
    },
    metaItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    metaText: {
      fontSize: typography.caption,
      fontWeight: '600',
    },
    cardFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderTopWidth: 1,
      paddingTop: spacing.sm,
      gap: spacing.sm,
    },
    financialCol: {
      flex: 1,
      gap: 2,
    },
    financialNumbersRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      flexWrap: 'wrap',
    },
    grandTotalLabel: {
      fontSize: typography.caption,
    },
    dueAmount: {
      fontSize: typography.body,
      fontWeight: '800',
    },
    quickActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    quickActionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: spacing.md,
      paddingVertical: 7,
      borderRadius: radius.pill,
    },
    quickActionText: {
      fontSize: 11,
      fontWeight: '800',
    },
    callBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyCard: {
      alignItems: 'center',
      borderRadius: radius.lg,
      borderWidth: 1,
      padding: spacing.xxl,
      gap: spacing.sm,
      marginVertical: spacing.lg,
    },
    emptyIcon: {
      width: 64,
      height: 64,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.xs,
    },
    emptyTitle: {
      fontSize: typography.subheading,
      fontWeight: '800',
    },
    emptyCopy: {
      fontSize: typography.body,
      textAlign: 'center',
      lineHeight: 22,
    },
    emptyActionBtn: {
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      marginTop: spacing.sm,
    },
    emptyActionBtnText: {
      color: colors.white,
      fontWeight: '800',
      fontSize: typography.body,
    },
    detailLoadingWrap: {
      paddingVertical: spacing.xxl,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sheetContent: {
      gap: spacing.md,
      paddingBottom: spacing.xxl,
    },
    customerDetailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    avatarLarge: {
      width: 52,
      height: 52,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarLargeText: {
      fontSize: 18,
      fontWeight: '800',
    },
    detailCustomerName: {
      fontSize: typography.subheading,
      fontWeight: '800',
    },
    callActionPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radius.pill,
    },
    callActionText: {
      fontSize: 12,
      fontWeight: '800',
    },
    formSection: {
      gap: spacing.xs,
    },
    formSectionTitle: {
      fontSize: typography.label,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    helperText: {
      fontSize: typography.caption,
      lineHeight: 18,
    },
    bankWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginTop: spacing.xs,
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
      fontSize: 12,
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
      fontSize: typography.caption,
      color: colors.textMuted,
      fontWeight: '500',
    },
    itemList: {
      gap: spacing.xs,
    },
    itemRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderRadius: radius.md,
      padding: spacing.sm,
      gap: spacing.md,
    },
    itemTitle: {
      fontSize: typography.body,
      fontWeight: '700',
    },
    itemMeta: {
      fontSize: typography.caption,
    },
    itemAmount: {
      fontSize: typography.body,
      fontWeight: '800',
    },
    timelineRow: {
      marginBottom: spacing.xs,
    },
    notesText: {
      fontSize: typography.body,
      lineHeight: 20,
    },
    footerActions: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    secondaryButton: {
      flex: 1,
      minHeight: 50,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondaryLabel: {
      fontSize: typography.body,
      fontWeight: '800',
    },
    primaryButton: {
      flex: 2,
      minHeight: 50,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryLabel: {
      color: colors.white,
      fontSize: typography.body,
      fontWeight: '800',
    },
  });
