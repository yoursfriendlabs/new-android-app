import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useState, useMemo, useEffect } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Screen } from '@/src/components/layout/Screen';
import { useAuthStore } from '@/src/stores/auth-store';
import {
  useDashboardSummary,
  useExpenseInsights,
  useProfitLossAnalytics,
  useRecentPurchases,
  useRecentServices,
  useBanks,
} from '@/src/hooks/useAppQueries';
import { canAccessSegment } from '@/src/lib/business';
import { DatePeriod, getRangeForPeriod, prettyDate } from '@/src/lib/format';
import { palette, spacing, radius, shadows, typography } from '@/src/theme';

// Custom Global IME logo component
export function GlobalImeLogo({ size = 24 }: { size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
        backgroundColor: '#ffffff',
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <View
        style={{
          width: size * 1.5,
          height: size * 1.5,
          transform: [{ rotate: '-35deg' }],
          flexDirection: 'row',
        }}
      >
        <View style={{ flex: 1, backgroundColor: '#d32f2f' }} />
        <View style={{ width: size * 0.1, backgroundColor: '#ffffff' }} />
        <View style={{ flex: 1, backgroundColor: '#0263f9' }} />
      </View>
    </View>
  );
}

// Custom Nepalpay QR logo component
export function NepalpayLogo({ size = 40 }: { size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
        backgroundColor: '#ffffff',
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <View
        style={{
          borderRadius: 4,
          borderWidth: 1,
          borderColor: '#d32f2f',
          paddingHorizontal: 3,
          paddingVertical: 1,
          backgroundColor: '#ffffff',
        }}
      >
        <Text style={{ fontSize: 6, fontWeight: '800', color: '#0263f9' }}>
          NEPAL<Text style={{ color: '#d32f2f' }}>PAY</Text>
        </Text>
      </View>
    </View>
  );
}

// Helper to format number to Indian style with 2 decimal places
function formatNumberWithCommas(value: number) {
  try {
    return new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number.isFinite(value) ? value : 0);
  } catch {
    return Number(value || 0).toFixed(2);
  }
}

export default function HomeScreen() {
  const user = useAuthStore((state) => state.user);
  const session = useAuthStore((state) => state.session);
  const accessControl = useAuthStore((state) => state.accessControl);
  const businessProfile = useAuthStore((state) => state.businessProfile);
  const accessContext = {
    role: session?.role ?? user?.role ?? null,
    permissions: accessControl?.permissions ?? user?.permissions,
    accessControl,
    enabledModules: businessProfile?.enabledModules,
  };

  const role = session?.role ?? user?.role ?? null;
  const isGeneralStaff = role === 'staff';

  useEffect(() => {
    if (isGeneralStaff) {
      router.replace('/(app)/attendance');
    }
  }, [isGeneralStaff]);

  if (isGeneralStaff) {
    return (
      <Screen scrollable={false} padded={false}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={palette.primary} />
        </View>
      </Screen>
    );
  }

  const firstName = user?.name?.split(' ')[0] || 'Dipesh';

  const [selectedPeriod, setSelectedPeriod] = useState<DatePeriod>('this_month');
  const range = useMemo(() => getRangeForPeriod(selectedPeriod), [selectedPeriod]);

  // Run existing queries to fetch actual application data
  const summaryQuery = useDashboardSummary(range);
  const profitLossQuery = useProfitLossAnalytics(range);
  const expenseInsightsQuery = useExpenseInsights(range);
  const recentPurchasesQuery = useRecentPurchases();
  const recentServicesQuery = useRecentServices();
  useBanks(); // keeps hook active for cache syncing

  const [refreshing, setRefreshing] = useState(false);
  const [balanceVisible, setBalanceVisible] = useState(true);

  // Dynamic values from dashboard summary API
  const summary = summaryQuery.data;
  const salesTotal = Number(summary?.salesTotal ?? 0);
  const expenseTotal = Number(summary?.expenseTotal ?? 0);
  const serviceTotal = Number(summary?.serviceTotal ?? 0);
  const pendingReceivable = Number(summary?.pendingReceivable ?? 0);
  const pendingPayable = Number(summary?.pendingPayable ?? 0);

  // Dynamic Transaction History
  const recentPurchases = recentPurchasesQuery.data;
  const recentServices = recentServicesQuery.data;

  const recentTransactions = useMemo(() => {
    const list = [
      ...(canAccessSegment(accessContext, 'pos')
        ? (summary?.recentSales ?? []).map((sale) => ({
            id: `sale-${sale.id}`,
            label: 'sale' as const,
            title: `Sale #${sale.invoiceNo || sale.id.slice(-6)}`,
            subtitle: (sale.partyName as string) || (sale.customerName as string) || (sale.partyId ? 'Customer' : 'Walk-in Customer'),
            rawDate: sale.saleDate || '',
            amount: Number(sale.grandTotal ?? 0),
            positive: true,
            route: '/(app)/(tabs)/pos' as const,
          }))
        : []),
      ...(recentPurchases ?? []).map((item) => ({
        id: `${item.entryType}-${item.id}`,
        label: item.entryType,
        title: item.entryType === 'expense'
          ? `Expense #${item.invoiceNo || item.id.slice(-6)}`
          : `Purchase #${item.invoiceNo || item.id.slice(-6)}`,
        subtitle: (item.partyName as string) || (item.entryType === 'expense' ? (item.notes as string) || 'General Expense' : 'Supplier'),
        rawDate: item.purchaseDate || '',
        amount: Number(item.grandTotal ?? 0),
        positive: false,
        route:
          item.entryType === 'expense'
            ? ('/(app)/(tabs)/expenses' as const)
            : ('/(app)/purchases' as const),
      })),
      ...(canAccessSegment(accessContext, 'services')
        ? (recentServices ?? []).map((service) => ({
            id: `service-${service.id}`,
            label: 'service' as const,
            title: `Service #${service.orderNo || service.id.slice(-6)}`,
            subtitle: (service.partyName as string) || (service.customerName as string) || (service.notes as string) || (service.partyId ? 'Customer' : 'Walk-in Customer'),
            rawDate: service.deliveryDate || '',
            amount: Number(service.grandTotal ?? 0),
            positive: true,
            route: '/(app)/(tabs)/services' as const,
          }))
        : []),
    ];

    // Sort by rawDate descending and limit to 6
    return list.sort((a, b) => b.rawDate.localeCompare(a.rawDate)).slice(0, 6);
  }, [summary, recentPurchases, recentServices, accessContext]);

  // Fallback transaction list if database has no entries
  const displayTransactions = useMemo(() => {
    if (recentTransactions.length > 0) {
      return recentTransactions.map((item) => ({
        id: item.id,
        label: item.label,
        title: item.title,
        subtitle: item.subtitle,
        dateText: prettyDate(item.rawDate),
        amount: item.amount,
        positive: item.positive,
        route: item.route,
      }));
    }

    return [
      {
        id: 'mock-1',
        label: 'sale' as const,
        title: 'Cash Sale',
        subtitle: 'Walk-in Customer',
        dateText: '07:31 PM | 9 Jun 2026',
        amount: 3063.00,
        positive: true,
        route: '/(app)/(tabs)/pos' as const,
      },
      {
        id: 'mock-2',
        label: 'expense' as const,
        title: 'Tea & Snacks',
        subtitle: 'Office Expense',
        dateText: '11:18 AM | 4 Jun 2026',
        amount: 130.00,
        positive: false,
        route: '/(app)/(tabs)/expenses' as const,
      },
    ];
  }, [recentTransactions]);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await Promise.all([
        summaryQuery.refetch(),
        profitLossQuery.refetch(),
        expenseInsightsQuery.refetch(),
        recentPurchasesQuery.refetch(),
        recentServicesQuery.refetch(),
      ]);
    } catch (e) {
      console.warn(e);
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <Screen padded={false} showTopBar={false}>
      {/* Scrollable body content */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} />
        }
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header Block */}
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <View style={styles.profileAvatar}>
              <MaterialCommunityIcons name="account" size={24} color="#af865d" />
            </View>
            <Text style={styles.greetingText}>Hi, {firstName}!</Text>
          </View>

          <View style={styles.headerRight}>
            <Pressable style={styles.iconPressable}>
              <MaterialCommunityIcons name="magnify" size={22} color="#2e251b" />
            </Pressable>
            <Pressable
              style={styles.iconPressable}
              onPress={() => router.push('/(app)/tasks/notifications' as never)}
            >
              <MaterialCommunityIcons name="bell-outline" size={22} color="#2e251b" />
            </Pressable>
            <Pressable
              style={styles.iconPressable}
              onPress={() => setBalanceVisible(!balanceVisible)}
            >
              <MaterialCommunityIcons
                name={balanceVisible ? 'eye-outline' : 'eye-off-outline'}
                size={22}
                color="#2e251b"
              />
            </Pressable>
          </View>
        </View>

        {/* Filter Chip Selector */}
        <View style={styles.filterContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
            {(['today', 'this_week', 'this_month', 'this_year', 'previous_year'] as DatePeriod[]).map((period) => {
              const isActive = selectedPeriod === period;
              const labels: Record<DatePeriod, string> = {
                today: 'Today',
                this_week: 'This Week',
                previous_week: 'Prev Week',
                this_month: 'This Month',
                this_year: 'This Year',
                previous_year: 'Prev Year',
              };
              return (
                <Pressable
                  key={period}
                  style={[styles.filterChip, isActive && styles.filterChipActive]}
                  onPress={() => setSelectedPeriod(period)}
                >
                  <Text style={[styles.filterChipLabel, isActive && styles.filterChipLabelActive]}>
                    {labels[period]}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Quick Menu Grid: Quick POS, Services, Expenses, View All */}
        <View style={styles.quickMenuRow}>
          <Pressable
            style={styles.quickMenuItem}
            onPress={() => router.push('/(app)/(tabs)/pos')}
          >
            <View style={styles.quickMenuIconBox}>
              <MaterialCommunityIcons name="calculator" size={24} color="#2e251b" />
            </View>
            <Text style={styles.quickMenuLabel}>Quick{'\n'}POS</Text>
          </Pressable>

          <Pressable
            style={styles.quickMenuItem}
            onPress={() => router.push('/(app)/(tabs)/services')}
          >
            <View style={styles.quickMenuIconBox}>
              <MaterialCommunityIcons name="briefcase-outline" size={24} color="#2e251b" />
            </View>
            <Text style={styles.quickMenuLabel}>Services</Text>
          </Pressable>

          <Pressable
            style={styles.quickMenuItem}
            onPress={() => router.push('/(app)/(tabs)/expenses')}
          >
            <View style={styles.quickMenuIconBox}>
              <MaterialCommunityIcons name="wallet-outline" size={24} color="#2e251b" />
            </View>
            <Text style={styles.quickMenuLabel}>Expenses</Text>
          </Pressable>

          <Pressable
            style={styles.quickMenuItem}
            onPress={() => router.push('/(app)/(tabs)/more')}
          >
            <View style={[styles.quickMenuIconBox, styles.viewAllBox]}>
              <MaterialCommunityIcons name="apps" size={24} color="#af865d" />
            </View>
            <Text style={styles.quickMenuLabel}>View{'\n'}All</Text>
          </Pressable>
        </View>

        {/* Easy Balance Section */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Shop Dashboard Summary</Text>
            <Pressable onPress={() => router.push('/(app)/ledger')}>
              <Text style={styles.sectionLink}>View Statement</Text>
            </Pressable>
          </View>

          {/* Dual-Section Gold Card */}
          <View style={styles.balanceCard}>
            {/* Top Part */}
            <View style={styles.cardTopSection}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardHeaderTitle} numberOfLines={1}>Total Revenue / Sales (NPR)</Text>
                {summary?.profitOrLoss !== undefined && (
                  <View style={[
                    styles.profitBadge, 
                    summary.profitOrLossStatus === 'loss' ? styles.lossBadge : styles.winBadge
                  ]}>
                    <Text style={styles.profitBadgeText}>
                      {summary.profitOrLoss >= 0 ? 'Profit' : 'Loss'}: {formatNumberWithCommas(Math.abs(summary.profitOrLoss))}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.balanceContainer}>
                <Text style={styles.balanceText} numberOfLines={1}>
                  {balanceVisible ? formatNumberWithCommas(salesTotal) : '•••••'}
                </Text>
                <Text style={styles.balanceLabel}>Total Sales Revenue</Text>
              </View>

              {/* Middle metrics row inside the gold section */}
              <View style={styles.cardMetricsRow}>
                <View style={styles.cardMetricItem}>
                  <Text style={styles.cardMetricLabel}>Receivable</Text>
                  <Text style={styles.cardMetricValue} numberOfLines={1}>
                    {balanceVisible ? formatNumberWithCommas(pendingReceivable) : '••••'}
                  </Text>
                </View>
                <View style={styles.cardMetricDivider} />
                <View style={styles.cardMetricItem}>
                  <Text style={styles.cardMetricLabel}>Services</Text>
                  <Text style={styles.cardMetricValue} numberOfLines={1}>
                    {balanceVisible ? formatNumberWithCommas(serviceTotal) : '••••'}
                  </Text>
                </View>
                <View style={styles.cardMetricDivider} />
                <View style={styles.cardMetricItem}>
                  <Text style={styles.cardMetricLabel}>Payable</Text>
                  <Text style={styles.cardMetricValue} numberOfLines={1}>
                    {balanceVisible ? formatNumberWithCommas(pendingPayable) : '••••'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Bottom Split Section */}
            <View style={styles.cardBottomSection}>
              <Text style={styles.cardBottomLeft} numberOfLines={1}>Total Operating Expenses (NPR)</Text>
              <Text style={styles.cardBottomRight} numberOfLines={1}>
                {balanceVisible ? formatNumberWithCommas(expenseTotal) : '••••'}
              </Text>
            </View>
          </View>
        </View>

        {/* Easy History Section */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Activities</Text>
            <Pressable onPress={() => router.push('/(app)/(tabs)/expenses')}>
              <Text style={styles.sectionLink}>View All</Text>
            </Pressable>
          </View>

          {/* History List */}
          <View style={styles.historyListContainer}>
            {displayTransactions.map((item, index) => {
              // Decide which logo to render based on the transaction type/source
              const isSalesOrQR =
                item.label === 'sale' ||
                item.label === 'service' ||
                item.title.toLowerCase().includes('qr') ||
                item.title.toLowerCase().includes('nepalpay');

              return (
                <View key={item.id}>
                  {index > 0 && <View style={styles.historyDivider} />}
                  <Pressable
                    style={styles.historyItemRow}
                    onPress={() => router.push(item.route as never)}
                  >
                    {isSalesOrQR ? <NepalpayLogo size={42} /> : <GlobalImeLogo size={42} />}
                    <View style={styles.historyItemCopy}>
                      <Text style={styles.historyItemTitle} numberOfLines={1}>
                        {item.title}
                      </Text>
                      <Text style={styles.historyItemSubtitle} numberOfLines={1}>
                        {item.subtitle}
                      </Text>
                      <Text style={styles.historyItemDate}>
                        {item.dateText}
                      </Text>
                    </View>
                    <Text
                      style={
                        item.positive
                          ? styles.historyItemAmountPositive
                          : styles.historyItemAmountNegative
                      }
                    >
                      {item.positive ? '+' : '-'}{balanceVisible ? formatNumberWithCommas(item.amount) : '••••'}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        </View>

        {/* Favourites Section */}
        <View style={[styles.sectionContainer, { paddingBottom: 120 }]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Favourites</Text>
            <Pressable onPress={() => router.push('/(app)/(tabs)/more')}>
              <Text style={styles.sectionLink}>View All</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Sticky Action Buttons */}
      <View style={styles.stickyActionContainer}>
        <Pressable
          style={styles.stickyButtonPrimary}
          onPress={() => router.push('/(app)/(tabs)/pos')}
        >
          <MaterialCommunityIcons name="swap-horizontal" size={20} color="#fdf9f4" style={{ marginRight: 6 }} />
          <Text style={styles.stickyButtonTextPrimary}>Record Sale</Text>
        </Pressable>

        <Pressable
          style={styles.stickyButtonSecondary}
          onPress={() => router.push('/(app)/(tabs)/quick-entry?tab=expense')}
        >
          <MaterialCommunityIcons name="wallet-outline" size={18} color="#af865d" style={{ marginRight: 6 }} />
          <Text style={styles.stickyButtonTextSecondary}>Record Expense</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  filterContainer: {
    marginBottom: 16,
  },
  filterScroll: {
    gap: 8,
    paddingHorizontal: 4,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e6ded4',
  },
  filterChipActive: {
    backgroundColor: '#af865d',
    borderColor: '#af865d',
  },
  filterChipLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#7c6d5e',
  },
  filterChipLabelActive: {
    color: '#ffffff',
  },
  profitBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  winBadge: {
    backgroundColor: '#108c5a',
  },
  lossBadge: {
    backgroundColor: '#d32f2f',
  },
  profitBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    backgroundColor: '#f8fafd',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    marginBottom: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fdf9f4',
    borderWidth: 1.5,
    borderColor: '#af865d',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  greetingText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2e251b',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  iconPressable: {
    padding: 4,
  },
  quickMenuRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  quickMenuItem: {
    alignItems: 'center',
    width: '23%',
  },
  quickMenuIconBox: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: '#fdf9f4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  viewAllBox: {
    backgroundColor: '#eeddc8',
  },
  quickMenuLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#7c6d5e',
    textAlign: 'center',
    lineHeight: 15,
  },
  sectionContainer: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2e251b',
  },
  sectionLink: {
    fontSize: 13,
    fontWeight: '600',
    color: '#af865d',
  },
  balanceCard: {
    width: '100%',
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#af865d',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  cardTopSection: {
    backgroundColor: '#af865d',
    padding: 18,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardHeaderTitle: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
    opacity: 0.9,
  },
  balanceContainer: {
    alignItems: 'flex-end',
    marginTop: 4,
  },
  balanceText: {
    color: '#ffffff',
    fontSize: 34,
    fontWeight: '700',
  },
  balanceLabel: {
    color: '#fdf9f4',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
    opacity: 0.85,
  },
  cardMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
    paddingTop: 12,
  },
  cardMetricItem: {
    alignItems: 'center',
    flex: 1,
  },
  cardMetricLabel: {
    color: '#fdf9f4',
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 2,
    textTransform: 'uppercase',
    opacity: 0.8,
  },
  cardMetricValue: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  cardMetricDivider: {
    width: 1,
    height: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  cardBottomSection: {
    backgroundColor: '#8c643f',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  cardBottomLeft: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  cardBottomRight: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  historyListContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 14,
    shadowColor: '#2e251b',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  historyItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  historyItemCopy: {
    flex: 1,
    marginLeft: 12,
    gap: 2,
  },
  historyItemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2e251b',
  },
  historyItemSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#7c6d5e',
  },
  historyItemDate: {
    fontSize: 11,
    color: '#a69788',
  },
  historyItemAmountPositive: {
    fontSize: 15,
    fontWeight: '700',
    color: '#108c5a',
  },
  historyItemAmountNegative: {
    fontSize: 15,
    fontWeight: '700',
    color: '#d32f2f',
  },
  historyDivider: {
    height: 1,
    backgroundColor: '#e6ded4',
    marginVertical: 6,
  },
  stickyActionContainer: {
    position: 'absolute',
    bottom: 12,
    left: 16,
    right: 16,
    flexDirection: 'row',
    gap: 12,
    backgroundColor: 'rgba(250, 248, 245, 0.95)',
    paddingVertical: 4,
  },
  stickyButtonPrimary: {
    flex: 1,
    backgroundColor: '#af865d',
    borderRadius: 14,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#af865d',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  stickyButtonTextPrimary: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  stickyButtonSecondary: {
    flex: 1,
    backgroundColor: '#fdf9f4',
    borderWidth: 1,
    borderColor: '#af865d',
    borderRadius: 14,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stickyButtonTextSecondary: {
    color: '#af865d',
    fontSize: 14,
    fontWeight: '700',
  },
});
