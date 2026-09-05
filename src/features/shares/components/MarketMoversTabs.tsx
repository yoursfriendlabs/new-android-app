import React from 'react';
import { StyleSheet, Text, View, Pressable, ScrollView } from 'react-native';
import { NEPSE_SECTORS, NepseSector } from '../lib/nepse-scrip-list';
import { usePalette } from '@/src/stores/theme-store';
import { useThemedStyles } from '@/src/theme/use-themed-styles';
import { radius, spacing, typography } from '@/src/theme';
import type { AppPalette } from '@/src/theme/app-palette';

export type MoverTab = 'ALL' | 'GAINERS' | 'LOSERS' | 'TURNOVER' | 'WATCHLIST';

interface MarketMoversTabsProps {
  selectedTab: MoverTab;
  onSelectTab: (tab: MoverTab) => void;
  selectedSector: NepseSector;
  onSelectSector: (sector: NepseSector) => void;
  watchlistCount?: number;
}

export function MarketMoversTabs({
  selectedTab,
  onSelectTab,
  selectedSector,
  onSelectSector,
  watchlistCount = 0,
}: MarketMoversTabsProps) {
  const colors = usePalette();
  const styles = useThemedStyles(createStyles);

  const tabs: { key: MoverTab; label: string; badge?: number }[] = [
    { key: 'ALL', label: 'All Stocks' },
    { key: 'WATCHLIST', label: 'Watchlist', badge: watchlistCount },
    { key: 'GAINERS', label: 'Top Gainers' },
    { key: 'LOSERS', label: 'Top Losers' },
    { key: 'TURNOVER', label: 'High Turnover' },
  ];

  return (
    <View style={styles.container}>
      {/* Category / Mover Filter Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsScroll}
      >
        {tabs.map((tab) => {
          const isActive = selectedTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              onPress={() => onSelectTab(tab.key)}
              style={[
                styles.tabItem,
                isActive && { backgroundColor: colors.primary },
              ]}
            >
              <Text
                style={[
                  styles.tabLabel,
                  { color: isActive ? colors.white : colors.textMuted },
                ]}
              >
                {tab.label}
              </Text>
              {tab.badge !== undefined && tab.badge > 0 && (
                <View
                  style={[
                    styles.tabBadge,
                    {
                      backgroundColor: isActive ? 'rgba(255,255,255,0.25)' : colors.backgroundAlt,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.tabBadgeText,
                      { color: isActive ? colors.white : colors.text },
                    ]}
                  >
                    {tab.badge}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Sector Pills (Shown when in ALL or WATCHLIST mode) */}
      {(selectedTab === 'ALL' || selectedTab === 'WATCHLIST') && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.sectorScroll}
        >
          {NEPSE_SECTORS.map((sector) => {
            const isSectorActive = selectedSector === sector;
            return (
              <Pressable
                key={sector}
                onPress={() => onSelectSector(sector)}
                style={[
                  styles.sectorPill,
                  isSectorActive
                    ? { backgroundColor: colors.accentSoft, borderColor: colors.primary }
                    : { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <Text
                  style={[
                    styles.sectorText,
                    { color: isSectorActive ? colors.primary : colors.textMuted },
                    isSectorActive && { fontWeight: '700' },
                  ]}
                >
                  {sector}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const createStyles = (colors: AppPalette) =>
  StyleSheet.create({
    container: {
      marginBottom: spacing.sm,
    },
    tabsScroll: {
      flexDirection: 'row',
      gap: spacing.xs,
      paddingBottom: spacing.xs,
    },
    tabItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs + 2,
      borderRadius: radius.pill,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 6,
    },
    tabLabel: {
      fontSize: typography.label,
      fontWeight: '600',
    },
    tabBadge: {
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: radius.pill,
    },
    tabBadgeText: {
      fontSize: 10,
      fontWeight: '700',
    },
    sectorScroll: {
      flexDirection: 'row',
      gap: spacing.xs,
      paddingVertical: spacing.xs,
    },
    sectorPill: {
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: 4,
      borderRadius: radius.md,
      borderWidth: 1,
    },
    sectorText: {
      fontSize: typography.caption,
      fontWeight: '500',
    },
  });
