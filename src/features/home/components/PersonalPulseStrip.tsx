import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatCurrency } from '@/src/shared/lib/format';
import { useTranslation } from '@/src/i18n';
import { usePalette } from '@/src/stores/theme-store';
import { radius, spacing, typography } from '@/src/theme';
import { useThemedStyles } from '@/src/theme/use-themed-styles';
import type { AppPalette } from '@/src/theme/app-palette';
import type { PersonalPulse } from '@/src/features/home/lib/personal-pulse';

interface PersonalPulseStripProps {
  pulse: PersonalPulse;
  saveGoal: number;
  currency: string;
  hideAmounts?: boolean;
  onPressToday: () => void;
  onPressMonth: () => void;
  onPressOwed: () => void;
}

function amountLabel(value: number, visible: boolean, currency: string) {
  if (!visible) return '••••';
  return formatCurrency(value, currency);
}

export function PersonalPulseStrip({
  currency,
  hideAmounts = false,
  onPressMonth,
  onPressOwed,
  onPressToday,
  pulse,
  saveGoal,
}: PersonalPulseStripProps) {
  const colors = usePalette();
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();

  const monthHint = saveGoal
    ? hideAmounts
      ? t('home.vsGoal')
      : `${amountLabel(Math.max(0, pulse.monthSaved), true, currency)} / ${formatCurrency(saveGoal, currency)}`
    : pulse.monthSaved >= 0
      ? t('home.savedThisMonth')
      : t('home.overspentThisMonth');

  const owedHint = pulse.topOwedBy
    ? pulse.oweCount > 1
      ? `${pulse.topOwedBy} +${pulse.oweCount - 1}`
      : pulse.topOwedBy
    : t('home.contacts');

  const cards = [
    {
      key: 'today',
      label: t('home.todaySpent'),
      value: amountLabel(pulse.todaySpent, !hideAmounts, currency),
      hint: t('home.tapToLog'),
      tone: 'danger' as const,
      onPress: onPressToday,
    },
    {
      key: 'month',
      label: t('home.thisMonth'),
      value: amountLabel(Math.abs(pulse.monthSaved), !hideAmounts, currency),
      hint: monthHint,
      tone: pulse.monthSaved >= 0 ? ('success' as const) : ('danger' as const),
      onPress: onPressMonth,
    },
    {
      key: 'owed',
      label: t('home.theyOweYou'),
      value: amountLabel(pulse.theyOweYou, !hideAmounts, currency),
      hint: owedHint,
      tone: 'neutral' as const,
      onPress: onPressOwed,
    },
  ];

  return (
    <View style={styles.row}>
      {cards.map((card) => {
        const backgroundColor =
          card.tone === 'success'
            ? colors.successSoft
            : card.tone === 'danger'
              ? colors.dangerSoft
              : colors.surface;
        const valueColor =
          card.tone === 'success' ? colors.success : card.tone === 'danger' ? colors.danger : colors.text;
        return (
          <Pressable
            key={card.key}
            onPress={card.onPress}
            style={[styles.card, { backgroundColor, borderColor: colors.border }]}>
            <View style={styles.top}>
              <Text style={[styles.label, { color: colors.textMuted }]}>{card.label}</Text>
              <MaterialCommunityIcons name="chevron-right" size={14} color={colors.textSoft} />
            </View>
            <Text numberOfLines={1} style={[styles.value, { color: valueColor }]}>
              {card.value}
            </Text>
            <Text numberOfLines={1} style={[styles.hint, { color: colors.textSoft }]}>
              {card.hint}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const createStyles = (_colors: AppPalette) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    card: {
      flex: 1,
      minWidth: 0,
      borderRadius: radius.md,
      borderWidth: 1,
      padding: spacing.sm,
      gap: 4,
    },
    top: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    label: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.3,
      textTransform: 'uppercase',
      flex: 1,
    },
    value: {
      fontSize: 15,
      fontWeight: '800',
      letterSpacing: -0.3,
    },
    hint: {
      fontSize: 11,
      fontWeight: '600',
    },
  });
