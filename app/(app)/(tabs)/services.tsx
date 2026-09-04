import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
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
import { useBanks, useParties, useServiceById, useServicesList } from '@/src/shared/hooks/useAppQueries';
import { useDebouncedValue } from '@/src/shared/hooks/useDebouncedValue';
import { radius, shadows, spacing, typography } from '@/src/theme';
import type { Party, Service, ServiceStatus } from '@/src/types/models';
import { useAuthStore } from '@/src/stores/auth-store';
import { usePalette } from '@/src/stores/theme-store';
import { useThemedStyles } from '@/src/theme/use-themed-styles';
import type { AppPalette } from '@/src/theme/app-palette';

type ServiceFilter = 'all' | 'in_progress' | 'overdue' | 'closed';
type StatusTone = 'info' | 'warning' | 'success' | 'danger' | 'muted';

function dueAmount(total: number, paid: number) {
  return Math.max(0, Number(total || 0) - Number(paid || 0));
}

function isClosedStatus(status: string) {
  return ['closed', 'completed', 'delivered', 'cancelled'].includes(String(status || '').toLowerCase());
}

function isOverdue(service: Service) {
  if (isClosedStatus(service.status) || !service.deliveryDate || !service.deliveryDate.trim()) return false;
  const date = new Date(service.deliveryDate);
  return Number.isFinite(date.getTime()) && date < new Date();
}

function getServiceDisplay(service: Service, isGym: boolean) {
  if (isClosedStatus(service.status)) {
    return {
      label: isGym ? 'Completed' : 'Closed',
      tone: 'muted' as StatusTone,
      icon: 'check-circle-outline' as const,
    };
  }
  if (isOverdue(service)) {
    return {
      label: isGym ? 'Expired' : 'Overdue',
      tone: 'danger' as StatusTone,
      icon: 'alert-circle-outline' as const,
    };
  }
  return {
    label: isGym ? 'Active' : 'In Progress',
    tone: 'warning' as StatusTone,
    icon: 'progress-wrench' as const,
  };
}

function getToneColors(tone: StatusTone, colors: AppPalette) {
  if (tone === 'danger') return { bg: colors.dangerSoft, text: colors.danger, border: colors.danger };
  if (tone === 'success') return { bg: colors.successSoft, text: colors.success, border: colors.success };
  if (tone === 'warning') return { bg: colors.warningSoft, text: colors.warning, border: colors.warning };
  if (tone === 'info') return { bg: colors.accentSoft, text: colors.accent, border: colors.accent };
  return { bg: colors.backgroundAlt, text: colors.textMuted, border: colors.border };
}

function resolveServiceCustomer(service: Service, partyMap?: Map<string, Party>) {
  const directParty = (service as any).party || (service as any).Party || (service as any).customer;
  const directName = service.partyName || directParty?.name || (service as any).customerName;
  const directPhone = directParty?.phone || (service as any).customerPhone || (service as any).phone;

  if (service.partyId && partyMap?.has(service.partyId)) {
    const matched = partyMap.get(service.partyId)!;
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

function getServiceDeviceOrProblem(service: Service): string {
  const attrs = service.attributes || {};
  const candidates = [
    attrs.device,
    attrs.deviceName,
    attrs.model,
    attrs.brand,
    attrs.vehicleNo,
    attrs.problem,
    attrs.issue,
    attrs.serviceType,
    service.notes,
  ].filter(Boolean);

  if (candidates.length) {
    return String(candidates.slice(0, 2).join(' · '));
  }

  if (service.items?.length) {
    return service.items.map((i) => i.description || i.productId || i.itemType).slice(0, 2).join(', ');
  }

  return 'General Service Job';
}

function matchesFilter(service: Service, filter: ServiceFilter) {
  if (filter === 'all') return true;
  if (filter === 'closed') return isClosedStatus(service.status);
  if (filter === 'overdue') return isOverdue(service);
  return !isClosedStatus(service.status) && !isOverdue(service);
}

export default function ServicesScreen() {
  const colors = usePalette();
  const styles = useThemedStyles(createStyles);
  const queryClient = useQueryClient();
  const currency = useAuthStore((state) => state.businessProfile?.currencyCode) || 'NPR';
  const { businessProfile } = useAuthStore();
  const isGym = businessProfile?.businessType === 'gym' || businessProfile?.type === 'gym';

  const servicesQuery = useServicesList();
  const partiesQuery = useParties('', 'both');
  const { data: banks } = useBanks();
  const activeBanks = useMemo(() => (banks ?? []).filter((bank) => bank.isActive), [banks]);

  const partyMap = useMemo(() => {
    return new Map((partiesQuery.data ?? []).map((p) => [p.id, p]));
  }, [partiesQuery.data]);

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ServiceFilter>('all');
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const { data: serviceDetail, isLoading: isDetailLoading } = useServiceById(selectedServiceId ?? undefined);

  const [statusDraft, setStatusDraft] = useState<ServiceStatus>('in_progress');
  const [receivedDraft, setReceivedDraft] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank'>('cash');
  const [bankId, setBankId] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const debouncedSearch = useDebouncedValue(search);

  const services = servicesQuery.data ?? [];

  const counts = useMemo(() => {
    let inProgress = 0;
    let overdue = 0;
    let closed = 0;
    let totalDue = 0;

    for (const service of services) {
      const due = dueAmount(service.grandTotal, service.receivedTotal);
      totalDue += due;

      if (isClosedStatus(service.status)) {
        closed += 1;
      } else if (isOverdue(service)) {
        overdue += 1;
      } else {
        inProgress += 1;
      }
    }

    return {
      all: services.length,
      inProgress,
      overdue,
      closed,
      totalDue,
    };
  }, [services]);

  const visibleServices = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    return services.filter((service) => {
      if (!matchesFilter(service, filter)) return false;
      if (!query) return true;

      const customer = resolveServiceCustomer(service, partyMap);
      const searchTargets = [
        service.orderNo,
        customer.name,
        customer.phone,
        service.notes,
        service.status,
        getServiceDeviceOrProblem(service),
      ]
        .filter(Boolean)
        .map((val) => String(val).toLowerCase());

      return searchTargets.some((target) => target.includes(query));
    });
  }, [debouncedSearch, filter, partyMap, services]);

  function openService(serviceId: string) {
    setSelectedServiceId(serviceId);
    const selected = services.find((entry) => entry.id === serviceId);
    setStatusDraft(selected?.status ?? 'in_progress');
    setReceivedDraft(String(selected?.receivedTotal ?? 0));
    setPaymentMethod((selected?.paymentMethod as 'cash' | 'bank') ?? 'cash');
    setBankId(selected?.bankId ?? '');
  }

  async function handleQuickStatus(service: Service, nextStatus: ServiceStatus) {
    try {
      await servicesApi.update(service.id, { status: nextStatus });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['services-list'] }),
        queryClient.invalidateQueries({ queryKey: ['recent-services'] }),
      ]);
    } catch (error) {
      Alert.alert('Unable to update status', error instanceof Error ? error.message : 'Please try again.');
    }
  }

  async function saveServiceUpdate() {
    if (!selectedServiceId) return;
    setUpdatingStatus(true);
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
    } finally {
      setUpdatingStatus(false);
    }
  }

  function confirmRemoveService() {
    Alert.alert('Delete this service job?', 'This will remove the job and all associated records.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete Job',
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

  const selectedCustomer = serviceDetail ? resolveServiceCustomer(serviceDetail, partyMap) : null;
  const selectedDisplay = serviceDetail ? getServiceDisplay(serviceDetail, isGym) : null;
  const selectedDue = serviceDetail ? dueAmount(Number(serviceDetail.grandTotal || 0), Number(serviceDetail.receivedTotal || 0)) : 0;

  return (
    <Screen
      scrollable={false}
      padded={false}
      topBarTitle={isGym ? 'Memberships & Services' : 'Service Jobs'}
      footer={
        <StickyActionBar
          primary={{
            label: isGym ? 'New Membership' : 'Create Service Job',
            onPress: () => router.push('/(app)/service-create'),
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
            refreshing={servicesQuery.isRefetching || partiesQuery.isRefetching}
            onRefresh={() => {
              void servicesQuery.refetch();
              void partiesQuery.refetch();
            }}
          />
        }
        contentContainerStyle={styles.scroll}>
        
        {/* KPI Summary Dashboard Tiles */}
        <View style={styles.statsGrid}>
          <View style={[styles.statTile, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.statIconBox, { backgroundColor: colors.warningSoft }]}>
              <MaterialCommunityIcons name="progress-wrench" size={20} color={colors.warning} />
            </View>
            <Text style={[styles.statValue, { color: colors.warning }]}>{counts.inProgress}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>In Progress</Text>
          </View>

          <View style={[styles.statTile, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.statIconBox, { backgroundColor: colors.dangerSoft }]}>
              <MaterialCommunityIcons name="clock-alert-outline" size={20} color={colors.danger} />
            </View>
            <Text style={[styles.statValue, { color: colors.danger }]}>{counts.overdue}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Overdue</Text>
          </View>

          <View style={[styles.statTile, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.statIconBox, { backgroundColor: colors.accentSoft }]}>
              <MaterialCommunityIcons name="check-circle-outline" size={20} color={colors.accent} />
            </View>
            <Text style={[styles.statValue, { color: colors.text }]}>{counts.closed}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Closed</Text>
          </View>

          <View style={[styles.statTile, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.statIconBox, { backgroundColor: colors.infoSoft }]}>
              <MaterialCommunityIcons name="cash-multiple" size={20} color={colors.info} />
            </View>
            <Text style={[styles.statValue, { color: colors.text }]} numberOfLines={1}>
              {formatCurrency(counts.totalDue, currency)}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Pending Due</Text>
          </View>
        </View>

        {/* Live Search and Filters */}
        <SearchField
          placeholder="Search by customer name, phone, or job #"
          value={search}
          onChangeText={setSearch}
        />

        <SegmentedTabs
          value={filter}
          onChange={setFilter}
          options={[
            { label: `All (${counts.all})`, value: 'all' },
            { label: `In Progress (${counts.inProgress})`, value: 'in_progress' },
            { label: `Overdue (${counts.overdue})`, value: 'overdue' },
            { label: `Closed (${counts.closed})`, value: 'closed' },
          ]}
        />

        {/* Empty State */}
        {!servicesQuery.isLoading && !visibleServices.length ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.accentSoft }]}>
              <MaterialCommunityIcons name="tools" size={32} color={colors.accent} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {services.length ? 'No matching service jobs' : 'No service jobs yet'}
            </Text>
            <Text style={[styles.emptyCopy, { color: colors.textMuted }]}>
              {services.length
                ? 'Try a different customer name, phone number, or status filter.'
                : 'Create your first service job to track repairs, customer items, labor, and balance due.'}
            </Text>
            <Pressable
              style={[styles.emptyActionBtn, { backgroundColor: colors.primary }]}
              onPress={() => router.push('/(app)/service-create')}>
              <Text style={styles.emptyActionBtnText}>Create New Job</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Services Job List */}
        <View style={styles.list}>
          {visibleServices.map((service) => {
            const customer = resolveServiceCustomer(service, partyMap);
            const display = getServiceDisplay(service, isGym);
            const tone = getToneColors(display.tone, colors);
            const due = dueAmount(service.grandTotal, service.receivedTotal);
            const specs = getServiceDeviceOrProblem(service);
            const isFinished = isClosedStatus(service.status);

            return (
              <Pressable
                key={service.id}
                onPress={() => openService(service.id)}
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
                        {service.orderNo ? (
                          <View style={[styles.orderNoPill, { backgroundColor: colors.backgroundAlt }]}>
                            <Text style={[styles.orderNoText, { color: colors.textMuted }]}>
                              #{service.orderNo}
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

                {/* Specs / Device / Problem description */}
                <View style={[styles.specsBox, { backgroundColor: colors.backgroundAlt }]}>
                  <MaterialCommunityIcons name="wrench-outline" size={16} color={colors.accent} />
                  <Text style={[styles.specsText, { color: colors.text }]} numberOfLines={2}>
                    {specs}
                  </Text>
                </View>

                {/* Timeline and Line Items Meta */}
                <View style={styles.metaRow}>
                  <View style={styles.metaItem}>
                    <MaterialCommunityIcons name="calendar-clock" size={14} color={colors.textMuted} />
                    <Text style={[styles.metaText, { color: isOverdue(service) ? colors.danger : colors.textMuted }]}>
                      {service.deliveryDate
                        ? `${isGym ? 'Expiry' : 'Due'}: ${prettyDate(service.deliveryDate)}`
                        : 'No delivery date'}
                    </Text>
                  </View>
                  {service.items?.length ? (
                    <View style={styles.metaItem}>
                      <MaterialCommunityIcons name="format-list-bulleted" size={14} color={colors.textMuted} />
                      <Text style={[styles.metaText, { color: colors.textMuted }]}>
                        {service.items.length} {service.items.length === 1 ? 'item' : 'items'}
                      </Text>
                    </View>
                  ) : null}
                </View>

                {/* Financial Strip & Action Row */}
                <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
                  <View style={styles.financialCol}>
                    <Text style={[styles.grandTotalLabel, { color: colors.textMuted }]}>
                      Total: <Text style={{ color: colors.text, fontWeight: '700' }}>{formatCurrency(service.grandTotal, currency)}</Text>
                    </Text>
                    <Text
                      style={[
                        styles.dueAmount,
                        { color: due > 0 ? colors.danger : colors.success },
                      ]}>
                      {due > 0 ? `Due: ${formatCurrency(due, currency)}` : 'Fully Paid'}
                    </Text>
                  </View>

                  {/* Quick Action Pills */}
                  <View style={styles.quickActions}>
                    {!isFinished ? (
                      <Pressable
                        style={[styles.quickActionBtn, { backgroundColor: colors.accentSoft }]}
                        onPress={() => void handleQuickStatus(service, 'closed')}>
                        <Text style={[styles.quickActionText, { color: colors.accent }]}>
                          {isGym ? 'Complete' : 'Close Job'}
                        </Text>
                      </Pressable>
                    ) : (
                      <Pressable
                        style={[styles.quickActionBtn, { backgroundColor: colors.backgroundAlt }]}
                        onPress={() => void handleQuickStatus(service, 'in_progress')}>
                        <Text style={[styles.quickActionText, { color: colors.textMuted }]}>Reopen</Text>
                      </Pressable>
                    )}

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

      {/* Service Detail and Payment Sheet */}
      <BottomSheet
        visible={Boolean(selectedServiceId)}
        title={selectedCustomer?.name || serviceDetail?.orderNo || 'Job Details'}
        subtitle={
          serviceDetail
            ? `Order #${serviceDetail.orderNo || 'N/A'} · ${selectedDisplay?.label ?? ''}`
            : 'Service update'
        }
        onClose={() => setSelectedServiceId(null)}
        fullHeight
        footer={
          <View style={styles.footerActions}>
            <Pressable style={[styles.secondaryButton, { backgroundColor: colors.dangerSoft }]} onPress={confirmRemoveService}>
              <Text style={[styles.secondaryLabel, { color: colors.danger }]}>Delete</Text>
            </Pressable>
            <Pressable
              disabled={updatingStatus}
              style={[styles.primaryButton, { backgroundColor: colors.primary }]}
              onPress={() => void saveServiceUpdate()}>
              {updatingStatus ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.primaryLabel}>Save Updates</Text>
              )}
            </Pressable>
          </View>
        }>
        {isDetailLoading || !serviceDetail ? (
          <View style={styles.detailLoadingWrap}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.helperText, { marginTop: spacing.sm }]}>Loading job details...</Text>
          </View>
        ) : (
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
                    {selectedCustomer?.phone || 'No phone number provided'}
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

            {/* Status Selector */}
            <View style={styles.formSection}>
              <Text style={[styles.formSectionTitle, { color: colors.text }]}>Update Status</Text>
              <SegmentedTabs
                value={statusDraft === 'closed' ? 'closed' : 'in_progress'}
                onChange={(value) => setStatusDraft(value as ServiceStatus)}
                options={[
                  { label: 'In Progress', value: 'in_progress' },
                  { label: isGym ? 'Completed' : 'Closed', value: 'closed' },
                ]}
              />
            </View>

            {/* Payment & Balance Due */}
            <SurfaceCard
              title="Bill & Payment"
              subtitle={`Grand Total: ${formatCurrency(Number(serviceDetail.grandTotal || 0), currency)} · Balance Due: ${formatCurrency(selectedDue, currency)}`}>
              <FormField
                label="Total Amount Received (रू)"
                value={receivedDraft}
                onChangeText={setReceivedDraft}
                keyboardType="numeric"
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
                      <Text style={styles.emptyBankText}>No active bank found. Tap to add a bank account.</Text>
                    </Pressable>
                  )}
                </View>
              ) : null}
            </SurfaceCard>

            {/* Itemized Parts and Labor */}
            <SurfaceCard title="Line Items & Parts" subtitle={`${serviceDetail.items?.length || 0} items attached`}>
              <View style={styles.itemList}>
                {(serviceDetail.items ?? []).map((item, index) => (
                  <View key={`${serviceDetail.id}-${index}`} style={[styles.itemRow, { backgroundColor: colors.backgroundAlt }]}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={[styles.itemTitle, { color: colors.text }]}>
                        {item.description || item.productId || item.itemType}
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
                {!serviceDetail.items?.length ? (
                  <Text style={styles.helperText}>No individual parts or labor added.</Text>
                ) : null}
              </View>
            </SurfaceCard>

            {/* Attached Photos & Documents */}
            {(() => {
              const attachments = (
                serviceDetail.attachments?.length
                  ? serviceDetail.attachments
                  : serviceDetail.attachment
                    ? [serviceDetail.attachment]
                    : []
              ).filter(Boolean);

              if (!attachments.length) return null;

              return (
                <SurfaceCard title="Attached Photos" subtitle={`${attachments.length} photo${attachments.length === 1 ? '' : 's'} uploaded`}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.attachmentGallery}>
                    {attachments.map((uri, idx) => (
                      <Pressable
                        key={`${uri}-${idx}`}
                        style={[styles.attachmentThumbCard, { borderColor: colors.border }]}
                        onPress={() => setPreviewImage(uri)}>
                        <Image source={{ uri }} style={styles.attachmentImg} resizeMode="cover" />
                      </Pressable>
                    ))}
                  </ScrollView>
                </SurfaceCard>
              );
            })()}

            {/* Notes and Dates */}
            <SurfaceCard title="Job Timeline & Notes">
              <View style={styles.timelineRow}>
                <Text style={[styles.helperText, { color: colors.textMuted }]}>
                  {isGym ? 'Expiry Date' : 'Target Delivery'}: <Text style={{ fontWeight: '700', color: colors.text }}>{prettyDate(serviceDetail.deliveryDate)}</Text>
                </Text>
              </View>
              {serviceDetail.notes ? (
                <Text style={[styles.notesText, { color: colors.text }]}>
                  {serviceDetail.notes}
                </Text>
              ) : (
                <Text style={[styles.helperText, { color: colors.textSoft }]}>No notes provided.</Text>
              )}
            </SurfaceCard>
          </View>
        )}
      </BottomSheet>

      {/* Full-Screen Image Preview Modal */}
      <Modal visible={Boolean(previewImage)} transparent animationType="fade" onRequestClose={() => setPreviewImage(null)}>
        <View style={styles.imageModalBackdrop}>
          <Pressable style={styles.closeModalBtn} onPress={() => setPreviewImage(null)}>
            <MaterialCommunityIcons name="close" size={26} color="#ffffff" />
          </Pressable>
          {previewImage ? (
            <Image source={{ uri: previewImage }} style={styles.modalImage} resizeMode="contain" />
          ) : null}
        </View>
      </Modal>
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
    specsBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: radius.sm,
    },
    specsText: {
      fontSize: typography.caption,
      fontWeight: '600',
      flex: 1,
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
    attachmentGallery: {
      gap: spacing.sm,
      paddingVertical: spacing.xs,
    },
    attachmentThumbCard: {
      width: 100,
      height: 100,
      borderRadius: radius.md,
      overflow: 'hidden',
      borderWidth: 1,
    },
    attachmentImg: {
      width: '100%',
      height: '100%',
    },
    imageModalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.92)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.md,
    },
    modalImage: {
      width: '100%',
      height: '80%',
    },
    closeModalBtn: {
      position: 'absolute',
      top: 50,
      right: 20,
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10,
    },
  });
