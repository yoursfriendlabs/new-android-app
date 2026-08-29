import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CoinChip } from '@/src/features/habits/components/CoinChip';
import { formatCurrency } from '@/src/shared/lib/format';
import { WEEK_CHALLENGE_TARGET, type HabitBadge, type HabitStreak } from '@/src/features/habits/lib/habits';
import { usePalette } from '@/src/stores/theme-store';
import { radius, shadows, spacing, typography } from '@/src/theme';
import { useThemedStyles } from '@/src/theme/use-themed-styles';
import type { AppPalette } from '@/src/theme/app-palette';

interface StreakHeroProps {
  streak: HabitStreak;
  weekCount: number;
  savedThisMonth: number;
  saveGoal: number;
  currency: string;
  nextBadge?: HabitBadge | null;
  coins?: number;
  onLogIncome: () => void;
  onLogExpense: () => void;
  onSetGoal?: () => void;
}

export function StreakHero({
  currency,
  nextBadge,
  onLogExpense,
  onLogIncome,
  onSetGoal,
  saveGoal,
  savedThisMonth,
  streak,
  weekCount,
  coins = 0,
}: StreakHeroProps) {
  const colors = usePalette();
  const styles = useThemedStyles(createStyles);
  const weekProgress = Math.min(1, weekCount / WEEK_CHALLENGE_TARGET);
  const goalProgress = saveGoal > 0 ? Math.min(1, Math.max(0, savedThisMonth) / saveGoal) : 0;
  const headline = !streak.current
    ? 'Start a streak today'
    : streak.loggedToday
      ? `${streak.current}-day streak`
      : `Keep your ${streak.current}-day streak`;
  const copy = !streak.current
    ? 'Log one income or expense. Tomorrow it becomes a streak.'
    : streak.loggedToday
      ? 'You already logged today. Come back tomorrow.'
      : 'One log today keeps the fire going.';

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.top}>
        <View style={[styles.fire, { backgroundColor: streak.current ? colors.warningSoft : colors.backgroundAlt }]}>
          <MaterialCommunityIcons
            name={streak.current ? 'fire' : 'fire-off'}
            size={28}
            color={streak.current ? colors.warning : colors.textSoft}
          />
        </View>
        <View style={styles.copy}>
          <Text style={[styles.kicker, { color: colors.warning }]}>
            {streak.best > 1 ? `Best ${streak.best}` : 'Daily habit'}
          </Text>
          <Text style={[styles.title, { color: colors.text }]}>{headline}</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>{copy}</Text>
        </View>
        <CoinChip coins={coins} compact />
      </View>

      <View style={styles.block}>
        <View style={styles.blockHead}>
          <Text style={[styles.blockLabel, { color: colors.textSoft }]}>This week</Text>
          <Text style={[styles.blockValue, { color: colors.text }]}>
            {weekCount}/{WEEK_CHALLENGE_TARGET} days
          </Text>
        </View>
        <View style={[styles.track, { backgroundColor: colors.backgroundAlt }]}>
          <View style={[styles.fill, { width: `${weekProgress * 100}%`, backgroundColor: colors.primary }]} />
        </View>
      </View>

      <Pressable style={styles.block} onPress={onSetGoal} disabled={!onSetGoal}>
        <View style={styles.blockHead}>
          <Text style={[styles.blockLabel, { color: colors.textSoft }]}>Saved this month</Text>
          <Text style={[styles.blockValue, { color: savedThisMonth >= 0 ? colors.success : colors.danger }]}>
            {formatCurrency(Math.abs(savedThisMonth), currency)}
            {saveGoal ? ` / ${formatCurrency(saveGoal, currency)}` : ''}
          </Text>
        </View>
        <View style={[styles.track, { backgroundColor: colors.backgroundAlt }]}>
          <View
            style={[
              styles.fill,
              {
                width: `${goalProgress * 100}%`,
                backgroundColor: savedThisMonth >= 0 ? colors.success : colors.danger,
              },
            ]}
          />
        </View>
      </Pressable>

      {nextBadge ? (
        <Text style={[styles.next, { color: colors.textMuted }]}>Next: {nextBadge.title} — {nextBadge.hint}</Text>
      ) : (
        <Text style={[styles.next, { color: colors.success }]}>Every badge unlocked. Keep logging.</Text>
      )}

      <View style={styles.actions}>
        <Pressable style={[styles.action, { backgroundColor: colors.successSoft }]} onPress={onLogIncome}>
          <Text style={[styles.actionLabel, { color: colors.success }]}>Income</Text>
        </Pressable>
        <Pressable style={[styles.action, { backgroundColor: colors.primary }]} onPress={onLogExpense}>
          <Text style={[styles.actionLabel, { color: colors.white }]}>Expense</Text>
        </Pressable>
      </View>
    </View>
  );
}

const createStyles = (_colors: AppPalette) =>
  StyleSheet.create({
    card: {
      borderRadius: radius.lg,
      borderWidth: 1,
      padding: spacing.md,
      gap: spacing.md,
      ...shadows.card,
    },
    top: {
      flexDirection: 'row',
      gap: spacing.sm,
      alignItems: 'flex-start',
    },
    fire: {
      width: 56,
      height: 56,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    copy: {
      flex: 1,
      gap: 2,
    },
    kicker: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    title: {
      fontSize: typography.subheading,
      fontWeight: '800',
    },
    subtitle: {
      fontSize: typography.caption,
      lineHeight: 18,
    },
    block: {
      gap: 6,
    },
    blockHead: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    blockLabel: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    blockValue: {
      fontSize: typography.caption,
      fontWeight: '700',
    },
    track: {
      height: 8,
      borderRadius: radius.pill,
      overflow: 'hidden',
    },
    fill: {
      height: 8,
      borderRadius: radius.pill,
    },
    next: {
      fontSize: typography.caption,
      lineHeight: 18,
    },
    actions: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    action: {
      flex: 1,
      minHeight: 46,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionLabel: {
      fontSize: typography.body,
      fontWeight: '800',
    },
  });
