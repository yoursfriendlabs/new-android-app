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
  currency: string;
  hideAmounts?: boolean;
  onPressIncome: () => void;
  onPressExpense: () => void;
  onPressReceive: () => void;
  onPressPay: () => void;
}

function amountLabel(value: number, visible: boolean, currency: string) {
  if (!visible) return '••••';
  return formatCurrency(value, currency);
}

export function PersonalPulseStrip({
  currency,
  hideAmounts = false,
  onPressExpense,
  onPressIncome,
  onPressPay,
  onPressReceive,
  pulse,
}: PersonalPulseStripProps) {
  const colors = usePalette();
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();

  const receiveHint = pulse.topOwedBy
    ? pulse.oweCount > 1
      ? `${pulse.topOwedBy} +${pulse.oweCount - 1}`
      : pulse.topOwedBy
    : t('home.contacts');
  const payHint = pulse.topOwedTo
    ? pulse.payCount > 1
      ? `${pulse.topOwedTo} +${pulse.payCount - 1}`
      : pulse.topOwedTo
    : t('home.contacts');

  const cards = [
    {
      key: 'income',
      label: t('money.totalIncome'),
      value: amountLabel(pulse.monthIncome, !hideAmounts, currency),
      hint: t('common.thisMonth'),
      tone: 'success' as const,
      onPress: onPressIncome,
    },
    {
      key: 'expense',
      label: t('money.totalExpense'),
      value: amountLabel(pulse.monthExpense, !hideAmounts, currency),
      hint: t('common.thisMonth'),
      tone: 'danger' as const,
      onPress: onPressExpense,
    },
    {
      key: 'receive',
      label: t('home.theyOweYou'),
      value: amountLabel(pulse.theyOweYou, !hideAmounts, currency),
      hint: receiveHint,
      tone: 'neutral' as const,
      onPress: onPressReceive,
    },
    {
      key: 'pay',
      label: t('home.iOweThem'),
      value: amountLabel(pulse.youOweThem, !hideAmounts, currency),
      hint: payHint,
      tone: 'neutral' as const,
      onPress: onPressPay,
    },
  ];

  return (
    <View style={styles.grid}>
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
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    card: {
      width: '48%',
      flexGrow: 1,
      minWidth: 140,
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
