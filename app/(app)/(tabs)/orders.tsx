import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { Screen } from '@/src/components/layout/Screen';
import { SurfaceCard } from '@/src/components/ui/SurfaceCard';
import { useSalesList, useTables, useCategories } from '@/src/hooks/useAppQueries';
import { salesApi } from '@/src/api';
import {
  buildCafeOrderAttributes,
  buildCafeTableMap,
  CAFE_ORDER_STATUSES,
  getCafeOrderAttributes,
  getCafeOrderStatusMeta,
  getCafeOrderTypeLabel,
  getCafePaymentMeta,
  getNextCafeOrderStatus,
} from '@/src/lib/cafeOrders';
import { formatCurrency } from '@/src/lib/format';
import { palette, radius, spacing, typography } from '@/src/theme';
import type { Sale } from '@/src/types/models';

export default function SeatingOrdersScreen() {
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<'floor' | 'board'>('floor');
  const [selectedStatus, setSelectedStatus] = useState<string>('new');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [floorFilter, setFloorFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Queries
  const { data: tables = [], isLoading: loadingTables } = useTables();
  const { data: sales = [], isLoading: loadingSales } = useSalesList({ limit: 120 });
  const { data: categories = [] } = useCategories();

  const isLoading = loadingTables || loadingSales;

  const floors = useMemo(() => {
    return categories.filter((cat: any) => cat.type === 'table');
  }, [categories]);

  // Derive Table Map
  const tableMap = useMemo(() => {
    return buildCafeTableMap(sales, tables.map(t => ({ 
      id: t.id, 
      label: t.name,
      categoryId: t.categoryId,
      category: t.category,
      capacity: t.capacity
    })));
  }, [sales, tables]);

  const filteredTableMap = useMemo(() => {
    return tableMap.filter((t) => {
      const currentTable = tables.find(tbl => tbl.id === t.id);
      const catId = currentTable?.categoryId;
      const hasCategory = currentTable?.category;

      if (floorFilter !== 'all') {
        if (floorFilter === 'unassigned') {
          if (catId || hasCategory) return false;
        } else {
          if (String(catId) !== String(floorFilter)) return false;
        }
      }

      if (statusFilter !== 'all') {
        const isOccupied = t.occupied;
        if (statusFilter === 'vacant' && isOccupied) return false;
        if (statusFilter === 'occupied' && !isOccupied) return false;
      }

      return true;
    });
  }, [tableMap, tables, floorFilter, statusFilter]);

  // Derive Orders for Board
  const activeOrders = useMemo(() => {
    return sales.filter((sale) => {
      const meta = getCafeOrderAttributes(sale);
      return meta.orderStatus !== 'completed';
    });
  }, [sales]);

  const groupedOrders = useMemo(() => {
    return CAFE_ORDER_STATUSES.map((status) => {
      const items = sales.filter((sale) => {
        const meta = getCafeOrderAttributes(sale);
        return meta.orderStatus === status.value;
      });
      return {
        ...status,
        items,
      };
    });
  }, [sales]);

  const activeGroup = useMemo(() => {
    return groupedOrders.find((g) => g.value === selectedStatus) || groupedOrders[0];
  }, [groupedOrders, selectedStatus]);

  async function handleAdvanceStatus(order: Sale) {
    const meta = getCafeOrderAttributes(order);
    const nextStatus = getNextCafeOrderStatus(meta.orderStatus);
    if (!nextStatus) return;

    setUpdatingId(order.id);
    try {
      const updatedAttributes = buildCafeOrderAttributes(order.attributes || {}, {
        orderStatus: nextStatus.value,
      });

      await salesApi.update(order.id, {
        attributes: updatedAttributes,
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['sales-list'] }),
        queryClient.invalidateQueries({ queryKey: ['recent-sales'] }),
      ]);
    } catch (error) {
      console.error('Failed to update order status', error);
    } finally {
      setUpdatingId(null);
    }
  }

  // Tapping a table navigates to POS screen passing params
  function handleTableTap(tableId: string) {
    router.push({
      pathname: '/(app)/(tabs)/pos',
      params: { tableId, ref: 'orders' },
    });
  }

  return (
    <Screen scrollable={false} padded={false} topBarTitle="Seating & Orders">
      {/* View Switcher Tabs */}
      <View style={styles.viewModeTabs}>
        <Pressable
          style={[styles.modeTab, viewMode === 'floor' && styles.modeTabActive]}
          onPress={() => setViewMode('floor')}>
          <MaterialCommunityIcons
            name="floor-plan"
            size={18}
            color={viewMode === 'floor' ? palette.primary : palette.textSoft}
          />
          <Text style={[styles.modeTabLabel, viewMode === 'floor' && styles.modeTabLabelActive]}>
            Floor Map
          </Text>
        </Pressable>
        <Pressable
          style={[styles.modeTab, viewMode === 'board' && styles.modeTabActive]}
          onPress={() => setViewMode('board')}>
          <MaterialCommunityIcons
            name="chef-hat"
            size={18}
            color={viewMode === 'board' ? palette.primary : palette.textSoft}
          />
          <Text style={[styles.modeTabLabel, viewMode === 'board' && styles.modeTabLabelActive]}>
            Orders Board
          </Text>
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.centerWrap}>
          <ActivityIndicator color={palette.primary} size="large" />
          <Text style={styles.loadingText}>Fetching Seating Map...</Text>
        </View>
      ) : viewMode === 'floor' ? (
        /* Floor Map View */
        <View style={{ flex: 1 }}>
          <View style={{ gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
            {/* Floor Filter Chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
              <Pressable
                style={[styles.filterChip, floorFilter === 'all' && styles.filterChipActive]}
                onPress={() => setFloorFilter('all')}
              >
                <Text style={[styles.filterChipLabel, floorFilter === 'all' && styles.filterChipLabelActive]}>
                  All Floors
                </Text>
              </Pressable>
              {floors.map((floor) => (
                <Pressable
                  key={floor.id}
                  style={[styles.filterChip, floorFilter === floor.id && styles.filterChipActive]}
                  onPress={() => setFloorFilter(floor.id)}
                >
                  <Text style={[styles.filterChipLabel, floorFilter === floor.id && styles.filterChipLabelActive]}>
                    {floor.name}
                  </Text>
                </Pressable>
              ))}
              <Pressable
                style={[styles.filterChip, floorFilter === 'unassigned' && styles.filterChipActive]}
                onPress={() => setFloorFilter('unassigned')}
              >
                <Text style={[styles.filterChipLabel, floorFilter === 'unassigned' && styles.filterChipLabelActive]}>
                  Unassigned
                </Text>
              </Pressable>
            </ScrollView>

            {/* Status Filter Chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
              <Pressable
                style={[styles.filterChip, statusFilter === 'all' && styles.filterChipActive]}
                onPress={() => setStatusFilter('all')}
              >
                <Text style={[styles.filterChipLabel, statusFilter === 'all' && styles.filterChipLabelActive]}>
                  All Statuses
                </Text>
              </Pressable>
              <Pressable
                style={[styles.filterChip, statusFilter === 'vacant' && styles.filterChipActive]}
                onPress={() => setStatusFilter('vacant')}
              >
                <Text style={[styles.filterChipLabel, statusFilter === 'vacant' && styles.filterChipLabelActive]}>
                  Vacant
                </Text>
              </Pressable>
              <Pressable
                style={[styles.filterChip, statusFilter === 'occupied' && styles.filterChipActive]}
                onPress={() => setStatusFilter('occupied')}
              >
                <Text style={[styles.filterChipLabel, statusFilter === 'occupied' && styles.filterChipLabelActive]}>
                  Occupied
                </Text>
              </Pressable>
            </ScrollView>
          </View>

          <FlatList
            data={filteredTableMap}
            keyExtractor={(item) => item.id}
            numColumns={2}
            contentContainerStyle={styles.floorGrid}
            renderItem={({ item }) => {
              const currentTable = tables.find(t => t.id === item.id);
              const capacity = currentTable?.capacity;
              const statusMeta = item.statusMeta;
              const matchedFloor = floors.find((f) => f.id === currentTable?.categoryId);
              const floorName = currentTable?.category?.name || matchedFloor?.name || 'No Floor';

              return (
                <Pressable
                  style={[
                    styles.tableCard,
                    item.occupied ? styles.tableCardOccupied : styles.tableCardVacant,
                  ]}
                  onPress={() => handleTableTap(item.id)}>
                  <View style={styles.tableCardHeader}>
                    <Text numberOfLines={1} ellipsizeMode="tail" style={styles.tableLabel}>{item.label}</Text>
                    <View
                      style={[
                        styles.indicatorDot,
                        { backgroundColor: item.occupied && statusMeta ? getStatusDotColor(statusMeta.value) : '#cbd5e1' },
                      ]}
                    />
                  </View>

                  {capacity ? (
                    <View style={styles.metaRow}>
                      <MaterialCommunityIcons name="account-multiple" size={14} color={palette.textMuted} />
                      <Text style={styles.metaText}>Seats: {capacity}</Text>
                    </View>
                  ) : null}

                  {/* Floor badge inline indicator */}
                  <View style={styles.floorBadgeRow}>
                    <MaterialCommunityIcons name="office-building" size={12} color={palette.textMuted} />
                    <Text numberOfLines={1} ellipsizeMode="tail" style={styles.floorBadgeLabel}>
                      {floorName}
                    </Text>
                  </View>

                  <Text
                    style={[
                      styles.statusBadge,
                      item.occupied ? styles.statusBadgeOccupied : styles.statusBadgeVacant,
                  ]}>
                  {item.occupied && statusMeta ? statusMeta.label : 'Available'}
                </Text>

                {item.occupied && item.orderMeta ? (
                  <View style={styles.occupiedDetails}>
                    {item.orderMeta.waiterName ? (
                      <Text style={styles.waiterText} numberOfLines={1}>
                        Waiter: {item.orderMeta.waiterName}
                      </Text>
                    ) : null}
                    {item.order ? (
                      <Text style={styles.billTotal}>
                        Bill: {formatCurrency(Number(item.order.grandTotal))}
                      </Text>
                    ) : null}
                  </View>
                ) : (
                  <Text style={styles.openSeatingText}>Open for seating</Text>
                )}
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <MaterialCommunityIcons name="table-off" size={48} color={palette.textMuted} />
              <Text style={styles.emptyTitle}>No tables defined</Text>
              <Text style={styles.emptySubtitle}>
                Add tables in Settings on the web dashboard to manage seating layout on mobile.
              </Text>
            </View>
          }
        />
        </View>
      ) : (
        /* Orders Board View */
        <View style={styles.boardContainer}>
          {/* Horizontal Status Filter Bar */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.boardFilterBar}>
            {groupedOrders.map((g) => {
              const isActive = selectedStatus === g.value;
              return (
                <Pressable
                  key={g.value}
                  style={[styles.filterChip, isActive && styles.filterChipActive]}
                  onPress={() => setSelectedStatus(g.value)}>
                  <Text
                    style={[styles.filterChipLabel, isActive && styles.filterChipLabelActive]}>
                    {g.label} ({g.items.length})
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Orders list for selected status */}
          <FlatList
            data={activeGroup.items}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.ordersList}
            renderItem={({ item }) => {
              const meta = getCafeOrderAttributes(item);
              const paymentMeta = getCafePaymentMeta(item);
              const nextStatus = getNextCafeOrderStatus(meta.orderStatus);

              return (
                <SurfaceCard style={styles.orderCard}>
                  <View style={styles.orderCardHeader}>
                    <View>
                      <Text style={styles.orderInvoice} numberOfLines={1}>
                        {item.invoiceNo}
                      </Text>
                      <Text style={styles.orderTable}>
                        {meta.tableNo ? `Table: ${meta.tableNo}` : getCafeOrderTypeLabel(meta.orderType)}
                      </Text>
                    </View>
                    <View style={styles.badgeRow}>
                      <Text style={[styles.paymentBadge, paymentMeta.label === 'Paid' ? styles.badgePaid : styles.badgeUnpaid]}>
                        {paymentMeta.label}
                      </Text>
                    </View>
                  </View>

                  {/* Items summary */}
                  <View style={styles.itemsSummary}>
                    {item.items.map((line, idx) => (
                      <Text key={idx} style={styles.itemLine}>
                        • {line.quantity}x {String(line.name || 'Product')}
                      </Text>
                    ))}
                  </View>

                  <View style={styles.orderActions}>
                    <Pressable
                      style={styles.pencilEditButton}
                      onPress={() => {
                        const tblId = item.tableId || meta.tableNo;
                        router.push({
                          pathname: '/(app)/(tabs)/pos',
                          params: { tableId: tblId, ref: 'orders' },
                        });
                      }}>
                      <MaterialCommunityIcons name="pencil" size={20} color={palette.primary} />
                      <Text style={styles.pencilEditText}>Edit POS</Text>
                    </Pressable>

                    {nextStatus ? (
                      <Pressable
                        disabled={updatingId === item.id}
                        style={[styles.advanceButton, { backgroundColor: getStatusColor(nextStatus.value) }]}
                        onPress={() => void handleAdvanceStatus(item)}>
                        {updatingId === item.id ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <>
                            <Text style={styles.advanceButtonText}>
                              To {nextStatus.label}
                            </Text>
                            <MaterialCommunityIcons name="chevron-right" size={16} color="#fff" />
                          </>
                        )}
                      </Pressable>
                    ) : null}
                  </View>
                </SurfaceCard>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <MaterialCommunityIcons name="chef-hat" size={48} color={palette.textMuted} />
                <Text style={styles.emptyTitle}>No orders in this stage</Text>
                <Text style={styles.emptySubtitle}>
                  Dine-in or takeaway orders saved with status "{activeGroup.label}" will appear here.
                </Text>
              </View>
            }
          />
        </View>
      )}
    </Screen>
  );
}

// Helpers for Colors
function getStatusDotColor(status: string) {
  switch (status) {
    case 'new':
      return '#64748b'; // slate-500
    case 'to_cook':
      return '#f59e0b'; // amber-500
    case 'ready':
      return '#10b981'; // emerald-500
    case 'completed':
      return '#94a3b8'; // slate-400
    default:
      return '#cbd5e1';
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case 'to_cook':
      return '#e97a1d'; // warm amber/orange
    case 'ready':
      return '#10b981'; // emerald
    case 'completed':
      return '#475569'; // dark slate
    default:
      return palette.primary;
  }
}

const styles = StyleSheet.create({
  viewModeTabs: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: '#f8fafc',
    gap: spacing.xs,
    minHeight: 48, // Touch target
  },
  modeTabActive: {
    backgroundColor: palette.accentSoft,
    borderWidth: 1,
    borderColor: palette.primary,
  },
  modeTabLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.textSoft,
  },
  modeTabLabelActive: {
    color: palette.primary,
    fontWeight: '700',
  },
  centerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  loadingText: {
    fontSize: 14,
    color: palette.textSoft,
  },
  floorGrid: {
    padding: spacing.md,
    gap: spacing.md,
  },
  tableCard: {
    flex: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    margin: spacing.xs,
    borderWidth: 1,
    minHeight: 135, // expanded to prevent cutoff
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
  },
  floorBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  floorBadgeLabel: {
    fontSize: 12,
    color: palette.textMuted,
  },
  chipsScroll: {
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  tableCardVacant: {
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
  },
  tableCardOccupied: {
    borderColor: palette.accentMuted,
    backgroundColor: '#fdfbf7',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  tableCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tableLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  indicatorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  metaText: {
    fontSize: 12,
    color: palette.textMuted,
  },
  statusBadge: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    marginTop: spacing.sm,
  },
  statusBadgeVacant: {
    backgroundColor: '#f1f5f9',
    color: '#475569',
  },
  statusBadgeOccupied: {
    backgroundColor: '#fef3c7',
    color: '#d97706',
  },
  occupiedDetails: {
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: spacing.xs,
    gap: 2,
  },
  waiterText: {
    fontSize: 11,
    color: palette.textSoft,
  },
  billTotal: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.primary,
  },
  openSeatingText: {
    fontSize: 11,
    color: palette.textMuted,
    fontStyle: 'italic',
    marginTop: spacing.sm,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl * 2,
    gap: spacing.md,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
  },
  emptySubtitle: {
    fontSize: 13,
    color: palette.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  boardContainer: {
    flex: 1,
  },
  boardFilterBar: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  filterChip: {
    paddingHorizontal: spacing.md + 4,
    paddingVertical: spacing.sm - 2,
    borderRadius: radius.pill,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 36,
  },
  filterChipActive: {
    backgroundColor: palette.primary,
  },
  filterChipLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.textSoft,
    lineHeight: 18,
  },
  filterChipLabelActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  ordersList: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: 80,
  },
  orderCard: {
    gap: spacing.sm,
  },
  orderCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  orderInvoice: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.textMuted,
    textTransform: 'uppercase',
  },
  orderTable: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  paymentBadge: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  badgePaid: {
    backgroundColor: '#d1fae5',
    color: '#065f46',
  },
  badgeUnpaid: {
    backgroundColor: '#fee2e2',
    color: '#991b1b',
  },
  itemsSummary: {
    backgroundColor: '#f8fafc',
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 4,
  },
  itemLine: {
    fontSize: 13,
    color: '#475569',
  },
  orderActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  pencilEditButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: palette.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    minHeight: 48, // touch target
    gap: spacing.xs,
  },
  pencilEditText: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.primary,
  },
  advanceButton: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    minHeight: 48, // touch target
    gap: spacing.xs,
  },
  advanceButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
});
