import React from 'react';
import { StyleSheet, Text, View, Modal, Pressable, Platform, ScrollView } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { NepseCompany } from '../lib/nepse-scrip-list';
import { usePalette } from '@/src/stores/theme-store';
import { useThemedStyles } from '@/src/theme/use-themed-styles';
import { radius, spacing, typography } from '@/src/theme';
import type { AppPalette } from '@/src/theme/app-palette';

interface StockDetailSheetProps {
  visible: boolean;
  onClose: () => void;
  company: NepseCompany | null;
  isWatchlisted?: boolean;
  onToggleWatchlist?: (symbol: string) => void;
  onTrade?: (company: NepseCompany, type: 'BUY' | 'SELL') => void;
}

export function StockDetailSheet({
  visible,
  onClose,
  company,
  isWatchlisted,
  onToggleWatchlist,
  onTrade,
}: StockDetailSheetProps) {
  const colors = usePalette();
  const styles = useThemedStyles(createStyles);

  if (!company) return null;

  const isPositive = company.change >= 0;

  // Day Range Progress percentage
  const dayRangeSpan = company.high - company.low || 1;
  const dayProgress = Math.min(100, Math.max(0, ((company.ltp - company.low) / dayRangeSpan) * 100));

  // 52W Range Progress percentage
  const week52Span = company.high52 - company.low52 || 1;
  const week52Progress = Math.min(
    100,
    Math.max(0, ((company.ltp - company.low52) / week52Span) * 100)
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.sheetHeader}>
            <View style={styles.headerLeft}>
              <View style={styles.symbolRow}>
                <Text style={styles.symbol}>{company.symbol}</Text>
                {onToggleWatchlist && (
                  <Pressable
                    onPress={() => onToggleWatchlist(company.symbol)}
                    hitSlop={8}
                    style={styles.starBtn}
                  >
                    <MaterialCommunityIcons
                      name={isWatchlisted ? 'star' : 'star-outline'}
                      size={22}
                      color={isWatchlisted ? colors.warning : colors.textSoft}
                    />
                  </Pressable>
                )}
              </View>
              <Text style={styles.companyName}>{company.name}</Text>
              <View style={styles.sectorBadge}>
                <Text style={styles.sectorBadgeText}>{company.sector}</Text>
              </View>
            </View>

            <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
              <MaterialCommunityIcons name="close" size={22} color={colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent}>
            {/* Main Price Card */}
            <View style={styles.priceCard}>
              <View style={styles.priceRow}>
                <Text style={styles.ltp}>Rs {company.ltp.toFixed(1)}</Text>
                <View
                  style={[
                    styles.changeBadge,
                    { backgroundColor: isPositive ? colors.successSoft : colors.dangerSoft },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={isPositive ? 'arrow-up-bold' : 'arrow-down-bold'}
                    size={14}
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

              {/* Day's Range Visual Bar */}
              <View style={styles.rangeSection}>
                <View style={styles.rangeHeader}>
                  <Text style={styles.rangeLabel}>Day's Range</Text>
                  <Text style={styles.rangeValues}>
                    Rs {company.low} - Rs {company.high}
                  </Text>
                </View>
                <View style={styles.rangeBarTrack}>
                  <View
                    style={[
                      styles.rangeBarFill,
                      { width: `${dayProgress}%`, backgroundColor: colors.primary },
                    ]}
                  />
                </View>
              </View>

              {/* 52-Week Range Visual Bar */}
              <View style={styles.rangeSection}>
                <View style={styles.rangeHeader}>
                  <Text style={styles.rangeLabel}>52-Week Range</Text>
                  <Text style={styles.rangeValues}>
                    Rs {company.low52} - Rs {company.high52}
                  </Text>
                </View>
                <View style={styles.rangeBarTrack}>
                  <View
                    style={[
                      styles.rangeBarFill,
                      { width: `${week52Progress}%`, backgroundColor: colors.info },
                    ]}
                  />
                </View>
              </View>
            </View>

            {/* Key Statistics Grid */}
            <Text style={styles.sectionTitle}>Key Statistics</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Previous Close</Text>
                <Text style={styles.statVal}>Rs {company.previousClose.toFixed(1)}</Text>
              </View>

              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Open Price</Text>
                <Text style={styles.statVal}>Rs {company.open.toFixed(1)}</Text>
              </View>

              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Volume</Text>
                <Text style={styles.statVal}>{company.volume.toLocaleString()} shares</Text>
              </View>

              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Turnover</Text>
                <Text style={styles.statVal}>
                  NPR {(company.turnover / 100000).toFixed(2)} Lakhs
                </Text>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionRow}>
              <Pressable
                onPress={() => {
                  onClose();
                  onTrade?.(company, 'BUY');
                }}
                style={({ pressed }) => [
                  styles.tradeActionBtn,
                  { backgroundColor: colors.primary },
                  pressed && { opacity: 0.85 },
                ]}
              >
                <MaterialCommunityIcons name="plus-circle-outline" size={18} color="#FFFFFF" />
                <Text style={styles.tradeActionBtnText}>Buy Shares</Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  onClose();
                  onTrade?.(company, 'SELL');
                }}
                style={({ pressed }) => [
                  styles.tradeActionBtn,
                  { backgroundColor: colors.danger },
                  pressed && { opacity: 0.85 },
                ]}
              >
                <MaterialCommunityIcons name="minus-circle-outline" size={18} color="#FFFFFF" />
                <Text style={styles.tradeActionBtnText}>Sell Shares</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: AppPalette) =>
  StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    sheetContainer: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: radius.lg,
      borderTopRightRadius: radius.lg,
      maxHeight: '85%',
      paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    },
    sheetHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      padding: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerLeft: {
      flex: 1,
    },
    symbolRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    symbol: {
      fontSize: typography.heading,
      fontWeight: '800',
      color: colors.text,
    },
    starBtn: {
      padding: 4,
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
      paddingHorizontal: 8,
      paddingVertical: 3,
      marginTop: 6,
    },
    sectorBadgeText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textMuted,
    },
    closeBtn: {
      padding: 4,
    },
    scrollContent: {
      padding: spacing.md,
    },
    priceCard: {
      backgroundColor: colors.backgroundAlt,
      borderRadius: radius.lg,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    priceRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    ltp: {
      fontSize: typography.heading,
      fontWeight: '800',
      color: colors.text,
    },
    changeBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: radius.sm,
      gap: 4,
    },
    changeText: {
      fontSize: 12,
      fontWeight: '700',
    },
    rangeSection: {
      marginVertical: spacing.xs,
    },
    rangeHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
    },
    rangeLabel: {
      fontSize: 11,
      color: colors.textMuted,
      fontWeight: '600',
    },
    rangeValues: {
      fontSize: 11,
      color: colors.text,
      fontWeight: '700',
    },
    rangeBarTrack: {
      height: 6,
      backgroundColor: colors.border,
      borderRadius: 3,
      overflow: 'hidden',
    },
    rangeBarFill: {
      height: '100%',
      borderRadius: 3,
    },
    sectionTitle: {
      fontSize: typography.label,
      fontWeight: '800',
      color: colors.text,
      marginBottom: spacing.xs + 2,
    },
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
      marginBottom: spacing.lg,
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
    statVal: {
      fontSize: typography.label,
      fontWeight: '700',
      color: colors.text,
    },
    actionRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    tradeActionBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.md,
      borderRadius: radius.lg,
      gap: 6,
    },
    tradeActionBtnText: {
      fontSize: typography.body,
      fontWeight: '800',
      color: '#FFFFFF',
    },
  });
