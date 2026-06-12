import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { palette, spacing, typography } from '@/src/theme';

export default function NotFoundScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>This screen went missing.</Text>
      <Text style={styles.subtitle}>The route is not available right now.</Text>
      <Link href="/" style={styles.link}>
        Back to app
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: palette.background,
    gap: spacing.sm,
  },
  title: {
    fontSize: typography.heading,
    fontWeight: '800',
    color: palette.text,
  },
  subtitle: {
    fontSize: typography.body,
    color: palette.textMuted,
  },
  link: {
    color: palette.primary,
    fontWeight: '700',
  },
});
