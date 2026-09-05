import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Pressable,
  TextInput,
  RefreshControl,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import { Screen } from '@/src/shared/layout/Screen';
import { SegmentedTabs } from '@/src/shared/ui/SegmentedTabs';
import { usePalette } from '@/src/stores/theme-store';
import { useThemedStyles } from '@/src/theme/use-themed-styles';
import { radius, spacing, typography } from '@/src/theme';
import type { AppPalette } from '@/src/theme/app-palette';

import { usePortfolioStore } from '@/src/stores/portfolio-store';
import { useMarketData } from '@/src/features/shares/hooks/useMarketData';
import { NepseCompany, NepseSector } from '@/src/features/shares/lib/nepse-scrip-list';
import {
  computeHoldingsFromTransactions,
  computePortfolioMetrics,
  StockHolding,
  StockTransaction,
  TransactionType,
} from '@/src/features/shares/lib/portfolio-calc';
import { formatCurrency, prettyDate } from '@/src/shared/lib/format';

import { MarketIndexHeader } from '@/src/features/shares/components/MarketIndexHeader';
import { MarketMoversTabs, MoverTab } from '@/src/features/shares/components/MarketMoversTabs';
import { StockQuoteCard } from '@/src/features/shares/components/StockQuoteCard';
import { PortfolioSummaryCard } from '@/src/features/shares/components/PortfolioSummaryCard';
import { PortfolioHoldingCard } from '@/src/features/shares/components/PortfolioHoldingCard';
import { TransactionModal } from '@/src/features/shares/components/TransactionModal';
import { StockDetailSheet } from '@/src/features/shares/components/StockDetailSheet';

type MainTab = 'portfolio' | 'market';

export default function SharesScreen() {
  const router = useRouter();
  const colors = usePalette();
  const styles = useThemedStyles(createStyles);

  const [activeTab, setActiveTab] = useState<MainTab>('portfolio');
  const [moverTab, setMoverTab] = useState<MoverTab>('ALL');
  const [selectedSector, setSelectedSector] = useState<NepseSector>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Store & Market Hook
  const { transactions, watchlist, loadPortfolio, addTransaction, deleteTransaction, toggleWatchlist, isWatchlisted } =
    usePortfolioStore();
  const { marketSummary, companies, companyMap, refreshMarket } = useMarketData();

  // Modals state
  const [transactionModalVisible, setTransactionModalVisible] = useState(false);
  const [transactionType, setTransactionType] = useState<TransactionType>('BUY');
  const [selectedSymbolForTrade, setSelectedSymbolForTrade] = useState<string>('');
  const [selectedHoldingForTrade, setSelectedHoldingForTrade] = useState<StockHolding | undefined>(undefined);

  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedCompanyDetail, setSelectedCompanyDetail] = useState<NepseCompany | null>(null);

  useEffect(() => {
    loadPortfolio();
  }, [loadPortfolio]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refreshMarket();
    setIsRefreshing(false);
  }, [refreshMarket]);

  // Compute Holdings & Portfolio Metrics
  const holdings = useMemo(() => {
    return computeHoldingsFromTransactions(transactions, companyMap);
  }, [transactions, companyMap]);

  const portfolioMetrics = useMemo(() => {
    return computePortfolioMetrics(holdings);
  }, [holdings]);

  // Filtered market companies
  const filteredMarketCompanies = useMemo(() => {
    let list = [...companies];

    // Mover tab filtering
    if (moverTab === 'GAINERS') {
      list = marketSummary.topGainers;
    } else if (moverTab === 'LOSERS') {
      list = marketSummary.topLosers;
    } else if (moverTab === 'TURNOVER') {
      list = marketSummary.topTurnover;
    } else if (moverTab === 'WATCHLIST') {
      list = list.filter((c) => watchlist.includes(c.symbol.toUpperCase()));
    }

    // Sector filtering (applicable on ALL or WATCHLIST)
    if (moverTab === 'ALL' || moverTab === 'WATCHLIST') {
      if (selectedSector !== 'All') {
        list = list.filter((c) => c.sector === selectedSector);
      }
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (c) => c.symbol.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
      );
    }

    return list;
  }, [companies, marketSummary, moverTab, selectedSector, watchlist, searchQuery]);

  // Trade actions
  const openBuyModal = (sym?: string) => {
    setSelectedSymbolForTrade(sym || (companies[0]?.symbol ?? 'NABIL'));
    setTransactionType('BUY');
    setSelectedHoldingForTrade(undefined);
    setTransactionModalVisible(true);
  };

  const openSellModal = (holding: StockHolding) => {
    setSelectedSymbolForTrade(holding.symbol);
    setTransactionType('SELL');
    setSelectedHoldingForTrade(holding);
    setTransactionModalVisible(true);
  };

  const handleStockPress = (company: NepseCompany) => {
    setSelectedCompanyDetail(company);
    setDetailModalVisible(true);
  };

  const handleTradeFromDetail = (company: NepseCompany, type: 'BUY' | 'SELL') => {
    const existingHolding = holdings.find(
      (h) => h.symbol.toUpperCase() === company.symbol.toUpperCase()
    );
    setSelectedSymbolForTrade(company.symbol);
    setTransactionType(type);
    setSelectedHoldingForTrade(existingHolding);
    setTransactionModalVisible(true);
  };

  const handleDeleteTransaction = (tx: StockTransaction) => {
    Alert.alert(
      'Delete Trade Log',
      `Delete trade of ${tx.units} units of ${tx.symbol}? This will update your holding calculations.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteTransaction(tx.id),
        },
      ]
    );
  };

  const mainTabs = useMemo(
    () => [
      { value: 'portfolio' as MainTab, label: `My Portfolio (${holdings.length})` },
      { value: 'market' as MainTab, label: 'Live Market' },
    ],
    [holdings.length]
  );

  return (
    <Screen padded={false} showTopBar={false} scrollable={false}>
      {/* Top App Bar */}
      <View style={styles.appBar}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.headerTitles}>
          <Text style={styles.screenTitle}>NEPSE & Stocks</Text>
          <Text style={styles.screenSubtitle}>Live Market & Portfolio Manager</Text>
        </View>
        <Pressable
          onPress={() => openBuyModal()}
          style={({ pressed }) => [
            styles.quickAddBtn,
            { backgroundColor: colors.primary },
            pressed && { opacity: 0.8 },
          ]}
        >
          <MaterialCommunityIcons name="plus" size={18} color="#FFFFFF" />
          <Text style={styles.quickAddBtnText}>Trade</Text>
        </Pressable>
      </View>

      {/* Main Tabs Selector */}
      <View style={styles.tabsWrapper}>
        <SegmentedTabs
          options={mainTabs}
          value={activeTab}
          onChange={(tab) => setActiveTab(tab)}
        />
      </View>

      {/* Tab 1: My Portfolio */}
      {activeTab === 'portfolio' ? (
        <FlatList
          data={holdings}
          keyExtractor={(item) => item.symbol}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          ListHeaderComponent={
            <View>
              <PortfolioSummaryCard
                metrics={portfolioMetrics}
                onAddStock={() => openBuyModal()}
              />
              {holdings.length > 0 && (
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionTitle}>Your Stock Holdings</Text>
                  <Text style={styles.sectionBadge}>{holdings.length} Companies</Text>
                </View>
              )}
            </View>
          }
          renderItem={({ item }) => (
            <PortfolioHoldingCard
              holding={item}
              onPress={() => {
                const comp = companyMap.get(item.symbol.toUpperCase());
                if (comp) handleStockPress(comp);
              }}
              onBuyMore={() => openBuyModal(item.symbol)}
              onSell={() => openSellModal(item)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <View style={[styles.emptyIconCircle, { backgroundColor: colors.accentSoft }]}>
                <MaterialCommunityIcons name="chart-areaspline" size={36} color={colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>Build Your Nepal Share Portfolio</Text>
              <Text style={styles.emptySubtitle}>
                Add your buy/sell trades with automatic broker commissions and SEBON fees to track
                your portfolio value and daily gains in real time.
              </Text>
              <Pressable
                onPress={() => openBuyModal()}
                style={({ pressed }) => [
                  styles.emptyCtaButton,
                  { backgroundColor: colors.primary },
                  pressed && { opacity: 0.85 },
                ]}
              >
                <MaterialCommunityIcons name="plus" size={18} color="#FFFFFF" />
                <Text style={styles.emptyCtaButtonText}>Add First Stock Trade</Text>
              </Pressable>
            </View>
          }
          ListFooterComponent={
            transactions.length > 0 ? (
              <View style={styles.historySection}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionTitle}>Recent Trade History</Text>
                  <Text style={styles.sectionBadge}>{transactions.length} Logs</Text>
                </View>
                {transactions.slice(0, 5).map((tx) => (
                  <View key={tx.id} style={styles.txRow}>
                    <View style={styles.txLeft}>
                      <View
                        style={[
                          styles.txTypeBadge,
                          {
                            backgroundColor:
                              tx.type === 'BUY' ? colors.successSoft : colors.dangerSoft,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.txTypeText,
                            { color: tx.type === 'BUY' ? colors.success : colors.danger },
                          ]}
                        >
                          {tx.type}
                        </Text>
                      </View>
                      <View>
                        <Text style={styles.txSymbol}>{tx.symbol}</Text>
                        <Text style={styles.txDate}>{prettyDate(tx.date)}</Text>
                      </View>
                    </View>

                    <View style={styles.txRight}>
                      <Text style={styles.txAmount}>
                        {formatCurrency(tx.totalCost, 'NPR')}
                      </Text>
                      <Text style={styles.txUnits}>
                        {tx.units} units @ Rs {tx.pricePerUnit}
                      </Text>
                    </View>

                    <Pressable
                      onPress={() => handleDeleteTransaction(tx)}
                      hitSlop={8}
                      style={styles.txDeleteBtn}
                    >
                      <MaterialCommunityIcons name="trash-can-outline" size={16} color={colors.textMuted} />
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null
          }
        />
      ) : (
        /* Tab 2: Live Market */
        <FlatList
          data={filteredMarketCompanies}
          keyExtractor={(item) => item.symbol}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          ListHeaderComponent={
            <View>
              <MarketIndexHeader
                nepseIndex={marketSummary.nepseIndex}
                sensitiveIndex={marketSummary.sensitiveIndex}
                floatIndex={marketSummary.floatIndex}
                onRefresh={onRefresh}
                isRefreshing={isRefreshing}
              />

              {/* Search Bar */}
              <View style={styles.searchBar}>
                <MaterialCommunityIcons name="magnify" size={20} color={colors.textMuted} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search NEPSE company or symbol..."
                  placeholderTextColor={colors.textMuted}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {searchQuery.length > 0 && (
                  <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                    <MaterialCommunityIcons name="close-circle" size={18} color={colors.textMuted} />
                  </Pressable>
                )}
              </View>

              {/* Market Movers & Sector Filters */}
              <MarketMoversTabs
                selectedTab={moverTab}
                onSelectTab={setMoverTab}
                selectedSector={selectedSector}
                onSelectSector={setSelectedSector}
                watchlistCount={watchlist.length}
              />
            </View>
          }
          renderItem={({ item }) => (
            <StockQuoteCard
              company={item}
              isWatchlisted={isWatchlisted(item.symbol)}
              onToggleWatchlist={toggleWatchlist}
              onPress={handleStockPress}
              onQuickTrade={(c) => openBuyModal(c.symbol)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyMarket}>
              <MaterialCommunityIcons
                name="file-search-outline"
                size={40}
                color={colors.textMuted}
              />
              <Text style={styles.emptyMarketText}>
                No stocks found for the selected filter or search term.
              </Text>
            </View>
          }
        />
      )}

      {/* Transaction Logging Modal */}
      <TransactionModal
        visible={transactionModalVisible}
        onClose={() => setTransactionModalVisible(false)}
        companies={companies}
        initialSymbol={selectedSymbolForTrade}
        initialType={transactionType}
        holding={selectedHoldingForTrade}
        onSave={async (tx) => {
          await addTransaction(tx);
        }}
      />

      {/* Stock Detail Bottom Sheet */}
      <StockDetailSheet
        visible={detailModalVisible}
        onClose={() => setDetailModalVisible(false)}
        company={selectedCompanyDetail}
        isWatchlisted={selectedCompanyDetail ? isWatchlisted(selectedCompanyDetail.symbol) : false}
        onToggleWatchlist={toggleWatchlist}
        onTrade={handleTradeFromDetail}
      />
    </Screen>
  );
}

const createStyles = (colors: AppPalette) =>
  StyleSheet.create({
    appBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backButton: {
      padding: 4,
    },
    headerTitles: {
      flex: 1,
      marginLeft: spacing.sm,
    },
    screenTitle: {
      fontSize: typography.heading,
      fontWeight: '800',
      color: colors.text,
    },
    screenSubtitle: {
      fontSize: 11,
      color: colors.textMuted,
    },
    quickAddBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs + 2,
      borderRadius: radius.md,
      gap: 4,
    },
    quickAddBtnText: {
      fontSize: typography.label,
      fontWeight: '800',
      color: '#FFFFFF',
    },
    tabsWrapper: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs + 2,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    listContent: {
      padding: spacing.md,
      paddingBottom: 60,
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.xs + 2,
      marginTop: spacing.xs,
    },
    sectionTitle: {
      fontSize: typography.label,
      fontWeight: '800',
      color: colors.text,
    },
    sectionBadge: {
      fontSize: typography.caption,
      color: colors.textMuted,
      fontWeight: '600',
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs + 2,
      marginBottom: spacing.sm,
      gap: spacing.xs,
    },
    searchInput: {
      flex: 1,
      color: colors.text,
      fontSize: 13,
      paddingVertical: 2,
    },
    emptyCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.xl,
      alignItems: 'center',
      marginVertical: spacing.md,
    },
    emptyIconCircle: {
      width: 68,
      height: 68,
      borderRadius: 34,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md,
    },
    emptyTitle: {
      fontSize: typography.heading,
      fontWeight: '800',
      color: colors.text,
      textAlign: 'center',
      marginBottom: spacing.xs,
    },
    emptySubtitle: {
      fontSize: typography.caption,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: 18,
      marginBottom: spacing.lg,
    },
    emptyCtaButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm + 2,
      borderRadius: radius.md,
      gap: 6,
    },
    emptyCtaButtonText: {
      fontSize: typography.label,
      fontWeight: '800',
      color: '#FFFFFF',
    },
    emptyMarket: {
      alignItems: 'center',
      paddingVertical: spacing.xl,
    },
    emptyMarketText: {
      fontSize: typography.caption,
      color: colors.textMuted,
      textAlign: 'center',
      marginTop: spacing.xs,
    },
    historySection: {
      marginTop: spacing.md,
      paddingTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    txRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      marginBottom: spacing.xs,
    },
    txLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    txTypeBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: radius.sm,
    },
    txTypeText: {
      fontSize: 10,
      fontWeight: '800',
    },
    txSymbol: {
      fontSize: typography.label,
      fontWeight: '800',
      color: colors.text,
    },
    txDate: {
      fontSize: 10,
      color: colors.textMuted,
    },
    txRight: {
      alignItems: 'flex-end',
      flex: 1,
      marginRight: spacing.sm,
    },
    txAmount: {
      fontSize: typography.label,
      fontWeight: '700',
      color: colors.text,
    },
    txUnits: {
      fontSize: 10,
      color: colors.textMuted,
    },
    txDeleteBtn: {
      padding: 4,
    },
  });
