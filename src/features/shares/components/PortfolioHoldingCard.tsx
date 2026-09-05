import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { StockHolding } from '../lib/portfolio-calc';
import { formatCurrency } from '@/src/shared/lib/format';
import { usePalette } from '@/src/stores/theme-store';
import { useThemedStyles } from '@/src/theme/use-themed-styles';
import { radius, spacing, typography } from '@/src/theme';
import type { AppPalette } from '@/src/theme/app-palette';

interface PortfolioHoldingCardProps {
  holding: StockHolding;
  currency?: string;
  onPress?: (holding: StockHolding) => void;
  onBuyMore?: (holding: StockHolding) => void;
  onSell?: (holding: StockHolding) => void;
}

export function PortfolioHoldingCard({
  holding,
  currency = 'NPR',
  onPress,
  onBuyMore,
  onSell,
}: PortfolioHoldingCardProps) {
  const colors = usePalette();
  const styles = useThemedStyles(createStyles);

  const isOverallPositive = holding.overallProfitLoss >= 0;
  const isTodayPositive = holding.todayProfitLoss >= 0;

  return (
    <Pressable
      onPress={() => onPress?.(holding)}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
    >
      <View style={styles.topRow}>
        <View style={styles.leftCol}>
          <Text style={styles.symbol}>{holding.symbol}</Text>
          <Text style={styles.companyName} numberOfLines={1}>
            {holding.name}
          </Text>
        </View>

        <View style={styles.rightCol}>
          <Text style={styles.currentValue}>
            {formatCurrency(holding.currentValue, currency)}
          </Text>
          <View
            style={[
              styles.pnlBadge,
              { backgroundColor: isOverallPositive ? colors.successSoft : colors.dangerSoft },
            ]}
          >
            <MaterialCommunityIcons
              name={isOverallPositive ? 'arrow-up' : 'arrow-down'}
              size={12}
              color={isOverallPositive ? colors.success : colors.danger}
            />
            <Text
              style={[
                styles.pnlText,
                { color: isOverallPositive ? colors.success : colors.danger },
              ]}
            >
              {isOverallPositive ? '+' : ''}
              {holding.overallProfitLossPercent}%
            </Text>
          </View>
        </View>
      </View>

      {/* Holding Details */}
      <View style={styles.detailsRow}>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Units</Text>
          <Text style={styles.detailVal}>{holding.totalUnits.toLocaleString()}</Text>
        </View>

        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Avg Buy (WACC)</Text>
          <Text style={styles.detailVal}>Rs {holding.avgBuyPrice.toFixed(1)}</Text>
        </View>

        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>LTP</Text>
          <Text style={styles.detailVal}>Rs {holding.currentLtp.toFixed(1)}</Text>
        </View>

        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Total P&L</Text>
          <Text
            style={[
              styles.detailVal,
              { color: isOverallPositive ? colors.success : colors.danger },
            ]}
          >
            {isOverallPositive ? '+' : ''}
            {formatCurrency(holding.overallProfitLoss, currency)}
          </Text>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionsRow}>
        <View style={styles.todayPnl}>
          <Text style={styles.todayPnlLabel}>Today: </Text>
          <Text
            style={[
              styles.todayPnlVal,
              { color: isTodayPositive ? colors.success : colors.danger },
            ]}
          >
            {isTodayPositive ? '+' : ''}
            {formatCurrency(holding.todayProfitLoss, currency)} ({isTodayPositive ? '+' : ''}
            {holding.todayProfitLossPercent}%)
          </Text>
        </View>

        <View style={styles.btnGroup}>
          {onBuyMore && (
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                onBuyMore(holding);
              }}
              style={({ pressed }) => [
                styles.actionBtn,
                { backgroundColor: colors.successSoft },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={[styles.actionBtnText, { color: colors.success }]}>+ Buy</Text>
            </Pressable>
          )}

          {onSell && (
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                onSell(holding);
              }}
              style={({ pressed }) => [
                styles.actionBtn,
                { backgroundColor: colors.dangerSoft },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={[styles.actionBtnText, { color: colors.danger }]}>Sell</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Pressable>
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
      marginBottom: spacing.xs + 2,
    },
    topRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    leftCol: {
      flex: 1,
      marginRight: spacing.sm,
    },
    symbol: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.text,
    },
    companyName: {
      fontSize: typography.caption,
      color: colors.textMuted,
      marginTop: 2,
    },
    rightCol: {
      alignItems: 'flex-end',
    },
    currentValue: {
      fontSize: typography.body,
      fontWeight: '800',
      color: colors.text,
    },
    pnlBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: radius.sm,
      marginTop: 4,
      gap: 2,
    },
    pnlText: {
      fontSize: 11,
      fontWeight: '700',
    },
    detailsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: spacing.sm,
      paddingVertical: spacing.xs,
      backgroundColor: colors.backgroundAlt,
      borderRadius: radius.md,
      paddingHorizontal: spacing.sm,
    },
    detailItem: {
      alignItems: 'center',
    },
    detailLabel: {
      fontSize: 10,
      color: colors.textMuted,
      fontWeight: '600',
    },
    detailVal: {
      fontSize: typography.caption,
      fontWeight: '700',
      color: colors.text,
      marginTop: 2,
    },
    actionsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: spacing.xs + 2,
      paddingTop: spacing.xs,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    todayPnl: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    todayPnlLabel: {
      fontSize: 11,
      color: colors.textMuted,
      fontWeight: '600',
    },
    todayPnlVal: {
      fontSize: 11,
      fontWeight: '700',
    },
    btnGroup: {
      flexDirection: 'row',
      gap: spacing.xs,
    },
    actionBtn: {
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: 3,
      borderRadius: radius.sm,
    },
    actionBtnText: {
      fontSize: 11,
      fontWeight: '700',
    },
  });
