import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { NepseCompany } from '../lib/nepse-scrip-list';
import { usePalette } from '@/src/stores/theme-store';
import { useThemedStyles } from '@/src/theme/use-themed-styles';
import { radius, spacing, typography } from '@/src/theme';
import type { AppPalette } from '@/src/theme/app-palette';

interface StockQuoteCardProps {
  company: NepseCompany;
  isWatchlisted?: boolean;
  onToggleWatchlist?: (symbol: string) => void;
  onPress?: (company: NepseCompany) => void;
  onQuickTrade?: (company: NepseCompany) => void;
}

export function StockQuoteCard({
  company,
  isWatchlisted,
  onToggleWatchlist,
  onPress,
  onQuickTrade,
}: StockQuoteCardProps) {
  const colors = usePalette();
  const styles = useThemedStyles(createStyles);

  const isPositive = company.change >= 0;

  return (
    <Pressable
      onPress={() => onPress?.(company)}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
    >
      <View style={styles.topRow}>
        <View style={styles.leftInfo}>
          <View style={styles.symbolRow}>
            <Text style={styles.symbol}>{company.symbol}</Text>
            {onToggleWatchlist && (
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  onToggleWatchlist(company.symbol);
                }}
                hitSlop={8}
                style={styles.starButton}
              >
                <MaterialCommunityIcons
                  name={isWatchlisted ? 'star' : 'star-outline'}
                  size={18}
                  color={isWatchlisted ? colors.warning : colors.textSoft}
                />
              </Pressable>
            )}
          </View>
          <Text style={styles.companyName} numberOfLines={1}>
            {company.name}
          </Text>
          <View style={styles.sectorBadge}>
            <Text style={styles.sectorBadgeText}>{company.sector}</Text>
          </View>
        </View>

        <View style={styles.rightPricing}>
          <Text style={styles.ltp}>Rs {company.ltp.toFixed(1)}</Text>
          <View
            style={[
              styles.changeBadge,
              { backgroundColor: isPositive ? colors.successSoft : colors.dangerSoft },
            ]}
          >
            <MaterialCommunityIcons
              name={isPositive ? 'arrow-up' : 'arrow-down'}
              size={12}
              color={isPositive ? colors.success : colors.danger}
            />
            <Text
              style={[
                styles.changeText,
                { color: isPositive ? colors.success : colors.danger },
              ]}
            >
              {isPositive ? `+${company.change.toFixed(1)}` : company.change.toFixed(1)} (
              {isPositive ? `+${company.percentChange.toFixed(2)}%` : `${company.percentChange.toFixed(2)}%`})
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.bottomRow}>
        <View style={styles.rangeInfo}>
          <Text style={styles.rangeLabel}>H: </Text>
          <Text style={styles.rangeValue}>Rs {company.high.toFixed(1)}</Text>
          <Text style={[styles.rangeLabel, { marginLeft: 8 }]}>L: </Text>
          <Text style={styles.rangeValue}>Rs {company.low.toFixed(1)}</Text>
        </View>

        {onQuickTrade && (
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              onQuickTrade(company);
            }}
            style={({ pressed }) => [
              styles.tradeButton,
              { backgroundColor: colors.accentSoft },
              pressed && { opacity: 0.7 },
            ]}
          >
            <MaterialCommunityIcons name="plus" size={14} color={colors.primary} />
            <Text style={[styles.tradeButtonText, { color: colors.primary }]}>Trade</Text>
          </Pressable>
        )}
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
    leftInfo: {
      flex: 1,
      marginRight: spacing.sm,
    },
    symbolRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    symbol: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.text,
    },
    starButton: {
      padding: 2,
    },
    companyName: {
      fontSize: typography.caption,
      color: colors.textMuted,
      marginTop: 2,
    },
    sectorBadge: {
      alignSelf: 'flex-start',
      backgroundColor: colors.backgroundAlt,
      borderRadius: radius.sm,
      paddingHorizontal: 6,
      paddingVertical: 2,
      marginTop: 4,
    },
    sectorBadgeText: {
      fontSize: 10,
      fontWeight: '600',
      color: colors.textMuted,
    },
    rightPricing: {
      alignItems: 'flex-end',
    },
    ltp: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.text,
    },
    changeBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 6,
      paddingVertical: 3,
      borderRadius: radius.sm,
      marginTop: 4,
      gap: 2,
    },
    changeText: {
      fontSize: 11,
      fontWeight: '700',
    },
    bottomRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: spacing.xs + 2,
      paddingTop: spacing.xs,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    rangeInfo: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    rangeLabel: {
      fontSize: 11,
      color: colors.textMuted,
      fontWeight: '600',
    },
    rangeValue: {
      fontSize: 11,
      color: colors.text,
      fontWeight: '700',
    },
    tradeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
      borderRadius: radius.sm,
      gap: 2,
    },
    tradeButtonText: {
      fontSize: 11,
      fontWeight: '700',
    },
  });
