import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { useBanks, usePurchaseById, usePurchases } from '@/src/shared/hooks/useAppQueries';
import { useDebouncedValue } from '@/src/shared/hooks/useDebouncedValue';
import { radius, shadows, spacing, typography } from '@/src/theme';
import type { Purchase } from '@/src/types/models';
import { useAuthStore } from '@/src/stores/auth-store';
import { usePalette } from '@/src/stores/theme-store';
import { useThemedStyles } from '@/src/theme/use-themed-styles';
import type { AppPalette } from '@/src/theme/app-palette';

type DueFilter = 'all' | 'due' | 'paid';

function dueAmount(total: number, paid: number) {
  return Math.max(0, Number(total || 0) - Number(paid || 0));
}

function isPaid(item: Purchase) {
  return dueAmount(item.grandTotal, item.amountReceived) < 0.5;
}

export default function PurchasesScreen() {
  const colors = usePalette();
  const styles = useThemedStyles(createStyles);
  const params = useLocalSearchParams<{ filter?: string | string[]; openId?: string | string[] }>();
  const queryClient = useQueryClient();
  const currency = useAuthStore((state) => state.businessProfile?.currencyCode) || 'NPR';
  const businessName = useAuthStore((state) => state.businessProfile?.businessName) || 'PasalManager';
  const [dueFilter, setDueFilter] = useState<DueFilter>('all');
  const [search, setSearch] = useState('');
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<string | null>(null);
  const [handledOpenId, setHandledOpenId] = useState<string | null>(null);
  const [amountPaidDraft, setAmountPaidDraft] = useState('0');
  const [statusDraft, setStatusDraft] = useState('received');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank'>('cash');
  const [bankId, setBankId] = useState('');
  const [exporting, setExporting] = useState(false);
  const purchasesQuery = usePurchases('purchase');
  const { data: purchaseDetail } = usePurchaseById(selectedPurchaseId ?? undefined);
  const { data: banks } = useBanks();
  const activeBanks = (banks ?? []).filter((bank) => bank.isActive);
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
  const visiblePurchases = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    return purchases.filter((item) => {
      if (dueFilter === 'due' && isPaid(item)) return false;
      if (dueFilter === 'paid' && !isPaid(item)) return false;
      if (!query) return true;
      return [item.invoiceNo, item.partyName, item.status, item.notes]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [debouncedSearch, dueFilter, purchases]);

  const totals = useMemo(() => {
    return purchases.reduce(
      (acc, item) => {
        acc.total += Number(item.grandTotal || 0);
        acc.due += dueAmount(item.grandTotal, item.amountReceived);
        return acc;
      },
      { total: 0, due: 0 },
    );
  }, [purchases]);

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
    }
  }

  function confirmRemovePurchase() {
    Alert.alert('Delete this bill?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
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
            label: 'New purchase',
            onPress: () => router.push('/(app)/purchase-create'),
          }}
        />
      }>
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={purchasesQuery.isRefetching} onRefresh={() => void purchasesQuery.refetch()} />
        }
        contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Supplier bills, invoice numbers, and outstanding payables.
          </Text>
        </View>

        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { backgroundColor: colors.accentSoft, borderColor: colors.border }]}>
            <Text style={[styles.summaryLabel, { color: colors.primary }]}>Billed</Text>
            <Text style={[styles.summaryValue, { color: colors.primary }]}>{formatCurrency(totals.total, currency)}</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: colors.dangerSoft, borderColor: colors.border }]}>
            <Text style={[styles.summaryLabel, { color: colors.danger }]}>To pay</Text>
            <Text style={[styles.summaryValue, { color: colors.danger }]}>{formatCurrency(totals.due, currency)}</Text>
          </View>
        </View>

        <SearchField
          placeholder="Search supplier or invoice"
          value={search}
          onChangeText={setSearch}
        />
        <SegmentedTabs
          value={dueFilter}
          onChange={setDueFilter}
          options={[
            { label: 'All', value: 'all' },
            { label: 'Due', value: 'due' },
            { label: 'Paid', value: 'paid' },
          ]}
        />

        {!purchasesQuery.isLoading && !visiblePurchases.length ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.accentSoft }]}>
              <MaterialCommunityIcons name="truck-delivery-outline" size={28} color={colors.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {purchases.length ? 'No matching purchases' : 'No purchases yet'}
            </Text>
            <Text style={[styles.emptyCopy, { color: colors.textMuted }]}>
              {purchases.length
                ? 'Try a different search or paid/due filter.'
                : 'Add a supplier bill to track stock cost and what you still owe.'}
            </Text>
          </View>
        ) : null}

        <View style={styles.list}>
          {visiblePurchases.map((item) => {
            const due = dueAmount(item.grandTotal, item.amountReceived);
            const paid = due < 0.5;
            const name = item.partyName || 'Supplier';
            return (
              <Pressable
                key={item.id}
                onPress={() => openPurchase(item.id)}
                style={({ pressed }) => [
                  styles.row,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                  pressed && styles.rowPressed,
                ]}>
                <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                  <Text style={[styles.avatarText, { color: colors.white }]}>{partyInitials(name)}</Text>
                </View>
                <View style={styles.rowCopy}>
                  <View style={styles.nameRow}>
                    <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
                      {name}
                    </Text>
                    <View
                      style={[
                        styles.badge,
                        { backgroundColor: paid ? colors.successSoft : colors.dangerSoft },
                      ]}>
                      <Text style={[styles.badgeText, { color: paid ? colors.success : colors.danger }]}>
                        {paid ? 'Paid' : 'Due'}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.rowMeta, { color: colors.textMuted }]} numberOfLines={1}>
                    {[item.invoiceNo || 'No invoice', prettyDate(item.purchaseDate)].join('  ·  ')}
                  </Text>
                </View>
                <View style={styles.amountWrap}>
                  <Text style={[styles.amount, { color: paid ? colors.text : colors.danger }]}>
                    {formatCurrency(paid ? item.grandTotal : due, currency)}
                  </Text>
                  <Text style={[styles.rowMeta, { color: colors.textSoft }]}>
                    {paid ? 'Total' : 'To pay'}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <BottomSheet
        visible={Boolean(selectedPurchaseId)}
        title={purchaseDetail?.partyName || purchaseDetail?.invoiceNo || 'Bill details'}
        subtitle={purchaseDetail?.invoiceNo ?? 'Update payment or remove the entry.'}
        onClose={() => setSelectedPurchaseId(null)}
        fullHeight
        footer={
          <View style={styles.footerActions}>
            <Pressable style={styles.secondaryButton} onPress={confirmRemovePurchase}>
              <Text style={styles.secondaryLabel}>Delete</Text>
            </Pressable>
            <Pressable style={styles.primaryButton} onPress={() => void savePurchaseUpdate()}>
              <Text style={styles.primaryLabel}>Save update</Text>
            </Pressable>
          </View>
        }>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetContent}>
          <SurfaceCard title="Summary" subtitle={purchaseDetail?.notes || 'No notes added yet.'}>
            <Text style={styles.helperText}>
              Date {prettyDate(purchaseDetail?.purchaseDate)}
              {'  ·  '}
              Total {formatCurrency(Number(purchaseDetail?.grandTotal ?? 0), currency)}
              {'  ·  '}
              Due {formatCurrency(dueAmount(Number(purchaseDetail?.grandTotal ?? 0), Number(purchaseDetail?.amountReceived ?? 0)), currency)}
            </Text>
          </SurfaceCard>
          <FormField label="Amount paid" value={amountPaidDraft} onChangeText={setAmountPaidDraft} keyboardType="numeric" />
          <SegmentedTabs
            value={(['received', 'pending', 'cancelled'].includes(statusDraft) ? statusDraft : 'received') as 'received' | 'pending' | 'cancelled'}
            onChange={setStatusDraft}
            options={[
              { label: 'Received', value: 'received' },
              { label: 'Pending', value: 'pending' },
              { label: 'Cancelled', value: 'cancelled' },
            ]}
          />
          <PaymentMethodSelector value={paymentMethod} onChange={setPaymentMethod} />
          {paymentMethod === 'bank' ? (
            <View style={styles.bankWrap}>
              {activeBanks.length > 0 ? (
                activeBanks.map((bank) => (
                  <Pressable
                    key={bank.id}
                    style={[styles.bankChip, bankId === bank.id && styles.bankChipActive]}
                    onPress={() => setBankId(bank.id)}>
                    <Text style={[styles.bankChipLabel, bankId === bank.id && styles.bankChipLabelActive]}>
                      {bank.name}
                    </Text>
                  </Pressable>
                ))
              ) : (
                <Pressable style={styles.emptyBankInfo} onPress={() => router.push('/(app)/banks')}>
                  <MaterialCommunityIcons name="bank-plus" size={24} color={colors.textMuted} />
                  <Text style={styles.emptyBankText}>No active banks found. Tap to add one in settings.</Text>
                </Pressable>
              )}
            </View>
          ) : null}
          <SurfaceCard title="Items" subtitle="Lines on this bill.">
            <View style={styles.itemList}>
              {(purchaseDetail?.items ?? []).map((item, index) => (
                <View key={`${purchaseDetail?.id}-${index}`} style={styles.itemRow}>
                  <Text style={styles.itemTitle}>{item.description || item.productId || item.itemType || 'Line item'}</Text>
                  <Text style={styles.itemAmount}>{formatCurrency(item.lineTotal, currency)}</Text>
                </View>
              ))}
              {!purchaseDetail?.items?.length ? (
                <Text style={styles.helperText}>No line items on this bill.</Text>
              ) : null}
            </View>
          </SurfaceCard>
        </ScrollView>
      </BottomSheet>
    </Screen>
  );
}

const createStyles = (colors: AppPalette) =>
  StyleSheet.create({
    scroll: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.xxl,
      gap: spacing.md,
    },
    hero: {
      gap: spacing.xs,
    },
    title: {
      fontSize: typography.hero,
      fontWeight: '800',
      letterSpacing: -0.4,
    },
    subtitle: {
      fontSize: typography.body,
      lineHeight: 22,
    },
    summaryRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    summaryCard: {
      flex: 1,
      borderRadius: radius.md,
      borderWidth: 1,
      padding: spacing.md,
      gap: 4,
    },
    summaryLabel: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    summaryValue: {
      fontSize: typography.subheading,
      fontWeight: '800',
    },
    list: {
      gap: spacing.sm,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderRadius: radius.lg,
      borderWidth: 1,
      padding: spacing.md,
      ...shadows.card,
    },
    rowPressed: {
      opacity: 0.92,
      transform: [{ scale: 0.995 }],
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      fontSize: 14,
      fontWeight: '800',
    },
    rowCopy: {
      flex: 1,
      gap: 3,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    rowTitle: {
      flexShrink: 1,
      fontSize: typography.body,
      fontWeight: '700',
    },
    rowMeta: {
      fontSize: typography.label,
    },
    badge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radius.pill,
    },
    badgeText: {
      fontSize: 10,
      fontWeight: '800',
    },
    amountWrap: {
      alignItems: 'flex-end',
      gap: 2,
    },
    amount: {
      fontSize: typography.body,
      fontWeight: '800',
    },
    emptyCard: {
      alignItems: 'center',
      borderRadius: radius.lg,
      borderWidth: 1,
      padding: spacing.xl,
      gap: spacing.sm,
    },
    emptyIcon: {
      width: 56,
      height: 56,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
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
    footerActions: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    secondaryButton: {
      flex: 1,
      minHeight: 50,
      borderRadius: radius.md,
      backgroundColor: colors.dangerSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondaryLabel: {
      color: colors.danger,
      fontSize: typography.body,
      fontWeight: '800',
    },
    primaryButton: {
      flex: 1,
      minHeight: 50,
      borderRadius: radius.md,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryLabel: {
      color: colors.white,
      fontSize: typography.body,
      fontWeight: '800',
    },
    sheetContent: {
      gap: spacing.md,
      paddingBottom: spacing.xl,
    },
    helperText: {
      fontSize: typography.body,
      color: colors.textMuted,
      lineHeight: 22,
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
    itemList: {
      gap: spacing.sm,
    },
    itemRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceMuted,
      padding: spacing.md,
    },
    itemTitle: {
      fontSize: typography.body,
      fontWeight: '700',
      color: colors.text,
      flex: 1,
    },
    itemAmount: {
      fontSize: typography.body,
      fontWeight: '800',
      color: colors.primary,
    },
  });
