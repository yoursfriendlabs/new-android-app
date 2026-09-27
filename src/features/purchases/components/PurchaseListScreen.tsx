import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { FlashList } from '@shopify/flash-list';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { purchasesApi } from '@/src/api';
import { PurchaseDetailSheet, type PurchasePaymentUpdate } from '@/src/features/purchases/components/PurchaseDetailSheet';
import { PurchaseListCard } from '@/src/features/purchases/components/PurchaseListCard';
import { PurchaseSummaryTiles } from '@/src/features/purchases/components/PurchaseSummaryTiles';
import { filterByPayment, purchaseCounts, resolvePurchaseSupplier } from '@/src/features/purchases/lib/purchase-view';
import { useConfirm } from '@/src/shared/feedback/ConfirmProvider';
import { useToast } from '@/src/shared/feedback/ToastProvider';
import { useSubmissionLock } from '@/src/shared/hooks/useSubmissionLock';
import { invalidateAfterBill, usePagedPurchases, useParties, usePurchaseById, usePurchaseStats } from '@/src/shared/hooks/useAppQueries';
import { Screen } from '@/src/shared/layout/Screen';
import { StickyActionBar } from '@/src/shared/ui/StickyActionBar';
import { SearchField } from '@/src/shared/ui/SearchField';
import { SegmentedTabs } from '@/src/shared/ui/SegmentedTabs';
import { SkeletonList } from '@/src/shared/ui/Skeleton';
import { Text } from '@/src/shared/ui/Text';
import { useAuthStore } from '@/src/stores/auth-store';
import { usePalette } from '@/src/stores/theme-store';
import { spacing } from '@/src/theme';
import type { Purchase } from '@/src/types/models';

type PaymentFilter = 'all' | 'due' | 'paid';

/** The purchase register: find a bill, see what is owed, and settle it in place. */
export function PurchaseListScreen() {
  const submission = useSubmissionLock();
  const colors = usePalette();
  const confirm = useConfirm();
  const toast = useToast();
  const queryClient = useQueryClient();
  const currency = useAuthStore((state) => state.businessProfile?.currencyCode) || 'NPR';
  const params = useLocalSearchParams<{ filter?: string | string[]; openId?: string | string[] }>();

  const [filter, setFilter] = useState<PaymentFilter>('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [handledOpenId, setHandledOpenId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const listFilters = useMemo(
    () => ({ entryType: 'purchase' as const, search, payment: filter === 'all' ? undefined : filter }),
    [filter, search],
  );
  const purchasesQuery = usePagedPurchases(listFilters);
  const statsQuery = usePurchaseStats();
  const partiesQuery = useParties('', 'both');
  const { data: purchaseDetail, isLoading: isDetailLoading } = usePurchaseById(selectedId ?? undefined);

  const partyMap = useMemo(() => new Map((partiesQuery.data ?? []).map((party) => [party.id, party])), [partiesQuery.data]);
  const rows = useMemo(() => filterByPayment(purchasesQuery.items, filter), [filter, purchasesQuery.items]);
  const counts = useMemo(
    () => purchaseCounts(purchasesQuery.items, statsQuery.data, purchasesQuery.total),
    [purchasesQuery.items, purchasesQuery.total, statsQuery.data],
  );
  const routeFilter = Array.isArray(params.filter) ? params.filter[0] : params.filter;
  const routeOpenId = Array.isArray(params.openId) ? params.openId[0] : params.openId;
  const supplier = purchaseDetail ? resolvePurchaseSupplier(purchaseDetail, partyMap) : null;

  useEffect(() => {
    if (routeFilter === 'expense') router.replace('/(app)/(tabs)/expenses');
  }, [routeFilter]);

  useEffect(() => {
    if (!routeOpenId || handledOpenId === routeOpenId) return;
    setSelectedId(routeOpenId);
    setHandledOpenId(routeOpenId);
  }, [handledOpenId, routeOpenId]);

  async function saveUpdate(update: PurchasePaymentUpdate) {
    if (!selectedId) return;
    if (!submission.tryStart()) return;
    setSaving(true);
    try {
      await purchasesApi.update(selectedId, {
        status: update.status,
        amountReceived: update.amountReceived,
        paymentMethod: update.paymentMethod,
        bankId: update.bankId,
      });
      await Promise.all([
        invalidateAfterBill(queryClient, [purchaseDetail?.partyId]),
        queryClient.invalidateQueries({ queryKey: ['purchase', selectedId] }),
      ]);
      setSelectedId(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSaving(false);
      submission.finish();
    }
  }

  async function deletePurchase() {
    if (!selectedId) return;
    const approved = await confirm({
      title: 'Delete this purchase bill?',
      message: 'The bill, stock intake, and supplier amount recorded against it will be removed.',
      confirmLabel: 'Delete bill',
      destructive: true,
    });
    if (!approved) return;

    if (!submission.tryStart()) return;
    setSaving(true);
    try {
      await purchasesApi.remove(selectedId);
      await invalidateAfterBill(queryClient, [purchaseDetail?.partyId]);
      setSelectedId(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSaving(false);
      submission.finish();
    }
  }

  const refresh = () => {
    void purchasesQuery.refetch();
    void statsQuery.refetch();
    void partiesQuery.refetch();
  };
  const callSupplier = (phone: string) => {
    void Linking.openURL(`tel:${phone}`).catch(() => toast.error('This device cannot place a call.'));
  };

  return (
    <Screen
      scrollable={false}
      padded={false}
      topBarTitle="Purchases"
      footer={<StickyActionBar primary={{ label: 'New purchase', onPress: () => router.push('/(app)/purchase-create') }} />}>
      <FlashList<Purchase>
        data={rows}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <PurchaseListCard item={item} supplier={resolvePurchaseSupplier(item, partyMap)} currency={currency} onOpen={setSelectedId} onCall={callSupplier} />
        )}
        onEndReached={purchasesQuery.loadMore}
        onEndReachedThreshold={0.6}
        refreshControl={<RefreshControl refreshing={purchasesQuery.isRefreshing} onRefresh={refresh} />}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.header}>
            <PurchaseSummaryTiles counts={counts} currency={currency} />
            <SearchField placeholder="Search supplier, phone, invoice, or note" value={search} onChangeText={setSearch} />
            <SegmentedTabs
              value={filter}
              onChange={setFilter}
              options={[
                { label: `All (${counts.all})`, value: 'all' },
                { label: `Unpaid (${counts.due})`, value: 'due' },
                { label: `Paid (${counts.paid})`, value: 'paid' },
              ]}
            />
            {!counts.fromServer ? <Text variant="caption" tone="soft">Totals cover the bills loaded so far.</Text> : null}
          </View>
        }
        ListEmptyComponent={
          purchasesQuery.isLoading ? (
            <SkeletonList count={5} avatar />
          ) : (
            <View style={[styles.empty, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              <MaterialCommunityIcons color={colors.accent} name="truck-delivery-outline" size={32} />
              <Text variant="heading" align="center">{search || filter !== 'all' ? 'No matching purchase bills' : 'No purchases yet'}</Text>
              <Text variant="body" tone="muted" align="center">
                {search || filter !== 'all' ? 'Try another search or payment filter.' : 'Record a supplier delivery to track stock and what you still need to pay.'}
              </Text>
              {!search && filter === 'all' ? (
                <Pressable style={[styles.emptyAction, { backgroundColor: colors.primary }]} onPress={() => router.push('/(app)/purchase-create')}>
                  <Text variant="bodyStrong" tone="onPrimary">Create purchase</Text>
                </Pressable>
              ) : null}
            </View>
          )
        }
        ListFooterComponent={purchasesQuery.isFetchingNextPage ? <ActivityIndicator color={colors.primary} style={styles.loader} /> : null}
      />

      <PurchaseDetailSheet
        visible={Boolean(selectedId)} purchase={purchaseDetail} supplier={supplier} currency={currency} isLoading={isDetailLoading} saving={saving}
        onClose={() => setSelectedId(null)} onCall={callSupplier} onSave={saveUpdate} onDelete={() => void deletePurchase()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, paddingBottom: 160, gap: spacing.sm },
  header: { gap: spacing.md, paddingBottom: spacing.sm },
  empty: { alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: 16, padding: spacing.xl },
  emptyAction: { borderRadius: 12, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, marginTop: spacing.xs },
  loader: { marginVertical: spacing.lg },
});
