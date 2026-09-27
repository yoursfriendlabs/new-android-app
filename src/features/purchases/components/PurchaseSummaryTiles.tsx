import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import type { PurchaseCounts } from '@/src/features/purchases/lib/purchase-view';
import { formatCurrency } from '@/src/shared/lib/format';
import { Text } from '@/src/shared/ui/Text';
import { usePalette } from '@/src/stores/theme-store';
import { layout, radius, shadows, spacing } from '@/src/theme';
import type { AppPalette } from '@/src/theme/app-palette';
import { useThemedStyles } from '@/src/theme/use-themed-styles';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

interface PurchaseSummaryTilesProps {
  counts: PurchaseCounts;
  currency: string;
}

/**
 * The four numbers above the list. Tile width is measured off the window rather
 * than guessed in percentages, so nothing is cut off on a small phone and the
 * row spreads to four across on a tablet.
 */
export function PurchaseSummaryTiles({ counts, currency }: PurchaseSummaryTilesProps) {
  const colors = usePalette();
  const styles = useThemedStyles(createStyles);
  const { width } = useWindowDimensions();

  const columns = width >= layout.tabletBreakpoint ? 4 : 2;
  const tileWidth = Math.floor(
    (width - layout.screenPadding * 2 - spacing.sm * (columns - 1)) / columns,
  );

  const tiles: Array<{ icon: IconName; iconBg: string; iconColor: string; value: string; label: string; valueColor?: string }> = [
    {
      icon: 'truck-delivery-outline',
      iconBg: colors.accentSoft,
      iconColor: colors.accent,
      value: String(counts.all),
      label: 'Bills',
    },
    {
      icon: 'clock-alert-outline',
      iconBg: colors.dangerSoft,
      iconColor: colors.danger,
      value: String(counts.due),
      label: 'Unpaid',
      valueColor: colors.danger,
    },
    {
      icon: 'cash-multiple',
      iconBg: colors.warningSoft,
      iconColor: colors.warning,
      value: formatCurrency(counts.totalDue, currency),
      label: 'Still to pay',
    },
    {
      icon: 'check-circle-outline',
      iconBg: colors.successSoft,
      iconColor: colors.success,
      value: String(counts.paid),
      label: 'Settled',
      valueColor: colors.success,
    },
  ];

  return (
    <View style={styles.grid}>
      {tiles.map((tile) => (
        <View key={tile.label} style={[styles.tile, { width: tileWidth }]}>
          <View style={[styles.iconBox, { backgroundColor: tile.iconBg }]}>
            <MaterialCommunityIcons color={tile.iconColor} name={tile.icon} size={18} />
          </View>
          <Text
            variant="numeric"
            color={tile.valueColor}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}>
            {tile.value}
          </Text>
          <Text variant="overline" tone="muted" numberOfLines={1}>
            {tile.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const createStyles = (colors: AppPalette) =>
  StyleSheet.create({
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    tile: {
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: spacing.sm,
      gap: 2,
      ...shadows.card,
    },
    iconBox: {
      width: 32,
      height: 32,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 2,
    },
  });
