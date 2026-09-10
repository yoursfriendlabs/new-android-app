import { useMemo } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Line as SvgLine, Stop } from 'react-native-svg';

import { Text } from '@/src/shared/ui/Text';
import { usePalette } from '@/src/stores/theme-store';
import { spacing } from '@/src/theme';

export interface FlowChartPoint {
  key: string;
  label: string;
  income: number;
  expense: number;
}

interface FlowLineChartProps {
  points: FlowChartPoint[];
  height?: number;
  /** Horizontal padding of the card the chart sits in, so the width matches. */
  horizontalInset?: number;
}

/** Cubic path through the points, so the trend reads as a shape rather than spikes. */
function smoothPath(coords: Array<{ x: number; y: number }>) {
  if (!coords.length) return '';
  if (coords.length === 1) return `M ${coords[0].x} ${coords[0].y}`;

  let path = `M ${coords[0].x} ${coords[0].y}`;
  for (let i = 0; i < coords.length - 1; i += 1) {
    const current = coords[i];
    const next = coords[i + 1];
    const midX = (current.x + next.x) / 2;
    path += ` C ${midX} ${current.y}, ${midX} ${next.y}, ${next.x} ${next.y}`;
  }
  return path;
}

/**
 * Money in and money out over time. Two series on one axis, each with a legend
 * entry and an end label, so identity never rests on colour alone.
 */
export function FlowLineChart({ height = 120, horizontalInset = 32, points }: FlowLineChartProps) {
  const colors = usePalette();
  const { width: windowWidth } = useWindowDimensions();
  const width = Math.max(220, windowWidth - horizontalInset * 2);

  const { area, expensePath, incomePath, lastExpense, lastIncome } = useMemo(() => {
    const peak = Math.max(...points.flatMap((point) => [point.income, point.expense]), 1);
    const top = 8;
    const bottom = height - 18;
    const step = points.length > 1 ? width / (points.length - 1) : 0;
    const toCoords = (pick: (point: FlowChartPoint) => number) =>
      points.map((point, index) => ({
        x: index * step,
        y: bottom - (pick(point) / peak) * (bottom - top),
      }));

    const income = toCoords((point) => point.income);
    const expense = toCoords((point) => point.expense);
    const incomeLine = smoothPath(income);

    return {
      area: incomeLine ? `${incomeLine} L ${width} ${bottom} L 0 ${bottom} Z` : '',
      expensePath: smoothPath(expense),
      incomePath: incomeLine,
      lastExpense: expense[expense.length - 1],
      lastIncome: income[income.length - 1],
    };
  }, [height, points, width]);

  if (!points.length) return null;

  const baseline = height - 18;

  return (
    <View>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="incomeWash" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.success} stopOpacity={0.18} />
            <Stop offset="1" stopColor={colors.success} stopOpacity={0} />
          </LinearGradient>
        </Defs>

        <SvgLine x1={0} y1={baseline} x2={width} y2={baseline} stroke={colors.border} strokeWidth={1} />

        <Path d={area} fill="url(#incomeWash)" />
        <Path
          d={incomePath}
          stroke={colors.success}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <Path
          d={expensePath}
          stroke={colors.danger}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />

        {lastIncome ? (
          <Circle cx={lastIncome.x} cy={lastIncome.y} r={4} fill={colors.success} stroke={colors.surface} strokeWidth={2} />
        ) : null}
        {lastExpense ? (
          <Circle cx={lastExpense.x} cy={lastExpense.y} r={4} fill={colors.danger} stroke={colors.surface} strokeWidth={2} />
        ) : null}
      </Svg>

      <View style={[styles.axis, { width }]}>
        {points.map((point) => (
          <Text key={point.key} variant="caption" tone="soft" style={styles.axisLabel}>
            {point.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  axis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xxs,
  },
  axisLabel: {
    flex: 1,
    textAlign: 'center',
  },
});
