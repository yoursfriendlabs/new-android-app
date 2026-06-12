import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { purchasesApi } from '@/src/api';
import { BottomSheet } from '@/src/components/feedback/BottomSheet';
import { FormField } from '@/src/components/forms/FormField';
import { PaymentMethodSelector } from '@/src/components/forms/PaymentMethodSelector';
import { Screen } from '@/src/components/layout/Screen';
import { SegmentedTabs } from '@/src/components/ui/SegmentedTabs';
import { SurfaceCard } from '@/src/components/ui/SurfaceCard';
import { StickyActionBar } from '@/src/components/ui/StickyActionBar';
import { formatCurrency, prettyDate } from '@/src/lib/format';
import { useBanks, usePurchaseById, usePurchases } from '@/src/hooks/useAppQueries';
import { palette, radius, spacing, typography } from '@/src/theme';

export default function PurchasesScreen() {
  const params = useLocalSearchParams<{ filter?: string | string[]; openId?: string | string[] }>();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'purchase' | 'expense'>('purchase');
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<string | null>(null);
  const [handledOpenId, setHandledOpenId] = useState<string | null>(null);
  const [amountPaidDraft, setAmountPaidDraft] = useState('0');
  const [statusDraft, setStatusDraft] = useState('received');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank'>('cash');
  const [bankId, setBankId] = useState('');
  const [message, setMessage] = useState('');
  const { data: purchases } = usePurchases(filter);
  const { data: purchaseDetail } = usePurchaseById(selectedPurchaseId ?? undefined);
  const { data: banks } = useBanks();
  const activeBanks = (banks ?? []).filter((bank) => bank.isActive);
  const routeFilter = useMemo(
    () => (Array.isArray(params.filter) ? params.filter[0] : params.filter),
    [params.filter],
  );
  const routeOpenId = useMemo(
    () => (Array.isArray(params.openId) ? params.openId[0] : params.openId),
    [params.openId],
  );

  useEffect(() => {
    if (routeFilter === 'purchase' || routeFilter === 'expense') {
      setFilter(routeFilter);
    }
  }, [routeFilter]);

  useEffect(() => {
    if (!routeOpenId || handledOpenId === routeOpenId) return;
    const selected = (purchases ?? []).find((item) => item.id === routeOpenId);
    if (!selected) return;

    openPurchase(routeOpenId);
    setHandledOpenId(routeOpenId);
  }, [handledOpenId, purchases, routeOpenId]);

  function openPurchase(purchaseId: string) {
    const selected = (purchases ?? []).find((item) => item.id === purchaseId);
    setSelectedPurchaseId(purchaseId);
    setAmountPaidDraft(String(selected?.amountReceived ?? 0));
    setStatusDraft(selected?.status ?? 'received');
    setPaymentMethod((selected?.paymentMethod as 'cash' | 'bank') ?? 'cash');
    setBankId(selected?.bankId ?? '');
  }

  async function savePurchaseUpdate() {
    if (!selectedPurchaseId) return;
    setMessage('');
    try {
      await purchasesApi.update(selectedPurchaseId, {
        status: statusDraft,
        amountReceived: Number(amountPaidDraft || 0),
        paymentMethod,
        bankId: paymentMethod === 'bank' ? bankId || undefined : undefined,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['purchases', filter] }),
        queryClient.invalidateQueries({ queryKey: ['purchase', selectedPurchaseId] }),
        queryClient.invalidateQueries({ queryKey: ['recent-purchases'] }),
      ]);
      setSelectedPurchaseId(null);
      setMessage('Purchase updated.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to update purchase.');
    }
  }

  async function removePurchase() {
    if (!selectedPurchaseId) return;
    setMessage('');
    try {
      await purchasesApi.remove(selectedPurchaseId);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['purchases', filter] }),
        queryClient.invalidateQueries({ queryKey: ['recent-purchases'] }),
      ]);
      setSelectedPurchaseId(null);
      setMessage('Purchase removed.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to remove purchase.');
    }
  }

  return (
    <Screen
      footer={
        <StickyActionBar
          secondary={{ label: 'Quick expense', onPress: () => router.push('/(app)/(tabs)/quick-entry') }}
          primary={{ label: 'New purchase', onPress: () => router.push('/(app)/purchase-create') }}
        />
      }>
      {message ? (
        <SurfaceCard>
          <Text style={styles.message}>{message}</Text>
        </SurfaceCard>
      ) : null}

      <SegmentedTabs
        value={filter}
        onChange={setFilter}
        options={[
          { label: 'Purchases', value: 'purchase' },
          { label: 'Expenses', value: 'expense' },
        ]}
      />

      <SurfaceCard title="Recent entries" subtitle="Tap an entry to review payment and status details.">
        <View style={styles.list}>
          {(purchases ?? []).map((item) => (
            <Pressable key={item.id} style={styles.row} onPress={() => openPurchase(item.id)}>
              <View style={styles.copy}>
                <Text style={styles.title}>{item.invoiceNo ?? item.partyName ?? item.entryType}</Text>
                <Text style={styles.meta}>{prettyDate(item.purchaseDate)}</Text>
              </View>
              <View style={styles.amountWrap}>
                <Text style={styles.amount}>{formatCurrency(item.grandTotal)}</Text>
                <Text style={styles.amountMeta}>{item.status}</Text>
              </View>
            </Pressable>
          ))}
          {!purchases?.length ? <Text style={styles.empty}>No {filter} entries yet.</Text> : null}
        </View>
      </SurfaceCard>

      <BottomSheet
        visible={Boolean(selectedPurchaseId)}
        title={purchaseDetail?.invoiceNo ?? purchaseDetail?.entryType ?? 'Purchase details'}
        subtitle={purchaseDetail?.partyName ?? 'Update payment or remove the entry.'}
        onClose={() => setSelectedPurchaseId(null)}
        fullHeight
        footer={
          <View style={styles.footerActions}>
            <Pressable style={styles.secondaryButton} onPress={() => void removePurchase()}>
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
              Date {prettyDate(purchaseDetail?.purchaseDate)}  •  Total {formatCurrency(Number(purchaseDetail?.grandTotal ?? 0))}
            </Text>
          </SurfaceCard>
          <FormField label="Amount paid" value={amountPaidDraft} onChangeText={setAmountPaidDraft} keyboardType="numeric" />
          <FormField label="Status" value={statusDraft} onChangeText={setStatusDraft} />
          <PaymentMethodSelector value={paymentMethod} onChange={setPaymentMethod} />
          {paymentMethod === 'bank' ? (
            <View style={styles.bankWrap}>
              {activeBanks.length > 0 ? (
                activeBanks.map((bank) => (
                  <Pressable
                    key={bank.id}
                    style={[styles.bankChip, bankId === bank.id && styles.bankChipActive]}
                    onPress={() => setBankId(bank.id)}>
                    <Text
                      style={[
                        styles.bankChipLabel,
                        bankId === bank.id && styles.bankChipLabelActive,
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
          <SurfaceCard title="Items" subtitle="Purchase lines from the backend detail endpoint.">
            <View style={styles.list}>
              {(purchaseDetail?.items ?? []).map((item, index) => (
                <View key={`${purchaseDetail?.id}-${index}`} style={styles.itemRow}>
                  <Text style={styles.title}>{item.description || item.productId || item.itemType || 'Line item'}</Text>
                  <Text style={styles.amount}>{formatCurrency(item.lineTotal)}</Text>
                </View>
              ))}
            </View>
          </SurfaceCard>
        </ScrollView>
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  message: {
    color: palette.success,
    fontWeight: '700',
    fontSize: typography.body,
  },
  list: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderRadius: radius.md,
    backgroundColor: palette.surfaceMuted,
    padding: spacing.md,
  },
  copy: {
    flex: 1,
    gap: spacing.xxs,
  },
  title: {
    fontSize: typography.body,
    fontWeight: '700',
    color: palette.text,
  },
  meta: {
    fontSize: typography.label,
    color: palette.textMuted,
  },
  amountWrap: {
    alignItems: 'flex-end',
    gap: spacing.xxs,
  },
  amount: {
    fontSize: typography.body,
    fontWeight: '800',
    color: palette.primary,
  },
  amountMeta: {
    fontSize: typography.caption,
    color: palette.textSoft,
    textTransform: 'capitalize',
  },
  empty: {
    fontSize: typography.body,
    color: palette.textMuted,
  },
  footerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: radius.md,
    backgroundColor: palette.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryLabel: {
    color: palette.danger,
    fontSize: typography.body,
    fontWeight: '800',
  },
  primaryButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: radius.md,
    backgroundColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLabel: {
    color: palette.white,
    fontSize: typography.body,
    fontWeight: '800',
  },
  sheetContent: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  helperText: {
    fontSize: typography.body,
    color: palette.textMuted,
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
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderRadius: radius.md,
    backgroundColor: palette.surfaceMuted,
    padding: spacing.md,
  },
});
