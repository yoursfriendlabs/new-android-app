import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useDateFormatStore, type DateFormat } from '@/src/stores/date-format-store';
import { usePalette } from '@/src/stores/theme-store';
import { radius, spacing, typography } from '@/src/theme';
import { useThemedStyles } from '@/src/theme/use-themed-styles';
import type { AppPalette } from '@/src/theme/app-palette';

interface DateFormatOption {
  id: DateFormat;
  label: string;
  nativeLabel: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  example: string;
  description: string;
}

const DATE_FORMATS: DateFormatOption[] = [
  {
    id: 'AD',
    label: 'English / Gregorian',
    nativeLabel: 'AD (ई.सं.)',
    icon: 'calendar-month-outline',
    example: '5 Sep 2026',
    description: 'Use standard English / Gregorian dates across your bills and ledger.',
  },
  {
    id: 'BS',
    label: 'Nepali / Bikram Sambat',
    nativeLabel: 'BS (वि.सं.)',
    icon: 'calendar-star',
    example: '२० भदौ २०८३',
    description: 'Use Nepali Bikram Sambat (BS) calendar and date picker everywhere.',
  },
];

export function DateFormatSelector() {
  const colors = usePalette();
  const styles = useThemedStyles(createStyles);
  const currentFormat = useDateFormatStore((state) => state.dateFormat);
  const setDateFormat = useDateFormatStore((state) => state.setDateFormat);

  async function handleSelect(format: DateFormat) {
    if (format === currentFormat) return;
    await setDateFormat(format);
    void Haptics.selectionAsync();
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.grid}>
        {DATE_FORMATS.map((df) => {
          const selected = df.id === currentFormat;
          return (
            <Pressable
              key={df.id}
              onPress={() => void handleSelect(df.id)}
              style={[
                styles.card,
                {
                  borderColor: selected ? colors.primary : colors.border,
                  backgroundColor: selected ? colors.accentSoft : colors.surface,
                },
              ]}>
              <View style={styles.cardTop}>
                <View style={[styles.iconBox, { backgroundColor: selected ? `${colors.primary}20` : colors.backgroundAlt }]}>
                  <MaterialCommunityIcons name={df.icon} size={20} color={selected ? colors.primary : colors.textMuted} />
                </View>
                {selected ? (
                  <View style={[styles.check, { backgroundColor: colors.primary }]}>
                    <MaterialCommunityIcons name="check" size={14} color={colors.onPrimary} />
                  </View>
                ) : (
                  <View style={[styles.uncheck, { borderColor: colors.border }]} />
                )}
              </View>
              <Text style={[styles.cardLabel, { color: colors.text }]}>{df.nativeLabel}</Text>
              <Text style={[styles.cardSublabel, { color: colors.textSoft }]}>{df.label}</Text>
              <View style={[styles.exampleBadge, { backgroundColor: colors.surface }]}>
                <Text style={[styles.exampleText, { color: colors.primary }]}>Ex: {df.example}</Text>
              </View>
              <Text numberOfLines={2} style={[styles.cardHint, { color: colors.textMuted }]}>
                {df.description}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const createStyles = (colors: AppPalette) =>
  StyleSheet.create({
    wrap: {
      gap: spacing.md,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    card: {
      width: '48%',
      flexGrow: 1,
      minWidth: 140,
      borderWidth: 1.5,
      borderRadius: radius.md,
      padding: spacing.md,
      gap: spacing.xxs,
    },
    cardTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.xs,
    },
    iconBox: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    check: {
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
    },
    uncheck: {
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
    },
    cardLabel: {
      fontSize: typography.body,
      fontWeight: '800',
    },
    cardSublabel: {
      fontSize: typography.caption,
      fontWeight: '600',
      marginBottom: 2,
    },
    exampleBadge: {
      paddingHorizontal: 6,
      paddingVertical: 3,
      borderRadius: radius.sm,
      alignSelf: 'flex-start',
      marginBottom: 4,
    },
    exampleText: {
      fontSize: 11,
      fontWeight: '700',
    },
    cardHint: {
      fontSize: 11,
      lineHeight: 16,
    },
  });
