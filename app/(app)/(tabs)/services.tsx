import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { servicesApi } from '@/src/api';
import { BottomSheet } from '@/src/components/feedback/BottomSheet';
import { FormField } from '@/src/components/forms/FormField';
import { PaymentMethodSelector } from '@/src/components/forms/PaymentMethodSelector';
import { Screen } from '@/src/components/layout/Screen';
import { SegmentedTabs } from '@/src/components/ui/SegmentedTabs';
import { SurfaceCard } from '@/src/components/ui/SurfaceCard';
import { StickyActionBar } from '@/src/components/ui/StickyActionBar';
import { formatCurrency, prettyDate } from '@/src/lib/format';
import { useBanks, useServiceById, useServicesList } from '@/src/hooks/useAppQueries';
import { palette, radius, spacing, typography } from '@/src/theme';
import type { ServiceStatus } from '@/src/types/models';
import { useAuthStore } from '@/src/stores/auth-store';

export default function ServicesScreen() {
  const queryClient = useQueryClient();
  const { businessProfile } = useAuthStore();
  const isGym = businessProfile?.businessType === 'gym' || businessProfile?.type === 'gym';

  const getServiceStatusLabel = (status: string, deliveryDate: string) => {
    const isClosed = status === 'closed' || status === 'completed';
    if (isClosed) {
      return isGym ? 'Completed / Inactive' : 'Closed';
    }
    const isPast = deliveryDate && new Date(deliveryDate) < new Date();
    if (isPast) {
      return isGym ? 'Expired' : 'Overdue';
    }
    return status;
  };
  const { data: services } = useServicesList();
  const { data: banks } = useBanks();
  const activeBanks = useMemo(() => (banks ?? []).filter((bank) => bank.isActive), [banks]);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const { data: serviceDetail } = useServiceById(selectedServiceId ?? undefined);
  const [statusDraft, setStatusDraft] = useState<ServiceStatus>('open');
  const [receivedDraft, setReceivedDraft] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank'>('cash');
  const [bankId, setBankId] = useState('');
  const [message, setMessage] = useState('');

  function openService(serviceId: string) {
    setSelectedServiceId(serviceId);
    const selected = (services ?? []).find((entry) => entry.id === serviceId);
    setStatusDraft(selected?.status ?? 'open');
    setReceivedDraft(String(selected?.receivedTotal ?? 0));
    setPaymentMethod((selected?.paymentMethod as 'cash' | 'bank') ?? 'cash');
    setBankId(selected?.bankId ?? '');
  }

  async function saveServiceUpdate() {
    if (!selectedServiceId) return;
    setMessage('');
    try {
      await servicesApi.update(selectedServiceId, {
        status: statusDraft,
        receivedTotal: Number(receivedDraft || 0),
        paymentMethod,
        bankId: paymentMethod === 'bank' ? bankId || undefined : undefined,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['services-list'] }),
        queryClient.invalidateQueries({ queryKey: ['service', selectedServiceId] }),
        queryClient.invalidateQueries({ queryKey: ['recent-services'] }),
      ]);
      setMessage('Service updated.');
      setSelectedServiceId(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to update service.');
    }
  }

  async function removeService() {
    if (!selectedServiceId) return;
    setMessage('');
    try {
      await servicesApi.remove(selectedServiceId);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['services-list'] }),
        queryClient.invalidateQueries({ queryKey: ['recent-services'] }),
      ]);
      setMessage('Service removed.');
      setSelectedServiceId(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to remove service.');
    }
  }

  return (
    <Screen
      footer={
        <StickyActionBar
          primary={{ label: 'New service job', onPress: () => router.push('/(app)/service-create') }}
          leading={
            <Text style={styles.footerHint}>
              Start with customer details first, then add labor and parts when you’re ready.
            </Text>
          }
        />
      }>
      {message ? (
        <SurfaceCard>
          <Text style={styles.message}>{message}</Text>
        </SurfaceCard>
      ) : null}

      <SurfaceCard title="Open work" subtitle="Tap any service to review status, payment, and delivery details.">
        <View style={styles.list}>
          {(services ?? []).map((service) => {
            const statusLabel = getServiceStatusLabel(service.status, service.deliveryDate ?? '');
            const isExpiredOrOverdue = statusLabel === 'Expired' || statusLabel === 'Overdue';
            const isClosedOrInactive = statusLabel === 'Completed / Inactive' || statusLabel === 'Closed';
            return (
              <Pressable key={service.id} style={styles.serviceCard} onPress={() => openService(service.id)}>
                <View style={styles.serviceTop}>
                  <Text style={styles.serviceRef}>{service.orderNo}</Text>
                  <View style={[
                    styles.statusBadge,
                    isExpiredOrOverdue && styles.statusBadgeExpired,
                    isClosedOrInactive && styles.statusBadgeClosed,
                  ]}>
                    <Text style={[
                      styles.statusLabel,
                      isExpiredOrOverdue && styles.statusLabelExpired,
                      isClosedOrInactive && styles.statusLabelClosed,
                    ]}>
                      {statusLabel}
                    </Text>
                  </View>
                </View>
                <Text style={styles.serviceMeta}>
                  {isGym ? 'Expiry' : 'Delivery'} {prettyDate(service.deliveryDate)}  •  Received {formatCurrency(service.receivedTotal)}
                </Text>
                <Text style={styles.serviceAmount}>{formatCurrency(service.grandTotal)}</Text>
              </Pressable>
            );
          })}
          {!services?.length ? (
            <View style={styles.emptyWrap}>
              <MaterialCommunityIcons color={palette.textSoft} name="tools" size={24} />
              <Text style={styles.emptyText}>No recent service jobs yet.</Text>
            </View>
          ) : null}
        </View>
      </SurfaceCard>

      <BottomSheet
        visible={Boolean(selectedServiceId)}
        title={serviceDetail?.orderNo ?? 'Service details'}
        subtitle={serviceDetail ? getServiceStatusLabel(serviceDetail.status, serviceDetail.deliveryDate ?? '') : 'Update service status or payment from mobile.'}
        onClose={() => setSelectedServiceId(null)}
        fullHeight
        footer={
          <View style={styles.footerActions}>
            <Pressable style={styles.secondaryButton} onPress={() => void removeService()}>
              <Text style={styles.secondaryLabel}>Delete</Text>
            </Pressable>
            <Pressable style={styles.primaryButton} onPress={() => void saveServiceUpdate()}>
              <Text style={styles.primaryLabel}>Save update</Text>
            </Pressable>
          </View>
        }>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetContent}>
          <SurfaceCard title="Job summary" subtitle={serviceDetail?.notes || 'No notes added yet.'}>
            <Text style={styles.helperText}>
              {isGym ? 'Subscription End Date' : 'Delivery Date'}: {prettyDate(serviceDetail?.deliveryDate)}  •  Total {formatCurrency(Number(serviceDetail?.grandTotal ?? 0))}
            </Text>
          </SurfaceCard>
          <SegmentedTabs
            value={statusDraft as 'open' | 'in_progress' | 'ready'}
            onChange={(value) => setStatusDraft(value)}
            options={[
              { label: 'Open', value: 'open' },
              { label: 'In progress', value: 'in_progress' },
              { label: 'Ready', value: 'ready' },
            ]}
          />
          <FormField label="Amount received" value={receivedDraft} onChangeText={setReceivedDraft} keyboardType="numeric" />
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
          <SurfaceCard title="Items" subtitle="Mixed labor and part lines from the backend service detail.">
            <View style={styles.list}>
              {(serviceDetail?.items ?? []).map((item, index) => (
                <View key={`${serviceDetail?.id}-${index}`} style={styles.itemRow}>
                  <Text style={styles.title}>{item.description || item.productId || item.itemType}</Text>
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
  footerHint: {
    fontSize: typography.label,
    lineHeight: 18,
    color: palette.textMuted,
  },
  list: {
    gap: spacing.sm,
  },
  serviceCard: {
    borderRadius: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    padding: spacing.md,
    gap: spacing.xs,
    shadowColor: '#0f172a',
    shadowOpacity: 0.02,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  serviceTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  serviceRef: {
    fontSize: typography.body,
    fontWeight: '800',
    color: palette.text,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: '#e8f0fe',
  },
  statusLabel: {
    color: '#0263f9',
    fontSize: typography.caption,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  serviceMeta: {
    fontSize: typography.label,
    color: palette.textMuted,
  },
  serviceAmount: {
    fontSize: typography.subheading,
    fontWeight: '800',
    color: '#0263f9',
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  emptyText: {
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
    backgroundColor: '#0263f9',
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
    backgroundColor: '#0263f9',
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
  title: {
    fontSize: typography.body,
    fontWeight: '700',
    color: palette.text,
    flex: 1,
  },
  amount: {
    fontSize: typography.body,
    fontWeight: '800',
    color: '#0263f9',
  },
  statusBadgeExpired: {
    backgroundColor: palette.dangerSoft,
  },
  statusLabelExpired: {
    color: palette.danger,
  },
  statusBadgeClosed: {
    backgroundColor: palette.successSoft,
  },
  statusLabelClosed: {
    color: palette.success,
  },
});
