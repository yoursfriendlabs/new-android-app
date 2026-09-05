import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { PortfolioMetrics } from '../lib/portfolio-calc';
import { formatCurrency } from '@/src/shared/lib/format';
import { usePalette } from '@/src/stores/theme-store';
import { useThemedStyles } from '@/src/theme/use-themed-styles';
import { radius, spacing, typography } from '@/src/theme';
import type { AppPalette } from '@/src/theme/app-palette';

interface PortfolioSummaryCardProps {
  metrics: PortfolioMetrics;
  onAddStock: () => void;
  currency?: string;
}

export function PortfolioSummaryCard({
  metrics,
  onAddStock,
  currency = 'NPR',
}: PortfolioSummaryCardProps) {
  const colors = usePalette();
  const styles = useThemedStyles(createStyles);

  const isOverallPositive = metrics.overallProfitLoss >= 0;
  const isTodayPositive = metrics.todayProfitLoss >= 0;

  return (
    <View style={styles.card}>
      <View style={styles.topHeader}>
        <View>
          <Text style={styles.headerSubtitle}>CURRENT PORTFOLIO VALUE</Text>
          <Text style={styles.mainValue}>
            {formatCurrency(metrics.currentValue, currency)}
          </Text>
        </View>

        <Pressable
          onPress={onAddStock}
          style={({ pressed }) => [
            styles.addStockButton,
            { backgroundColor: colors.primary },
            pressed && { opacity: 0.85 },
          ]}
        >
          <MaterialCommunityIcons name="plus" size={16} color={colors.white} />
          <Text style={[styles.addStockText, { color: colors.white }]}>Add Stock</Text>
        </Pressable>
      </View>

      {/* Grid of stats */}
      <View style={styles.statsGrid}>
        {/* Total Invested */}
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Total Invested</Text>
          <Text style={styles.statNumber}>
            {formatCurrency(metrics.totalInvestment, currency)}
          </Text>
        </View>

        {/* Overall Profit / Loss */}
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Overall Return</Text>
          <View style={styles.returnRow}>
            <MaterialCommunityIcons
              name={isOverallPositive ? 'arrow-up-bold' : 'arrow-down-bold'}
              size={14}
              color={isOverallPositive ? colors.success : colors.danger}
            />
            <Text
              style={[
                styles.statNumber,
                { color: isOverallPositive ? colors.success : colors.danger },
              ]}
            >
              {isOverallPositive ? '+' : ''}
              {formatCurrency(metrics.overallProfitLoss, currency)} (
              {isOverallPositive ? `+${metrics.overallProfitLossPercent}%` : `${metrics.overallProfitLossPercent}%`})
            </Text>
          </View>
        </View>

        {/* Today's P&L */}
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Today's Gain/Loss</Text>
          <View style={styles.returnRow}>
            <MaterialCommunityIcons
              name={isTodayPositive ? 'arrow-up-bold' : 'arrow-down-bold'}
              size={14}
              color={isTodayPositive ? colors.success : colors.danger}
            />
            <Text
              style={[
                styles.statNumber,
                { color: isTodayPositive ? colors.success : colors.danger },
              ]}
            >
              {isTodayPositive ? '+' : ''}
              {formatCurrency(metrics.todayProfitLoss, currency)} (
              {isTodayPositive ? `+${metrics.todayProfitLossPercent}%` : `${metrics.todayProfitLossPercent}%`})
            </Text>
          </View>
        </View>

        {/* Holdings Count */}
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Holdings & Units</Text>
          <Text style={styles.statNumber}>
            {metrics.holdingsCount} Stocks • {metrics.totalUnits.toLocaleString()} units
          </Text>
        </View>
      </View>
    </View>
  );
}

const createStyles = (colors: AppPalette) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    topHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    headerSubtitle: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.8,
      color: colors.textMuted,
    },
    mainValue: {
      fontSize: typography.heading,
      fontWeight: '800',
      color: colors.text,
      marginTop: 2,
    },
    addStockButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs + 2,
      borderRadius: radius.md,
      gap: 4,
    },
    addStockText: {
      fontSize: typography.label,
      fontWeight: '700',
    },
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
      paddingTop: spacing.xs,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    statBox: {
      width: '48.5%',
      backgroundColor: colors.backgroundAlt,
      borderRadius: radius.md,
      padding: spacing.sm,
    },
    statLabel: {
      fontSize: 11,
      color: colors.textMuted,
      fontWeight: '600',
      marginBottom: 2,
    },
    statNumber: {
      fontSize: typography.label,
      fontWeight: '700',
      color: colors.text,
    },
    returnRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
  });
