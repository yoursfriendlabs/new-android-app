import React, { useMemo } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';

import { usePalette } from '@/src/stores/theme-store';
import { useThemedStyles } from '@/src/theme/use-themed-styles';
import { radius, spacing, typography } from '@/src/theme';
import type { AppPalette } from '@/src/theme/app-palette';

import { usePortfolioStore } from '@/src/stores/portfolio-store';
import { useMarketData } from '../hooks/useMarketData';
import { computeHoldingsFromTransactions, computePortfolioMetrics } from '../lib/portfolio-calc';
import { formatCurrency } from '@/src/shared/lib/format';

interface PersonalShareWidgetProps {
  hideAmounts?: boolean;
}

export function PersonalShareWidget({ hideAmounts = false }: PersonalShareWidgetProps) {
  const router = useRouter();
  const colors = usePalette();
  const styles = useThemedStyles(createStyles);

  const { transactions } = usePortfolioStore();
  const { marketSummary, companyMap } = useMarketData();

  const holdings = useMemo(() => {
    return computeHoldingsFromTransactions(transactions, companyMap);
  }, [transactions, companyMap]);

  const portfolioMetrics = useMemo(() => {
    return computePortfolioMetrics(holdings);
  }, [holdings]);

  const hasHoldings = holdings.length > 0;
  const isMarketOpen = marketSummary.nepseIndex.status === 'OPEN';
  const nepsePositive = marketSummary.nepseIndex.change >= 0;
  const portfolioPositive = portfolioMetrics.overallProfitLoss >= 0;

  return (
    <Pressable
      onPress={() => router.push('/(app)/shares' as never)}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        pressed && { opacity: 0.9 },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={[styles.iconPill, { backgroundColor: colors.accentSoft }]}>
            <MaterialCommunityIcons name="chart-areaspline" size={18} color={colors.primary} />
          </View>
          <View>
            <Text style={[styles.cardTitle, { color: colors.text }]}>NEPSE & Stocks</Text>
            <Text style={[styles.cardSubtitle, { color: colors.textMuted }]}>
              {hasHoldings ? `${holdings.length} stocks in portfolio` : 'Live Nepal Share Market'}
            </Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <View
            style={[
              styles.marketBadge,
              { backgroundColor: isMarketOpen ? colors.successSoft : colors.backgroundAlt },
            ]}
          >
            <View
              style={[
                styles.marketDot,
                { backgroundColor: isMarketOpen ? colors.success : colors.textSoft },
              ]}
            />
            <Text
              style={[
                styles.marketStatusText,
                { color: isMarketOpen ? colors.success : colors.textSoft },
              ]}
            >
              {marketSummary.nepseIndex.status}
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textSoft} />
        </View>
      </View>

      {/* Content Grid */}
      <View style={styles.contentGrid}>
        {/* Left: NEPSE Live Index */}
        <View style={[styles.gridItem, { backgroundColor: colors.backgroundAlt }]}>
          <Text style={[styles.gridLabel, { color: colors.textMuted }]}>NEPSE Index</Text>
          <Text style={[styles.indexValue, { color: colors.text }]}>
            {marketSummary.nepseIndex.current.toFixed(2)}
          </Text>
          <View style={styles.changeRow}>
            <MaterialCommunityIcons
              name={nepsePositive ? 'arrow-up' : 'arrow-down'}
              size={12}
              color={nepsePositive ? colors.success : colors.danger}
            />
            <Text
              style={[
                styles.changePercent,
                { color: nepsePositive ? colors.success : colors.danger },
              ]}
            >
              {nepsePositive ? `+${marketSummary.nepseIndex.percentChange}%` : `${marketSummary.nepseIndex.percentChange}%`}
            </Text>
          </View>
        </View>

        {/* Right: Portfolio Summary or Top Mover */}
        <View style={[styles.gridItem, { backgroundColor: colors.backgroundAlt }]}>
          {hasHoldings ? (
            <>
              <Text style={[styles.gridLabel, { color: colors.textMuted }]}>Portfolio Value</Text>
              <Text style={[styles.indexValue, { color: colors.text }]}>
                {hideAmounts ? '••••••' : formatCurrency(portfolioMetrics.currentValue, 'NPR')}
              </Text>
              <View style={styles.changeRow}>
                <MaterialCommunityIcons
                  name={portfolioPositive ? 'arrow-up' : 'arrow-down'}
                  size={12}
                  color={portfolioPositive ? colors.success : colors.danger}
                />
                <Text
                  style={[
                    styles.changePercent,
                    { color: portfolioPositive ? colors.success : colors.danger },
                  ]}
                >
                  {portfolioPositive ? '+' : ''}
                  {portfolioMetrics.overallProfitLossPercent}% (P&L)
                </Text>
              </View>
            </>
          ) : (
            <>
              <Text style={[styles.gridLabel, { color: colors.textMuted }]}>Daily Turnover</Text>
              <Text style={[styles.indexValue, { color: colors.text }]}>
                NPR {(marketSummary.nepseIndex.turnover / 10000000).toFixed(1)} Cr
              </Text>
              <Text style={[styles.gridSubText, { color: colors.primary }]}>+ Tap to build portfolio</Text>
            </>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const createStyles = (colors: AppPalette) =>
  StyleSheet.create({
    card: {
      borderRadius: radius.lg,
      borderWidth: 1,
      padding: spacing.md,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    iconPill: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardTitle: {
      fontSize: typography.body,
      fontWeight: '800',
    },
    cardSubtitle: {
      fontSize: 11,
      marginTop: 1,
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    marketBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: radius.pill,
      gap: 4,
    },
    marketDot: {
      width: 5,
      height: 5,
      borderRadius: 2.5,
    },
    marketStatusText: {
      fontSize: 9,
      fontWeight: '800',
    },
    contentGrid: {
      flexDirection: 'row',
      gap: spacing.xs,
    },
    gridItem: {
      flex: 1,
      borderRadius: radius.md,
      padding: spacing.sm,
    },
    gridLabel: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      marginBottom: 2,
    },
    indexValue: {
      fontSize: 15,
      fontWeight: '800',
    },
    changeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      marginTop: 2,
    },
    changePercent: {
      fontSize: 11,
      fontWeight: '700',
    },
    gridSubText: {
      fontSize: 11,
      fontWeight: '700',
      marginTop: 2,
    },
  });
