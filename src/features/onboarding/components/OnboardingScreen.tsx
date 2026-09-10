import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useRef, useState, type ComponentProps } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useOnboardingStore } from '@/src/features/onboarding/lib/onboarding';
import { haptics } from '@/src/shared/lib/haptics';
import { LanguageSelector } from '@/src/shared/ui/LanguageSelector';
import { ThemeModeSelector } from '@/src/shared/ui/ThemeModeSelector';
import { CompactThemeRow } from '@/src/shared/ui/ThemeSelector';
import { Text } from '@/src/shared/ui/Text';
import { usePalette } from '@/src/stores/theme-store';
import { radius, spacing } from '@/src/theme';
import type { AppPalette } from '@/src/theme/app-palette';
import { useThemedStyles } from '@/src/theme/use-themed-styles';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

interface Slide {
  key: string;
  icon: IconName;
  title: string;
  body: string;
  /** Slide one lets them set the language before reading anything else. */
  showLanguage?: boolean;
  /** Slide two picks light/dark and the accent colour. */
  showTheme?: boolean;
}

const SLIDES: Slide[] = [
  {
    key: 'language',
    icon: 'translate',
    title: 'Your shop, your language',
    body: 'Pick English or Nepali. You can change it any time in Settings, along with Nepali dates.',
    showLanguage: true,
  },
  {
    key: 'theme',
    icon: 'palette-outline',
    title: 'Make it yours',
    body: 'Light or dark, and a colour to match your shop. Both can be changed later in Settings.',
    showTheme: true,
  },
  {
    key: 'what',
    icon: 'cash-register',
    title: 'Bill, stock and udharo in one place',
    body: 'Ring up a sale in seconds, keep stock honest, and see who owes you at a glance. It keeps working without signal and syncs when you are back online.',
  },
];

/** The first-run tour. Three slides, skippable, shown once per install. */
export function OnboardingScreen() {
  const colors = usePalette();
  const styles = useThemedStyles(createStyles);
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const complete = useOnboardingStore((state) => state.complete);

  const isLast = index === SLIDES.length - 1;

  async function finish() {
    haptics.success();
    await complete();
    router.replace('/(app)/(tabs)/home');
  }

  function goNext() {
    if (isLast) {
      void finish();
      return;
    }
    haptics.tapLight();
    const next = index + 1;
    setIndex(next);
    scrollRef.current?.scrollTo({ x: next * width, animated: true });
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Skip the tour"
          hitSlop={8}
          onPress={() => void finish()}>
          <Text variant="label" tone="muted">
            Skip
          </Text>
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(event) => {
          setIndex(Math.round(event.nativeEvent.contentOffset.x / width));
        }}>
        {SLIDES.map((slide) => (
          <View key={slide.key} style={[styles.slide, { width }]}>
            <LinearGradient
              colors={[colors.accentSoft, colors.surface]}
              // Slides carrying controls use smaller art so nothing overflows a short screen.
              style={[styles.art, (slide.showLanguage || slide.showTheme) && styles.artCompact]}
              start={{ x: 0.1, y: 0 }}
              end={{ x: 0.9, y: 1 }}>
              <MaterialCommunityIcons
                name={slide.icon}
                size={slide.showLanguage || slide.showTheme ? 52 : 72}
                color={colors.primary}
              />
            </LinearGradient>

            <View style={styles.copy}>
              <Text variant="title" align="center">
                {slide.title}
              </Text>
              <Text variant="body" tone="muted" align="center">
                {slide.body}
              </Text>
            </View>

            {slide.showLanguage ? (
              <View style={styles.optionBox}>
                <LanguageSelector />
              </View>
            ) : null}

            {slide.showTheme ? (
              <View style={styles.optionBox}>
                <ThemeModeSelector compact />
                <View style={styles.swatchRow}>
                  <CompactThemeRow />
                </View>
              </View>
            ) : null}
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {SLIDES.map((slide, slideIndex) => (
            <View
              key={slide.key}
              style={[
                styles.dot,
                slideIndex === index && [styles.dotActive, { backgroundColor: colors.primary }],
              ]}
            />
          ))}
        </View>

        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
          onPress={goNext}>
          <Text variant="bodyStrong" tone="onPrimary">
            {isLast ? 'Get started' : 'Next'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: AppPalette) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      alignItems: 'flex-end',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
    },
    slide: {
      paddingHorizontal: spacing.xl,
      gap: spacing.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    art: {
      width: 176,
      height: 176,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    artCompact: {
      width: 120,
      height: 120,
    },
    copy: {
      gap: spacing.sm,
    },
    optionBox: {
      alignSelf: 'stretch',
      gap: spacing.md,
    },
    swatchRow: {
      alignItems: 'center',
    },
    footer: {
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.lg,
      gap: spacing.lg,
    },
    dots: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: spacing.xs,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: radius.pill,
      backgroundColor: colors.border,
    },
    dotActive: {
      width: 22,
    },
    cta: {
      minHeight: 52,
      borderRadius: radius.input,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
    },
    pressed: {
      opacity: 0.85,
    },
  });
