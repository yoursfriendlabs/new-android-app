import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, type ViewStyle } from 'react-native';

import { usePalette } from '@/src/stores/theme-store';
import { radius, spacing } from '@/src/theme';

/**
 * Content-shaped loading placeholders. Prefer these over a centred spinner:
 * the screen keeps its layout, so arriving data does not make everything jump.
 */

function usePulse() {
  const pulse = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.45,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return pulse;
}

interface SkeletonProps {
  width?: ViewStyle['width'];
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function Skeleton({ borderRadius = radius.sm, height = 14, style, width = '100%' }: SkeletonProps) {
  const colors = usePalette();
  const pulse = usePulse();

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ backgroundColor: colors.backgroundAlt, borderRadius, height, opacity: pulse, width }, style]}
    />
  );
}

interface SkeletonListProps {
  /** How many placeholder rows to draw. */
  count?: number;
  /** Adds a leading circle for avatar/icon rows. */
  avatar?: boolean;
  /** Adds a trailing amount block for money rows. */
  trailing?: boolean;
}

/** Placeholder for list screens — parties, ledger, inventory, expenses. */
export function SkeletonList({ avatar = true, count = 6, trailing = true }: SkeletonListProps) {
  const colors = usePalette();

  return (
    <View style={styles.list}>
      {Array.from({ length: count }).map((_, index) => (
        <View
          key={index}
          style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {avatar ? <Skeleton width={40} height={40} borderRadius={14} /> : null}
          <View style={styles.rowCopy}>
            <Skeleton width="62%" height={14} />
            <Skeleton width="38%" height={11} />
          </View>
          {trailing ? <Skeleton width={64} height={16} /> : null}
        </View>
      ))}
    </View>
  );
}

/** Placeholder for the home dashboard's metric tiles. */
export function SkeletonMetricGrid({ count = 6 }: { count?: number }) {
  const colors = usePalette();

  return (
    <View style={styles.grid}>
      {Array.from({ length: count }).map((_, index) => (
        <View
          key={index}
          style={[styles.tile, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Skeleton width="55%" height={10} />
          <Skeleton width="75%" height={20} />
          <Skeleton width="40%" height={10} />
        </View>
      ))}
    </View>
  );
}

/** Placeholder for the POS / inventory product grid. */
export function SkeletonCardGrid({ columns = 2, count = 6 }: { columns?: number; count?: number }) {
  const colors = usePalette();
  const width = `${100 / columns - 2}%` as ViewStyle['width'];

  return (
    <View style={styles.grid}>
      {Array.from({ length: count }).map((_, index) => (
        <View
          key={index}
          style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, width }]}>
          <Skeleton width="100%" height={72} borderRadius={radius.sm} />
          <Skeleton width="80%" height={13} />
          <Skeleton width="45%" height={13} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  rowCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tile: {
    width: '48%',
    flexGrow: 1,
    minWidth: 148,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.xs,
  },
  card: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.sm,
    gap: spacing.xs,
    flexGrow: 1,
  },
});
