import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
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

import { purchasesApi } from '@/src/api';
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
import { buildExpenseReportHtml, shareHtmlAsPdf } from '@/src/shared/lib/report-pdf';
import { useBanks, useParties, usePurchaseById, usePurchases } from '@/src/shared/hooks/useAppQueries';
import { useDebouncedValue } from '@/src/shared/hooks/useDebouncedValue';
import { radius, shadows, spacing, typography } from '@/src/theme';
import type { Party, Purchase } from '@/src/types/models';
import { useAuthStore } from '@/src/stores/auth-store';
import { usePalette } from '@/src/stores/theme-store';
import { useThemedStyles } from '@/src/theme/use-themed-styles';
import type { AppPalette } from '@/src/theme/app-palette';

type DueFilter = 'all' | 'due' | 'paid';
type StatusTone = 'info' | 'warning' | 'success' | 'danger' | 'muted';

function dueAmount(total: number, paid: number) {
  return Math.max(0, Number(total || 0) - Number(paid || 0));
}

function isPaid(item: Purchase) {
  return dueAmount(item.grandTotal, item.amountReceived) < 0.5;
}

function isPartial(item: Purchase) {
  const due = dueAmount(item.grandTotal, item.amountReceived);
  return due > 0.5 && Number(item.amountReceived || 0) > 0;
}

function getPurchaseDisplay(item: Purchase) {
  if (item.status === 'cancelled') {
    return { label: 'Cancelled', tone: 'muted' as StatusTone, icon: 'close-circle-outline' as const };
  }
  if (isPaid(item)) {
    return { label: 'Paid', tone: 'success' as StatusTone, icon: 'check-circle-outline' as const };
  }
  if (isPartial(item)) {
    return { label: 'Partial', tone: 'warning' as StatusTone, icon: 'clock-outline' as const };
  }
  return { label: 'Unpaid', tone: 'danger' as StatusTone, icon: 'alert-circle-outline' as const };
}

function getToneColors(tone: StatusTone, colors: AppPalette) {
  if (tone === 'danger') return { bg: colors.dangerSoft, text: colors.danger, border: colors.danger };
  if (tone === 'success') return { bg: colors.successSoft, text: colors.success, border: colors.success };
  if (tone === 'warning') return { bg: colors.warningSoft, text: colors.warning, border: colors.warning };
  if (tone === 'info') return { bg: colors.accentSoft, text: colors.accent, border: colors.accent };
  return { bg: colors.backgroundAlt, text: colors.textMuted, border: colors.border };
}

function resolvePurchaseSupplier(item: Purchase, partyMap?: Map<string, Party>) {
  const directParty = (item as any).party || (item as any).Party || (item as any).supplier;
  const directName = item.partyName || directParty?.name || (item as any).supplierName;
  const directPhone = directParty?.phone || (item as any).supplierPhone || (item as any).phone;

  if (item.partyId && partyMap?.has(item.partyId)) {
    const matched = partyMap.get(item.partyId)!;
    return {
      name: directName || matched.name || 'Supplier',
      phone: directPhone || matched.phone || '',
      address: matched.address || '',
      party: matched,
    };
  }

  return {
    name: directName || 'Supplier',
    phone: directPhone || '',
    address: directParty?.address || '',
    party: directParty,
  };
}

export default function PurchasesScreen() {
  const colors = usePalette();
  const styles = useThemedStyles(createStyles);
  const params = useLocalSearchParams<{ filter?: string | string[]; openId?: string | string[] }>();
  const queryClient = useQueryClient();
  const currency = useAuthStore((state) => state.businessProfile?.currencyCode) || 'NPR';
  const businessName = useAuthStore((state) => state.businessProfile?.businessName) || 'PM';

  const [dueFilter, setDueFilter] = useState<DueFilter>('all');
  const [search, setSearch] = useState('');
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<string | null>(null);
  const [handledOpenId, setHandledOpenId] = useState<string | null>(null);
  const [amountPaidDraft, setAmountPaidDraft] = useState('0');
  const [statusDraft, setStatusDraft] = useState('received');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank'>('cash');
  const [bankId, setBankId] = useState('');
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  const purchasesQuery = usePurchases('purchase');
  const partiesQuery = useParties('', 'both');
  const { data: purchaseDetail, isLoading: isDetailLoading } = usePurchaseById(selectedPurchaseId ?? undefined);
  const { data: banks } = useBanks();
  const activeBanks = useMemo(() => (banks ?? []).filter((bank) => bank.isActive), [banks]);

  const partyMap = useMemo(() => {
    return new Map((partiesQuery.data ?? []).map((p) => [p.id, p]));
  }, [partiesQuery.data]);

  const debouncedSearch = useDebouncedValue(search);
  const routeFilter = useMemo(
    () => (Array.isArray(params.filter) ? params.filter[0] : params.filter),
    [params.filter],
  );
  const routeOpenId = useMemo(
    () => (Array.isArray(params.openId) ? params.openId[0] : params.openId),
    [params.openId],
  );

  const purchases = purchasesQuery.data ?? [];

  const counts = useMemo(() => {
    let dueCount = 0;
    let paidCount = 0;
    let totalBilled = 0;
    let totalDue = 0;

    for (const item of purchases) {
      const due = dueAmount(item.grandTotal, item.amountReceived);
      totalBilled += Number(item.grandTotal || 0);
      totalDue += due;

      if (isPaid(item)) {
        paidCount += 1;
      } else {
        dueCount += 1;
      }
    }

    return {
      all: purchases.length,
      due: dueCount,
      paid: paidCount,
      totalBilled,
      totalDue,
    };
  }, [purchases]);

  const visiblePurchases = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    return purchases.filter((item) => {
      if (dueFilter === 'due' && isPaid(item)) return false;
      if (dueFilter === 'paid' && !isPaid(item)) return false;
      if (!query) return true;

      const supplier = resolvePurchaseSupplier(item, partyMap);
      const searchTargets = [
        item.invoiceNo,
        supplier.name,
        supplier.phone,
        item.status,
        item.notes,
      ]
        .filter(Boolean)
        .map((val) => String(val).toLowerCase());

      return searchTargets.some((target) => target.includes(query));
    });
  }, [debouncedSearch, dueFilter, partyMap, purchases]);

  useEffect(() => {
    if (routeFilter === 'expense') {
      router.replace('/(app)/(tabs)/expenses');
    }
  }, [routeFilter]);

  useEffect(() => {
    if (!routeOpenId || handledOpenId === routeOpenId) return;
    const selected = purchases.find((item) => item.id === routeOpenId);
    if (!selected) return;
    openPurchase(routeOpenId);
    setHandledOpenId(routeOpenId);
  }, [handledOpenId, purchases, routeOpenId]);

  function openPurchase(purchaseId: string) {
    const selected = purchases.find((item) => item.id === purchaseId);
    setSelectedPurchaseId(purchaseId);
    setAmountPaidDraft(String(selected?.amountReceived ?? 0));
    setStatusDraft(selected?.status ?? 'received');
    setPaymentMethod((selected?.paymentMethod as 'cash' | 'bank') ?? 'cash');
    setBankId(selected?.bankId ?? '');
  }

  async function savePurchaseUpdate() {
    if (!selectedPurchaseId) return;
    setSaving(true);
    try {
      await purchasesApi.update(selectedPurchaseId, {
        status: statusDraft,
        amountReceived: Number(amountPaidDraft || 0),
        paymentMethod,
        bankId: paymentMethod === 'bank' ? bankId || undefined : undefined,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['purchases', 'purchase'] }),
        queryClient.invalidateQueries({ queryKey: ['purchase', selectedPurchaseId] }),
        queryClient.invalidateQueries({ queryKey: ['recent-purchases'] }),
      ]);
      setSelectedPurchaseId(null);
    } catch (error) {
      Alert.alert('Unable to update', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function confirmRemovePurchase() {
    Alert.alert('Delete this purchase bill?', 'This will remove the bill and all associated records.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete Bill',
        style: 'destructive',
        onPress: () => void removePurchase(),
      },
    ]);
  }

  async function removePurchase() {
    if (!selectedPurchaseId) return;
    try {
      await purchasesApi.remove(selectedPurchaseId);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['purchases', 'purchase'] }),
        queryClient.invalidateQueries({ queryKey: ['recent-purchases'] }),
      ]);
      setSelectedPurchaseId(null);
    } catch (error) {
      Alert.alert('Unable to delete', error instanceof Error ? error.message : 'Please try again.');
    }
  }

  async function handleShareReport() {
    try {
      setExporting(true);
      const visibleTotals = visiblePurchases.reduce(
        (acc, item) => {
          acc.total += Number(item.grandTotal || 0);
          acc.due += dueAmount(item.grandTotal, item.amountReceived);
          return acc;
        },
        { total: 0, due: 0 },
      );
      await shareHtmlAsPdf(
        buildExpenseReportHtml({
          businessName,
          currency,
          periodLabel: dueFilter === 'all' ? 'All purchases' : dueFilter === 'due' ? 'Unpaid bills' : 'Paid bills',
          items: visiblePurchases,
          total: visibleTotals.total,
          due: visibleTotals.due,
          title: 'Purchase report',
        }),
        'Share purchase report',
      );
    } catch (error) {
      Alert.alert('Unable to share', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setExporting(false);
    }
  }

  const selectedSupplier = purchaseDetail ? resolvePurchaseSupplier(purchaseDetail, partyMap) : null;
  const selectedDisplay = purchaseDetail ? getPurchaseDisplay(purchaseDetail) : null;
  const selectedDue = purchaseDetail ? dueAmount(Number(purchaseDetail.grandTotal || 0), Number(purchaseDetail.amountReceived || 0)) : 0;

  return (
    <Screen
      scrollable={false}
      padded={false}
      topBarTitle="Purchases"
      topBarRight={
        <Pressable onPress={() => void handleShareReport()} hitSlop={8} disabled={exporting}>
          {exporting ? (
            <ActivityIndicator color={colors.primary} size="small" />
          ) : (
            <MaterialCommunityIcons color={colors.text} name="share-variant-outline" size={22} />
          )}
        </Pressable>
      }
      footer={
        <StickyActionBar
          primary={{
            label: 'New Purchase',
            onPress: () => router.push('/(app)/purchase-create'),
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
            refreshing={purchasesQuery.isRefetching || partiesQuery.isRefetching}
            onRefresh={() => {
              void purchasesQuery.refetch();
              void partiesQuery.refetch();
            }}
          />
        }
        contentContainerStyle={styles.scroll}>
        
        {/* KPI Summary Dashboard Tiles */}
        <View style={styles.statsGrid}>
          <View style={[styles.statTile, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.statIconBox, { backgroundColor: colors.accentSoft }]}>
              <MaterialCommunityIcons name="truck-delivery-outline" size={20} color={colors.accent} />
            </View>
            <Text style={[styles.statValue, { color: colors.text }]}>{counts.all}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Total Bills</Text>
          </View>

          <View style={[styles.statTile, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.statIconBox, { backgroundColor: colors.dangerSoft }]}>
              <MaterialCommunityIcons name="clock-alert-outline" size={20} color={colors.danger} />
            </View>
            <Text style={[styles.statValue, { color: colors.danger }]}>{counts.due}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Unpaid Bills</Text>
          </View>

          <View style={[styles.statTile, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.statIconBox, { backgroundColor: colors.warningSoft }]}>
              <MaterialCommunityIcons name="cash-multiple" size={20} color={colors.warning} />
            </View>
            <Text style={[styles.statValue, { color: colors.text }]} numberOfLines={1}>
              {formatCurrency(counts.totalDue, currency)}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Pending Due</Text>
          </View>

          <View style={[styles.statTile, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.statIconBox, { backgroundColor: colors.successSoft }]}>
              <MaterialCommunityIcons name="check-circle-outline" size={20} color={colors.success} />
            </View>
            <Text style={[styles.statValue, { color: colors.success }]}>{counts.paid}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Paid in Full</Text>
          </View>
        </View>

        {/* Live Search and Filters */}
        <SearchField
          placeholder="Search by supplier, phone, or invoice #"
          value={search}
          onChangeText={setSearch}
        />

        <SegmentedTabs
          value={dueFilter}
          onChange={setDueFilter}
          options={[
            { label: `All (${counts.all})`, value: 'all' },
            { label: `Unpaid (${counts.due})`, value: 'due' },
            { label: `Paid (${counts.paid})`, value: 'paid' },
          ]}
        />

        {/* Empty State */}
        {!purchasesQuery.isLoading && !visiblePurchases.length ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.accentSoft }]}>
              <MaterialCommunityIcons name="truck-delivery-outline" size={32} color={colors.accent} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {purchases.length ? 'No matching purchase bills' : 'No purchases yet'}
            </Text>
            <Text style={[styles.emptyCopy, { color: colors.textMuted }]}>
              {purchases.length
                ? 'Try a different supplier name, phone number, or payment status filter.'
                : 'Add a supplier purchase bill to track inventory costs, stock intake, and amounts you owe.'}
            </Text>
            <Pressable
              style={[styles.emptyActionBtn, { backgroundColor: colors.primary }]}
              onPress={() => router.push('/(app)/purchase-create')}>
              <Text style={styles.emptyActionBtnText}>Create New Purchase</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Purchases Bill List */}
        <View style={styles.list}>
          {visiblePurchases.map((item) => {
            const supplier = resolvePurchaseSupplier(item, partyMap);
            const display = getPurchaseDisplay(item);
            const tone = getToneColors(display.tone, colors);
            const due = dueAmount(item.grandTotal, item.amountReceived);

            return (
              <Pressable
                key={item.id}
                onPress={() => openPurchase(item.id)}
                style={({ pressed }) => [
                  styles.card,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                  pressed && styles.cardPressed,
                ]}>
                
                {/* Header Row: Supplier Info + Status Pill */}
                <View style={styles.cardHeader}>
                  <View style={styles.customerWrap}>
                    <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                      <Text style={[styles.avatarText, { color: colors.white }]}>
                        {partyInitials(supplier.name)}
                      </Text>
                    </View>
                    <View style={styles.customerCopy}>
                      <View style={styles.customerNameRow}>
                        <Text style={[styles.customerName, { color: colors.text }]} numberOfLines={1}>
                          {supplier.name}
                        </Text>
                        {item.invoiceNo ? (
                          <View style={[styles.orderNoPill, { backgroundColor: colors.backgroundAlt }]}>
                            <Text style={[styles.orderNoText, { color: colors.textMuted }]}>
                              #{item.invoiceNo}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      {supplier.phone ? (
                        <Text style={[styles.customerPhone, { color: colors.textMuted }]}>
                          {supplier.phone}
                        </Text>
                      ) : (
                        <Text style={[styles.customerPhone, { color: colors.textSoft }]}>
                          No phone number
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
                      Date: {prettyDate(item.purchaseDate)}
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
                </View>

                {/* Financial Strip & Action Row */}
                <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
                  <View style={styles.financialCol}>
                    <Text style={[styles.grandTotalLabel, { color: colors.textMuted }]}>
                      Bill Total: <Text style={{ color: colors.text, fontWeight: '700' }}>{formatCurrency(item.grandTotal, currency)}</Text>
                    </Text>
                    <Text
                      style={[
                        styles.dueAmount,
                        { color: due > 0 ? colors.danger : colors.success },
                      ]}>
                      {due > 0 ? `To Pay: ${formatCurrency(due, currency)}` : 'Fully Settled'}
                    </Text>
                  </View>

                  {/* Quick Action Pills */}
                  <View style={styles.quickActions}>
                    {due > 0 ? (
                      <Pressable
                        style={[styles.quickActionBtn, { backgroundColor: colors.accentSoft }]}
                        onPress={() => openPurchase(item.id)}>
                        <Text style={[styles.quickActionText, { color: colors.accent }]}>Pay Bill</Text>
                      </Pressable>
                    ) : null}

                    {supplier.phone ? (
                      <Pressable
                        style={[styles.callBtn, { backgroundColor: colors.backgroundAlt }]}
                        onPress={() => void Linking.openURL(`tel:${supplier.phone}`)}>
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

      {/* Purchase Detail and Payment Sheet */}
      <BottomSheet
        visible={Boolean(selectedPurchaseId)}
        title={selectedSupplier?.name || purchaseDetail?.invoiceNo || 'Bill Details'}
        subtitle={
          purchaseDetail
            ? `Invoice #${purchaseDetail.invoiceNo || 'N/A'} · ${selectedDisplay?.label ?? ''}`
            : 'Purchase update'
        }
        onClose={() => setSelectedPurchaseId(null)}
        fullHeight
        footer={
          <View style={styles.footerActions}>
            <Pressable style={[styles.secondaryButton, { backgroundColor: colors.dangerSoft }]} onPress={confirmRemovePurchase}>
              <Text style={[styles.secondaryLabel, { color: colors.danger }]}>Delete</Text>
            </Pressable>
            <Pressable
              disabled={saving}
              style={[styles.primaryButton, { backgroundColor: colors.primary }]}
              onPress={() => void savePurchaseUpdate()}>
              {saving ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.primaryLabel}>Save Updates</Text>
              )}
            </Pressable>
          </View>
        }>
        {isDetailLoading || !purchaseDetail ? (
          <View style={styles.detailLoadingWrap}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.helperText, { marginTop: spacing.sm }]}>Loading purchase details...</Text>
          </View>
        ) : (
          <View style={styles.sheetContent}>
            
            {/* Supplier Contact Card */}
            <SurfaceCard title="Supplier Information">
              <View style={styles.customerDetailRow}>
                <View style={[styles.avatarLarge, { backgroundColor: colors.primary }]}>
                  <Text style={[styles.avatarLargeText, { color: colors.white }]}>
                    {partyInitials(selectedSupplier?.name || 'Supplier')}
                  </Text>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[styles.detailCustomerName, { color: colors.text }]}>
                    {selectedSupplier?.name}
                  </Text>
                  <Text style={[styles.helperText, { color: colors.textMuted }]}>
                    {selectedSupplier?.phone || 'No phone number provided'}
                  </Text>
                  {selectedSupplier?.address ? (
                    <Text style={[styles.helperText, { color: colors.textSoft }]}>
                      {selectedSupplier.address}
                    </Text>
                  ) : null}
                </View>
                {selectedSupplier?.phone ? (
                  <Pressable
                    style={[styles.callActionPill, { backgroundColor: colors.successSoft }]}
                    onPress={() => void Linking.openURL(`tel:${selectedSupplier.phone}`)}>
                    <MaterialCommunityIcons name="phone" size={18} color={colors.success} />
                    <Text style={[styles.callActionText, { color: colors.success }]}>Call</Text>
                  </Pressable>
                ) : null}
              </View>
            </SurfaceCard>

            {/* Bill Status */}
            <View style={styles.formSection}>
              <Text style={[styles.formSectionTitle, { color: colors.text }]}>Bill Status</Text>
              <SegmentedTabs
                value={statusDraft as any}
                onChange={setStatusDraft}
                options={[
                  { label: 'Received', value: 'received' },
                  { label: 'Pending', value: 'pending' },
                  { label: 'Cancelled', value: 'cancelled' },
                ]}
              />
            </View>

            {/* Payment & Balance Due */}
            <SurfaceCard
              title="Payment Settlement"
              subtitle={`Grand Total: ${formatCurrency(Number(purchaseDetail.grandTotal || 0), currency)} · Remaining Due: ${formatCurrency(selectedDue, currency)}`}>
              <FormField
                label="Amount Paid So Far (रू)"
                value={amountPaidDraft}
                onChangeText={setAmountPaidDraft}
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
            <SurfaceCard title="Purchased Items" subtitle={`${purchaseDetail.items?.length || 0} items on this bill`}>
              <View style={styles.itemList}>
                {(purchaseDetail.items ?? []).map((item, index) => (
                  <View key={`${purchaseDetail.id}-${index}`} style={[styles.itemRow, { backgroundColor: colors.backgroundAlt }]}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={[styles.itemTitle, { color: colors.text }]}>
                        {item.description || item.productId || item.itemType || 'Item'}
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
                {!purchaseDetail.items?.length ? (
                  <Text style={styles.helperText}>No line items recorded on this bill.</Text>
                ) : null}
              </View>
            </SurfaceCard>

            {/* Notes and Dates */}
            <SurfaceCard title="Bill Information & Notes">
              <View style={styles.timelineRow}>
                <Text style={[styles.helperText, { color: colors.textMuted }]}>
                  Purchase Date: <Text style={{ fontWeight: '700', color: colors.text }}>{prettyDate(purchaseDetail.purchaseDate)}</Text>
                </Text>
              </View>
              {purchaseDetail.notes ? (
                <Text style={[styles.notesText, { color: colors.text }]}>
                  {purchaseDetail.notes}
                </Text>
              ) : (
                <Text style={[styles.helperText, { color: colors.textSoft }]}>No notes provided.</Text>
              )}
            </SurfaceCard>
          </View>
        )}
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
      gap: 2,
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
