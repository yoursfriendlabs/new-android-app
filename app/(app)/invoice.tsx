import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/src/shared/layout/Screen';
import { PageHeading } from '@/src/shared/ui/PageHeading';
import { SurfaceCard } from '@/src/shared/ui/SurfaceCard';
import { radius, typography } from '@/src/theme';
import { useReceiptStore } from '@/src/stores/receipt-store';
import { usePalette } from '@/src/stores/theme-store';
import { useThemedStyles } from '@/src/theme/use-themed-styles';
import type { AppPalette } from '@/src/theme/app-palette';

export default function InvoiceScreen() {
  const colors = usePalette();
  const styles = useThemedStyles(createStyles);
  const title = useReceiptStore((state) => state.title);
  const subtitle = useReceiptStore((state) => state.subtitle);
  const html = useReceiptStore((state) => state.html);

  return (
    <Screen>
      <PageHeading subtitle="This is the quick mobile review screen. Use print preview for the formatted output." />
      <SurfaceCard title={title || 'No invoice yet'} subtitle={subtitle || 'Save a sale, purchase, or service to view its summary here.'}>
        <Text style={styles.description}>
          {html
            ? 'The printable receipt has been prepared and is ready for preview or print.'
            : 'There is no prepared invoice in memory yet.'}
        </Text>
      </SurfaceCard>
      <View style={styles.actions}>
        <Pressable style={styles.secondaryButton} onPress={() => router.back()}>
          <Text style={styles.secondaryLabel}>Back</Text>
        </Pressable>
        <Pressable style={styles.primaryButton} onPress={() => router.push('/(app)/print-preview')}>
          <Text style={styles.primaryLabel}>Open print preview</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const createStyles = (colors: AppPalette) => StyleSheet.create({
  description: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 22,
  },
  actions: {
    gap: 12,
  },
  secondaryButton: {
    minHeight: 50,
    borderRadius: radius.md,
    backgroundColor: colors.backgroundAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    minHeight: 50,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLabel: {
    color: colors.white,
    fontSize: typography.body,
    fontWeight: '800',
  },
  secondaryLabel: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '700',
  },
});
