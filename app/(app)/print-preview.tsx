import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { Screen } from '@/src/shared/layout/Screen';
import { PageHeading } from '@/src/shared/ui/PageHeading';
import { SurfaceCard } from '@/src/shared/ui/SurfaceCard';
import { radius, spacing, typography } from '@/src/theme';
import { useReceiptStore } from '@/src/stores/receipt-store';
import { usePalette } from '@/src/stores/theme-store';
import { useThemedStyles } from '@/src/theme/use-themed-styles';
import type { AppPalette } from '@/src/theme/app-palette';

export default function PrintPreviewScreen() {
  const colors = usePalette();
  const styles = useThemedStyles(createStyles);
  const title = useReceiptStore((state) => state.title);
  const subtitle = useReceiptStore((state) => state.subtitle);
  const html = useReceiptStore((state) => state.html);
  const [busy, setBusy] = useState(false);

  async function printNow() {
    if (!html) return;

    setBusy(true);
    try {
      await Print.printAsync({ html });
    } finally {
      setBusy(false);
    }
  }

  async function sharePdf() {
    if (!html) return;

    setBusy(true);
    try {
      const result = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(result.uri);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <PageHeading subtitle="Receipt output stays one tap away after saving." />
      <SurfaceCard title={title || 'No prepared receipt'} subtitle={subtitle || 'Save a transaction to build the preview.'}>
        <Text style={styles.description}>
          {html
            ? 'The printable document is ready. Print directly or export a PDF for sharing.'
            : 'There is nothing queued for print yet.'}
        </Text>
      </SurfaceCard>
      <Pressable style={styles.primaryButton} onPress={printNow} disabled={busy || !html}>
        {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryLabel}>Print now</Text>}
      </Pressable>
      <Pressable style={styles.secondaryButton} onPress={sharePdf} disabled={busy || !html}>
        <Text style={styles.secondaryLabel}>Export PDF</Text>
      </Pressable>
    </Screen>
  );
}

const createStyles = (colors: AppPalette) => StyleSheet.create({
  description: {
    fontSize: typography.body,
    lineHeight: 22,
    color: colors.textMuted,
  },
  primaryButton: {
    minHeight: 50,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButton: {
    minHeight: 50,
    borderRadius: radius.md,
    backgroundColor: colors.backgroundAlt,
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
