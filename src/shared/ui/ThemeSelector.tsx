import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { usePalette, useThemeStore } from '@/src/stores/theme-store';
import { COLOR_THEMES, CUSTOM_COLOR_THEME_ID, parseHexColor } from '@/src/theme/color-themes';
import { radius, spacing, typography } from '@/src/theme';
import { useThemedStyles } from '@/src/theme/use-themed-styles';
import type { AppPalette } from '@/src/theme/app-palette';

export function ThemeSelector() {
  const colors = usePalette();
  const styles = useThemedStyles(createStyles);
  const themeId = useThemeStore((state) => state.themeId);
  const customHex = useThemeStore((state) => state.customHex);
  const palette = useThemeStore((state) => state.palette);
  const setThemeId = useThemeStore((state) => state.setThemeId);
  const setCustomColor = useThemeStore((state) => state.setCustomColor);
  const [hexValue, setHexValue] = useState(customHex || colors.primary);
  const [hexError, setHexError] = useState('');

  async function applyHex() {
    const parsed = parseHexColor(hexValue);
    if (!parsed) {
      setHexError('Enter a valid hex color, like #8FE03F.');
      return;
    }
    setHexError('');
    await setCustomColor(parsed);
    void Haptics.selectionAsync();
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.grid}>
        {COLOR_THEMES.map((theme) => {
          const selected = theme.id === themeId;
          return (
            <Pressable
              key={theme.id}
              onPress={() => {
                void setThemeId(theme.id);
                void Haptics.selectionAsync();
              }}
              style={[
                styles.card,
                {
                  borderColor: selected ? colors.primary : colors.border,
                  backgroundColor: selected ? colors.accentSoft : colors.surface,
                },
              ]}>
              <View style={styles.cardTop}>
                <View style={[styles.swatch, { backgroundColor: theme.swatch }]} />
                {selected ? (
                  <View style={[styles.check, { backgroundColor: colors.primary }]}>
                    <MaterialCommunityIcons name="check" size={12} color={colors.onPrimary} />
                  </View>
                ) : null}
              </View>
              <Text style={[styles.cardLabel, { color: colors.text }]}>{theme.label}</Text>
              <Text numberOfLines={2} style={[styles.cardHint, { color: colors.textMuted }]}>
                {theme.hint}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={[styles.customBox, { borderColor: colors.border, backgroundColor: colors.surface }]}>
        <Text style={[styles.customLabel, { color: colors.textSoft }]}>Your color</Text>
        <Text style={[styles.customHint, { color: colors.textMuted }]}>
          Paste a hex code if you want a different accent. Signal Lime is the default.
        </Text>
        <View style={styles.customRow}>
          <View
            style={[
              styles.preview,
              {
                backgroundColor: parseHexColor(hexValue) || colors.primary,
                borderColor: themeId === CUSTOM_COLOR_THEME_ID ? colors.primary : colors.border,
              },
            ]}
          />
          <TextInput
            value={hexValue}
            onChangeText={(value) => {
              setHexValue(value);
              if (hexError) setHexError('');
            }}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="#1a73e8"
            placeholderTextColor={colors.textSoft}
            style={[
              styles.hexInput,
              {
                color: colors.text,
                borderColor: hexError ? colors.danger : colors.border,
                backgroundColor: colors.backgroundWarm,
              },
            ]}
          />
          <Pressable
            onPress={() => void applyHex()}
            style={[styles.applyButton, { backgroundColor: colors.primary }]}>
            <Text style={[styles.applyLabel, { color: colors.onPrimary }]}>Apply</Text>
          </Pressable>
        </View>
        {hexError ? <Text style={[styles.error, { color: colors.danger }]}>{hexError}</Text> : null}
      </View>
    </View>
  );
}

export function CompactThemeRow() {
  const colors = usePalette();
  const styles = useThemedStyles(createStyles);
  const themeId = useThemeStore((state) => state.themeId);
  const customHex = useThemeStore((state) => state.customHex);
  const palette = useThemeStore((state) => state.palette);
  const setThemeId = useThemeStore((state) => state.setThemeId);
  const setCustomColor = useThemeStore((state) => state.setCustomColor);

  return (
    <View style={styles.compactRow}>
      {COLOR_THEMES.map((theme) => {
        const selected = theme.id === themeId;
        return (
          <Pressable
            key={theme.id}
            onPress={() => {
              void setThemeId(theme.id);
              void Haptics.selectionAsync();
            }}
            style={[
              styles.dot,
              { backgroundColor: theme.swatch, borderColor: selected ? colors.text : colors.white },
              selected && styles.dotSelected,
            ]}
            accessibilityLabel={theme.label}
          />
        );
      })}
      {customHex ? (
        <Pressable
          onPress={() => void setCustomColor(customHex)}
          style={[
            styles.dot,
            {
              backgroundColor: colors.primary,
              borderColor: themeId === CUSTOM_COLOR_THEME_ID ? colors.text : colors.white,
            },
            themeId === CUSTOM_COLOR_THEME_ID && styles.dotSelected,
          ]}
          accessibilityLabel="Custom color"
        />
      ) : null}
    </View>
  );
}

const createStyles = (colors: AppPalette) => StyleSheet.create({
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
    gap: spacing.xs,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  swatch: {
    width: 32,
    height: 32,
    borderRadius: 10,
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardLabel: {
    fontSize: typography.body,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  cardHint: {
    fontSize: 11,
    lineHeight: 16,
  },
  customBox: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  customLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  customHint: {
    fontSize: typography.caption,
    lineHeight: 18,
  },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  preview: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
  },
  hexInput: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: radius.input,
    paddingHorizontal: spacing.md,
    fontSize: typography.body,
    fontVariant: ['tabular-nums'],
  },
  applyButton: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.input,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyLabel: {
    fontSize: typography.label,
    fontWeight: '700',
  },
  error: {
    fontSize: typography.caption,
    fontWeight: '600',
  },
  compactRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
  },
  dotSelected: {
    transform: [{ scale: 1.08 }],
  },
});
