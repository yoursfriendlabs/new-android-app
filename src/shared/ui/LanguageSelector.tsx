import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useLanguageStore, type Language } from '@/src/stores/language-store';
import { usePalette } from '@/src/stores/theme-store';
import { radius, spacing, typography } from '@/src/theme';
import { useThemedStyles } from '@/src/theme/use-themed-styles';
import type { AppPalette } from '@/src/theme/app-palette';

interface LanguageOption {
  id: Language;
  label: string;
  nativeLabel: string;
  flag: string;
  description: string;
}

const LANGUAGES: LanguageOption[] = [
  {
    id: 'en',
    label: 'English',
    nativeLabel: 'English (US/UK)',
    flag: '🇺🇸',
    description: 'Use standard English language for menus, accounts & bills.',
  },
  {
    id: 'ne',
    label: 'Nepali',
    nativeLabel: 'नेपाली',
    flag: '🇳🇵',
    description: 'पसल, हिसाबकिताब, बिलिङ र कर्मचारीका लागि नेपाली भाषा।',
  },
];

export function LanguageSelector() {
  const colors = usePalette();
  const styles = useThemedStyles(createStyles);
  const currentLanguage = useLanguageStore((state) => state.language);
  const setLanguage = useLanguageStore((state) => state.setLanguage);

  async function handleSelect(lang: Language) {
    if (lang === currentLanguage) return;
    await setLanguage(lang);
    void Haptics.selectionAsync();
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.grid}>
        {LANGUAGES.map((lang) => {
          const selected = lang.id === currentLanguage;
          return (
            <Pressable
              key={lang.id}
              onPress={() => void handleSelect(lang.id)}
              style={[
                styles.card,
                {
                  borderColor: selected ? colors.primary : colors.border,
                  backgroundColor: selected ? colors.accentSoft : colors.surface,
                },
              ]}>
              <View style={styles.cardTop}>
                <Text style={styles.flag}>{lang.flag}</Text>
                {selected ? (
                  <View style={[styles.check, { backgroundColor: colors.primary }]}>
                    <MaterialCommunityIcons name="check" size={14} color={colors.onPrimary} />
                  </View>
                ) : (
                  <View style={[styles.uncheck, { borderColor: colors.border }]} />
                )}
              </View>
              <Text style={[styles.cardLabel, { color: colors.text }]}>{lang.nativeLabel}</Text>
              <Text style={[styles.cardSublabel, { color: colors.textSoft }]}>{lang.label}</Text>
              <Text numberOfLines={2} style={[styles.cardHint, { color: colors.textMuted }]}>
                {lang.description}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function CompactLanguageToggle() {
  const colors = usePalette();
  const styles = useThemedStyles(createStyles);
  const currentLanguage = useLanguageStore((state) => state.language);
  const setLanguage = useLanguageStore((state) => state.setLanguage);

  return (
    <View style={styles.toggleRow}>
      {LANGUAGES.map((lang) => {
        const selected = lang.id === currentLanguage;
        return (
          <Pressable
            key={lang.id}
            onPress={() => {
              void setLanguage(lang.id);
              void Haptics.selectionAsync();
            }}
            style={[
              styles.toggleChip,
              {
                borderColor: selected ? colors.primary : colors.border,
                backgroundColor: selected ? colors.primary : colors.surface,
              },
            ]}>
            <Text
              style={[
                styles.toggleChipText,
                { color: selected ? colors.onPrimary : colors.text },
              ]}>
              {lang.flag} {lang.nativeLabel}
            </Text>
          </Pressable>
        );
      })}
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
    flag: {
      fontSize: 24,
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
      borderWidth: 1.5,
    },
    cardLabel: {
      fontSize: typography.body,
      fontWeight: '800',
    },
    cardSublabel: {
      fontSize: typography.caption,
      fontWeight: '600',
      marginBottom: spacing.xs,
    },
    cardHint: {
      fontSize: 11,
      lineHeight: 16,
    },
    toggleRow: {
      flexDirection: 'row',
      gap: spacing.xs,
    },
    toggleChip: {
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: radius.pill,
      borderWidth: 1,
    },
    toggleChipText: {
      fontSize: typography.caption,
      fontWeight: '700',
    },
  });
