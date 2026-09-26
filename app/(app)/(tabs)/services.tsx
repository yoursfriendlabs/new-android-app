import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { servicesApi } from '@/src/api';
import { SkeletonList } from '@/src/shared/ui/Skeleton';
import { useToast } from '@/src/shared/feedback/ToastProvider';
import { Screen } from '@/src/shared/layout/Screen';
import { SearchField } from '@/src/shared/ui/SearchField';
import { SegmentedTabs } from '@/src/shared/ui/SegmentedTabs';
import { StickyActionBar } from '@/src/shared/ui/StickyActionBar';
import { formatCurrency, prettyDate } from '@/src/shared/lib/format';
import { buildServiceReceipt, openReceiptPreview } from '@/src/shared/lib/receipt';
import { partyInitials } from '@/src/features/parties/lib/party';
import {
  dueAmount,
  getServiceDeviceOrProblem,
  getServiceDisplay,
  getToneColors,
  isClosedStatus,
  isOverdue,
  resolveServiceCustomer,
} from '@/src/features/services/lib/service-view';
import {
  useBanks,
  usePagedServices,
  useParties,
  useServiceStats,
} from '@/src/shared/hooks/useAppQueries';
import { ListFooterLoader, loadMoreOnScroll } from '@/src/shared/ui/ListFooterLoader';
import { useDebouncedValue } from '@/src/shared/hooks/useDebouncedValue';
import { radius, shadows, spacing, typography } from '@/src/theme';
import type { Service, ServiceStatus } from '@/src/types/models';
import { useAuthStore } from '@/src/stores/auth-store';
import { usePalette } from '@/src/stores/theme-store';
import { useThemedStyles } from '@/src/theme/use-themed-styles';
import type { AppPalette } from '@/src/theme/app-palette';

type ServiceFilter = 'all' | 'in_progress' | 'overdue' | 'closed';

const SERVER_STAGE: Record<ServiceFilter, 'open' | 'overdue' | 'closed' | undefined> = {
  all: undefined,
  in_progress: 'open',
  overdue: 'overdue',
  closed: 'closed',
};

function matchesFilter(service: Service, filter: ServiceFilter) {
  if (filter === 'all') return true;
  if (filter === 'closed') return isClosedStatus(service.status);
  if (filter === 'overdue') return isOverdue(service);
  return !isClosedStatus(service.status) && !isOverdue(service);
}

export default function ServicesScreen() {
  const colors = usePalette();
  const toast = useToast();
  const styles = useThemedStyles(createStyles);
  const queryClient = useQueryClient();
  const currency = useAuthStore((state) => state.businessProfile?.currencyCode) || 'NPR';
  const { businessProfile } = useAuthStore();
  const isGym = businessProfile?.businessType === 'gym' || businessProfile?.type === 'gym';

  const partiesQuery = useParties('', 'both');
  const { data: banks } = useBanks();

  const partyMap = useMemo(() => {
    return new Map((partiesQuery.data ?? []).map((p) => [p.id, p]));
  }, [partiesQuery.data]);

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ServiceFilter>('all');
  const debouncedSearch = useDebouncedValue(search);
  const servicesQuery = usePagedServices({ stage: SERVER_STAGE[filter], search: debouncedSearch });
  const statsQuery = useServiceStats();

  const services = servicesQuery.items;

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

    // Loaded rows are only a page; prefer the server's counts when it sends them.
    const stats = statsQuery.data;
    if (stats) {
      const finished = Number(stats.finishedCount ?? 0);
      const overdueCount = Number(stats.overdueCount ?? 0);
      const total = Number(stats.totalOrders ?? 0);
      return {
        all: total,
        inProgress: Math.max(0, total - finished - overdueCount),
        overdue: overdueCount,
        closed: finished,
        totalDue: Number(stats.pendingCollection ?? 0),
      };
    }

    return {
      all: services.length,
      inProgress,
      overdue,
      closed,
      totalDue,
    };
  }, [services, statsQuery.data]);

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
    router.push({ pathname: '/(app)/service-detail' as any, params: { id: serviceId } });
  }

  function handlePrintService(service: Service) {
    const customer = resolveServiceCustomer(service, partyMap);
    const selectedBank = banks?.find((b) => b.id === service.bankId);
    const receipt = buildServiceReceipt(
      service,
      businessProfile,
      customer.party || { name: customer.name, phone: customer.phone, address: customer.address },
      selectedBank?.name
    );
    openReceiptPreview(receipt);
  }

  async function handleQuickStatus(service: Service, nextStatus: ServiceStatus) {
    try {
      await servicesApi.update(service.id, { status: nextStatus });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['services-list'] }),
        queryClient.invalidateQueries({ queryKey: ['recent-services'] }),
      ]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Please try again.');
    }
  }

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
        {...loadMoreOnScroll(servicesQuery.loadMore)}
        refreshControl={
          <RefreshControl
            refreshing={servicesQuery.isRefreshing}
            onRefresh={() => {
              void servicesQuery.refetch();
              void statsQuery.refetch();
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
        {servicesQuery.isLoading ? <SkeletonList count={5} /> : null}
        {!servicesQuery.isLoading && !visibleServices.length && !servicesQuery.hasNextPage ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.accentSoft }]}>
              <MaterialCommunityIcons name="tools" size={32} color={colors.accent} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {debouncedSearch.trim() || filter !== 'all' ? 'No matching service jobs' : 'No service jobs yet'}
            </Text>
            <Text style={[styles.emptyCopy, { color: colors.textMuted }]}>
              {debouncedSearch.trim() || filter !== 'all'
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
                      <Text style={[styles.avatarText, { color: colors.onPrimary }]}>
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
                {specs ? (
                  <View style={[styles.specsBox, { backgroundColor: colors.backgroundAlt }]}>
                    <MaterialCommunityIcons name="wrench-outline" size={16} color={colors.accent} />
                    <Text style={[styles.specsText, { color: colors.text }]} numberOfLines={2}>
                      {specs}
                    </Text>
                  </View>
                ) : null}

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
                    <Pressable
                      style={[styles.callBtn, { backgroundColor: colors.backgroundAlt }]}
                      onPress={(e) => {
                        e.stopPropagation();
                        handlePrintService(service);
                      }}
                      accessibilityLabel="Print Bill">
                      <MaterialCommunityIcons name="printer-outline" size={16} color={colors.primary} />
                    </Pressable>

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
        <ListFooterLoader list={servicesQuery} />
      </ScrollView>

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
      color: colors.onPrimary,
      fontWeight: '800',
      fontSize: typography.body,
    },
  });
