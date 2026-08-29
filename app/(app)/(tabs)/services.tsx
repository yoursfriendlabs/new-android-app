import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { servicesApi } from '@/src/api';
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
import { useBanks, useServiceById, useServicesList } from '@/src/shared/hooks/useAppQueries';
import { useDebouncedValue } from '@/src/shared/hooks/useDebouncedValue';
import { radius, shadows, spacing, typography } from '@/src/theme';
import type { Service, ServiceStatus } from '@/src/types/models';
import { useAuthStore } from '@/src/stores/auth-store';
import { usePalette } from '@/src/stores/theme-store';
import { useThemedStyles } from '@/src/theme/use-themed-styles';
import type { AppPalette } from '@/src/theme/app-palette';

type ServiceFilter = 'all' | 'open' | 'ready' | 'closed';
type StatusTone = 'info' | 'warning' | 'success' | 'danger' | 'muted';

function dueAmount(total: number, paid: number) {
  return Math.max(0, Number(total || 0) - Number(paid || 0));
}

function isClosedStatus(status: string) {
  return ['closed', 'completed', 'delivered'].includes(String(status || '').toLowerCase());
}

function isReadyStatus(status: string) {
  return String(status || '').toLowerCase() === 'ready';
}

function isOverdue(service: Service) {
  if (isClosedStatus(service.status) || !service.deliveryDate) return false;
  const date = new Date(service.deliveryDate);
  return Number.isFinite(date.getTime()) && date < new Date();
}

function getServiceDisplay(service: Service, isGym: boolean) {
  if (isClosedStatus(service.status)) {
    return { label: isGym ? 'Completed' : 'Closed', tone: 'muted' as StatusTone };
  }
  if (isOverdue(service)) {
    return { label: isGym ? 'Expired' : 'Overdue', tone: 'danger' as StatusTone };
  }
  if (isReadyStatus(service.status)) {
    return { label: 'Ready', tone: 'success' as StatusTone };
  }
  if (String(service.status).toLowerCase() === 'in_progress') {
    return { label: 'In progress', tone: 'warning' as StatusTone };
  }
  return { label: isGym ? 'Active' : 'Open', tone: 'info' as StatusTone };
}

function getToneColors(tone: StatusTone, colors: AppPalette) {
  if (tone === 'danger') return { backgroundColor: colors.dangerSoft, color: colors.danger };
  if (tone === 'success') return { backgroundColor: colors.successSoft, color: colors.success };
  if (tone === 'warning') return { backgroundColor: colors.warningSoft, color: colors.warning };
  if (tone === 'info') return { backgroundColor: colors.infoSoft, color: colors.info };
  return { backgroundColor: colors.backgroundAlt, color: colors.textMuted };
}

function matchesFilter(service: Service, filter: ServiceFilter) {
  if (filter === 'all') return true;
  if (filter === 'closed') return isClosedStatus(service.status);
  if (filter === 'ready') return isReadyStatus(service.status) && !isOverdue(service);
  return !isClosedStatus(service.status) && !isReadyStatus(service.status);
}

export default function ServicesScreen() {
  const colors = usePalette();
  const styles = useThemedStyles(createStyles);
  const queryClient = useQueryClient();
  const currency = useAuthStore((state) => state.businessProfile?.currencyCode) || 'NPR';
  const { businessProfile } = useAuthStore();
  const isGym = businessProfile?.businessType === 'gym' || businessProfile?.type === 'gym';
  const servicesQuery = useServicesList();
  const { data: banks } = useBanks();
  const activeBanks = useMemo(() => (banks ?? []).filter((bank) => bank.isActive), [banks]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ServiceFilter>('all');
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const { data: serviceDetail } = useServiceById(selectedServiceId ?? undefined);
  const [statusDraft, setStatusDraft] = useState<ServiceStatus>('open');
  const [receivedDraft, setReceivedDraft] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank'>('cash');
  const [bankId, setBankId] = useState('');
  const debouncedSearch = useDebouncedValue(search);

  const services = servicesQuery.data ?? [];
  const visibleServices = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    return services.filter((service) => {
      if (!matchesFilter(service, filter)) return false;
      if (!query) return true;
      return [service.orderNo, service.partyName, service.notes, service.status]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [debouncedSearch, filter, services]);

  const totals = useMemo(() => {
    return services.reduce(
      (acc, service) => {
        const due = dueAmount(service.grandTotal, service.receivedTotal);
        if (!isClosedStatus(service.status)) acc.open += 1;
        if (isOverdue(service)) acc.overdue += 1;
        acc.due += due;
        return acc;
      },
      { open: 0, overdue: 0, due: 0 },
    );
  }, [services]);

  function openService(serviceId: string) {
    setSelectedServiceId(serviceId);
    const selected = services.find((entry) => entry.id === serviceId);
    setStatusDraft(selected?.status ?? 'open');
    setReceivedDraft(String(selected?.receivedTotal ?? 0));
    setPaymentMethod((selected?.paymentMethod as 'cash' | 'bank') ?? 'cash');
    setBankId(selected?.bankId ?? '');
  }

  async function saveServiceUpdate() {
    if (!selectedServiceId) return;
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
      setSelectedServiceId(null);
    } catch (error) {
      Alert.alert('Unable to update', error instanceof Error ? error.message : 'Please try again.');
    }
  }

  function confirmRemoveService() {
    Alert.alert('Delete this job?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => void removeService(),
      },
    ]);
  }

  async function removeService() {
    if (!selectedServiceId) return;
    try {
      await servicesApi.remove(selectedServiceId);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['services-list'] }),
        queryClient.invalidateQueries({ queryKey: ['recent-services'] }),
      ]);
      setSelectedServiceId(null);
    } catch (error) {
      Alert.alert('Unable to delete', error instanceof Error ? error.message : 'Please try again.');
    }
  }

  const selectedDisplay = serviceDetail ? getServiceDisplay(serviceDetail, isGym) : null;

  return (
    <Screen
      scrollable={false}
      padded={false}
      topBarTitle={isGym ? 'Memberships' : 'Services'}
      footer={<StickyActionBar primary={{ label: 'New service job', onPress: () => router.push('/(app)/service-create') }} />}>
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={servicesQuery.isRefetching} onRefresh={() => void servicesQuery.refetch()} />
        }
        contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {isGym
              ? 'Track active members, expiry, and outstanding fees.'
              : 'Open jobs, delivery dates, and amounts still due.'}
          </Text>
        </View>

        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { backgroundColor: colors.infoSoft, borderColor: colors.border }]}>
            <Text style={[styles.summaryLabel, { color: colors.info }]}>
              {totals.overdue ? `${totals.overdue} overdue` : 'Open jobs'}
            </Text>
            <Text style={[styles.summaryValue, { color: colors.info }]}>{totals.open}</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: colors.dangerSoft, borderColor: colors.border }]}>
            <Text style={[styles.summaryLabel, { color: colors.danger }]}>Amount due</Text>
            <Text style={[styles.summaryValue, { color: colors.danger }]}>{formatCurrency(totals.due, currency)}</Text>
          </View>
        </View>

        <SearchField placeholder="Search customer or job number" value={search} onChangeText={setSearch} />
        <SegmentedTabs
          value={filter}
          onChange={setFilter}
          options={[
            { label: 'All', value: 'all' },
            { label: 'Open', value: 'open' },
            { label: 'Ready', value: 'ready' },
            { label: 'Closed', value: 'closed' },
          ]}
        />

        {!servicesQuery.isLoading && !visibleServices.length ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.accentSoft }]}>
              <MaterialCommunityIcons name="tools" size={28} color={colors.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {services.length ? 'No matching jobs' : 'No service jobs yet'}
            </Text>
            <Text style={[styles.emptyCopy, { color: colors.textMuted }]}>
              {services.length
                ? 'Try a different search or status filter.'
                : 'Create a job with the customer first, then add labor and parts.'}
            </Text>
          </View>
        ) : null}

        <View style={styles.list}>
          {visibleServices.map((service) => {
            const display = getServiceDisplay(service, isGym);
            const tone = getToneColors(display.tone, colors);
            const due = dueAmount(service.grandTotal, service.receivedTotal);
            const name = service.partyName || 'Walk-in';
            return (
              <Pressable
                key={service.id}
                onPress={() => openService(service.id)}
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
                    <View style={[styles.badge, { backgroundColor: tone.backgroundColor }]}>
                      <Text style={[styles.badgeText, { color: tone.color }]}>{display.label}</Text>
                    </View>
                  </View>
                  <Text style={[styles.rowMeta, { color: colors.textMuted }]} numberOfLines={1}>
                    {[service.orderNo || 'No job no.', `${isGym ? 'Expiry' : 'Due'} ${prettyDate(service.deliveryDate)}`]
                      .filter(Boolean)
                      .join('  ·  ')}
                  </Text>
                </View>
                <View style={styles.amountWrap}>
                  <Text style={[styles.amount, { color: due > 0 ? colors.danger : colors.text }]}>
                    {formatCurrency(due > 0 ? due : service.grandTotal, currency)}
                  </Text>
                  <Text style={[styles.rowMeta, { color: colors.textSoft }]}>
                    {due > 0 ? 'Due' : 'Paid'}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <BottomSheet
        visible={Boolean(selectedServiceId)}
        title={serviceDetail?.partyName || serviceDetail?.orderNo || 'Service details'}
        subtitle={
          serviceDetail
            ? `${serviceDetail.orderNo || 'Job'} · ${selectedDisplay?.label ?? ''}`
            : 'Update status or payment.'
        }
        onClose={() => setSelectedServiceId(null)}
        fullHeight
        footer={
          <View style={styles.footerActions}>
            <Pressable style={styles.secondaryButton} onPress={confirmRemoveService}>
              <Text style={styles.secondaryLabel}>Delete</Text>
            </Pressable>
            <Pressable style={styles.primaryButton} onPress={() => void saveServiceUpdate()}>
              <Text style={styles.primaryLabel}>Save update</Text>
            </Pressable>
          </View>
        }>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetContent}>
          <SurfaceCard
            title="Job summary"
            subtitle={serviceDetail?.notes || 'No notes added yet.'}>
            <Text style={styles.helperText}>
              {isGym ? 'Expiry' : 'Delivery'}: {prettyDate(serviceDetail?.deliveryDate)}
              {'  ·  '}
              Total {formatCurrency(Number(serviceDetail?.grandTotal ?? 0), currency)}
              {'  ·  '}
              Due {formatCurrency(dueAmount(Number(serviceDetail?.grandTotal ?? 0), Number(serviceDetail?.receivedTotal ?? 0)), currency)}
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
          <SurfaceCard title="Items" subtitle="Labor and parts on this job.">
            <View style={styles.itemList}>
              {(serviceDetail?.items ?? []).map((item, index) => (
                <View key={`${serviceDetail?.id}-${index}`} style={styles.itemRow}>
                  <Text style={styles.itemTitle}>{item.description || item.productId || item.itemType}</Text>
                  <Text style={styles.itemAmount}>{formatCurrency(item.lineTotal, currency)}</Text>
                </View>
              ))}
              {!serviceDetail?.items?.length ? (
                <Text style={styles.helperText}>No line items on this job.</Text>
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
