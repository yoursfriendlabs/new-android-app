import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { NepseIndex } from '../lib/nepse-data';
import { usePalette } from '@/src/stores/theme-store';
import { useThemedStyles } from '@/src/theme/use-themed-styles';
import { radius, spacing, typography } from '@/src/theme';
import type { AppPalette } from '@/src/theme/app-palette';

interface MarketIndexHeaderProps {
  nepseIndex: NepseIndex;
  sensitiveIndex: { current: number; change: number; percentChange: number };
  floatIndex: { current: number; change: number; percentChange: number };
  onRefresh: () => void;
  isRefreshing?: boolean;
}

export function MarketIndexHeader({
  nepseIndex,
  sensitiveIndex,
  floatIndex,
  onRefresh,
  isRefreshing,
}: MarketIndexHeaderProps) {
  const colors = usePalette();
  const styles = useThemedStyles(createStyles);

  const isPositive = nepseIndex.change >= 0;
  const isMarketOpen = nepseIndex.status === 'OPEN';

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.titleRow}>
          <Text style={styles.marketTitle}>NEPSE LIVE</Text>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: isMarketOpen ? colors.successSoft : colors.backgroundAlt },
            ]}
          >
            <View
              style={[
                styles.statusDot,
                { backgroundColor: isMarketOpen ? colors.success : colors.textSoft },
              ]}
            />
            <Text
              style={[
                styles.statusText,
                { color: isMarketOpen ? colors.success : colors.textSoft },
              ]}
            >
              {nepseIndex.status}
            </Text>
          </View>
        </View>

        <Pressable
          onPress={onRefresh}
          disabled={isRefreshing}
          style={({ pressed }) => [styles.refreshButton, pressed && { opacity: 0.7 }]}
          hitSlop={8}
        >
          <MaterialCommunityIcons
            name="refresh"
            size={18}
            color={colors.textMuted}
            style={isRefreshing ? { transform: [{ rotate: '45deg' }] } : undefined}
          />
          <Text style={styles.updatedText}>{nepseIndex.lastUpdated}</Text>
        </Pressable>
      </View>

      {/* Main NEPSE Index Value */}
      <View style={styles.mainIndexRow}>
        <View>
          <Text style={styles.mainIndexValue}>{nepseIndex.current.toLocaleString()}</Text>
          <View style={styles.changeRow}>
            <MaterialCommunityIcons
              name={isPositive ? 'arrow-up-bold' : 'arrow-down-bold'}
              size={16}
              color={isPositive ? colors.success : colors.danger}
            />
            <Text
              style={[
                styles.changeValue,
                { color: isPositive ? colors.success : colors.danger },
              ]}
            >
              {isPositive ? `+${nepseIndex.change.toFixed(2)}` : nepseIndex.change.toFixed(2)} (
              {isPositive ? `+${nepseIndex.percentChange.toFixed(2)}%` : `${nepseIndex.percentChange.toFixed(2)}%`})
            </Text>
          </View>
        </View>

        <View style={styles.turnoverContainer}>
          <Text style={styles.turnoverLabel}>Turnover</Text>
          <Text style={styles.turnoverValue}>
            NPR {(nepseIndex.turnover / 10000000).toFixed(2)} Cr
          </Text>
        </View>
      </View>

      {/* Sensitive & Float Index Sub-pills */}
      <View style={styles.subIndicesRow}>
        <View style={styles.subIndexPill}>
          <Text style={styles.subIndexLabel}>Sensitive</Text>
          <Text style={styles.subIndexValue}>{sensitiveIndex.current.toFixed(2)}</Text>
          <Text
            style={[
              styles.subIndexChange,
              { color: sensitiveIndex.change >= 0 ? colors.success : colors.danger },
            ]}
          >
            {sensitiveIndex.change >= 0 ? `+${sensitiveIndex.percentChange}%` : `${sensitiveIndex.percentChange}%`}
          </Text>
        </View>

        <View style={styles.subIndexPill}>
          <Text style={styles.subIndexLabel}>Float</Text>
          <Text style={styles.subIndexValue}>{floatIndex.current.toFixed(2)}</Text>
          <Text
            style={[
              styles.subIndexChange,
              { color: floatIndex.change >= 0 ? colors.success : colors.danger },
            ]}
          >
            {floatIndex.change >= 0 ? `+${floatIndex.percentChange}%` : `${floatIndex.percentChange}%`}
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
    topRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.xs,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    marketTitle: {
      fontSize: typography.caption,
      fontWeight: '800',
      letterSpacing: 1,
      color: colors.textMuted,
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.xs + 2,
      paddingVertical: 2,
      borderRadius: radius.pill,
      gap: 4,
    },
    statusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    statusText: {
      fontSize: 10,
      fontWeight: '700',
    },
    refreshButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    updatedText: {
      fontSize: 11,
      color: colors.textMuted,
    },
    mainIndexRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      marginVertical: spacing.xs,
    },
    mainIndexValue: {
      fontSize: typography.hero,
      fontWeight: '800',
      color: colors.text,
      lineHeight: 34,
    },
    changeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 2,
    },
    changeValue: {
      fontSize: typography.label,
      fontWeight: '700',
      marginLeft: 2,
    },
    turnoverContainer: {
      alignItems: 'flex-end',
    },
    turnoverLabel: {
      fontSize: 11,
      color: colors.textMuted,
    },
    turnoverValue: {
      fontSize: typography.body,
      fontWeight: '700',
      color: colors.text,
    },
    subIndicesRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.sm,
      paddingTop: spacing.xs,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    subIndexPill: {
      flex: 1,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.backgroundAlt,
      borderRadius: radius.md,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
    },
    subIndexLabel: {
      fontSize: typography.caption,
      color: colors.textMuted,
      fontWeight: '600',
    },
    subIndexValue: {
      fontSize: typography.label,
      fontWeight: '700',
      color: colors.text,
    },
    subIndexChange: {
      fontSize: 11,
      fontWeight: '700',
    },
  });
