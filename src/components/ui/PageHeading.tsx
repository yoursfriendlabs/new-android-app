import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { palette, spacing, typography } from '@/src/theme';

interface PageHeadingProps {
  title: string;
  subtitle: string;
  right?: ReactNode;
}

export function PageHeading({ right, subtitle, title }: PageHeadingProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.textWrap}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
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
    color: palette.text,
  },
  subtitle: {
    fontSize: typography.body,
    lineHeight: 22,
    color: palette.textMuted,
  },
});
