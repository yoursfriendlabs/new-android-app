import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { usePalette } from '@/src/stores/theme-store';
import { spacing, typography } from '@/src/theme';

interface PageHeadingProps {
  title?: string;
  subtitle: string;
  right?: ReactNode;
}

export function PageHeading({ right, subtitle, title }: PageHeadingProps) {
  const colors = usePalette();
  return (
    <View style={styles.wrap}>
      <View style={styles.textWrap}>
        {title ? <Text style={[styles.title, { color: colors.text }]}>{title}</Text> : null}
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text>
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  textWrap: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    fontSize: typography.hero,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: typography.body,
    lineHeight: 22,
  },
});
