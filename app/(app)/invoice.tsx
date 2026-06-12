import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/src/components/layout/Screen';
import { PageHeading } from '@/src/components/ui/PageHeading';
import { SurfaceCard } from '@/src/components/ui/SurfaceCard';
import { palette, radius, typography } from '@/src/theme';
import { useReceiptStore } from '@/src/stores/receipt-store';

export default function InvoiceScreen() {
  const title = useReceiptStore((state) => state.title);
  const subtitle = useReceiptStore((state) => state.subtitle);
  const html = useReceiptStore((state) => state.html);

  return (
    <Screen>
      <PageHeading title="Invoice summary" subtitle="This is the quick mobile review screen. Use print preview for the formatted output." />
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

const styles = StyleSheet.create({
  description: {
    color: palette.textMuted,
    fontSize: typography.body,
    lineHeight: 22,
  },
  actions: {
    gap: 12,
  },
  secondaryButton: {
    minHeight: 50,
    borderRadius: radius.md,
    backgroundColor: palette.backgroundAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    minHeight: 50,
    borderRadius: radius.md,
    backgroundColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLabel: {
    color: palette.white,
    fontSize: typography.body,
    fontWeight: '800',
  },
  secondaryLabel: {
    color: palette.text,
    fontSize: typography.body,
    fontWeight: '700',
  },
});
