import { Link, router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { FormField } from '@/src/components/forms/FormField';
import { Screen } from '@/src/components/layout/Screen';
import { SurfaceCard } from '@/src/components/ui/SurfaceCard';
import { palette, radius, spacing, typography } from '@/src/theme';
import { useAuthStore } from '@/src/stores/auth-store';

export default function LoginScreen() {
  const login = useAuthStore((state) => state.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleLogin() {
    try {
      setSubmitting(true);
      setError('');
      const result = await login({ email, password });
      router.replace(result === 'verify-email' ? '/(auth)/verify-email' : '/(app)/(tabs)/home');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to sign in.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen scrollable={true}>
      <View style={styles.hero}>
        <Text style={styles.brand}>PasalManager</Text>
        <Text style={styles.title}>Daily billing and shop control from your phone</Text>
        <Text style={styles.subtitle}>
          Sign in and jump straight into sales, quick entry, party balances, and today&apos;s insights.
        </Text>
      </View>

      <SurfaceCard title="Sign in" subtitle="Your business session stays secure on device.">
        <FormField
          label="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <FormField
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable style={styles.primaryButton} onPress={handleLogin} disabled={submitting}>
          {submitting ? <ActivityIndicator color={palette.white} /> : <Text style={styles.primaryLabel}>Continue to app</Text>}
        </Pressable>
      </SurfaceCard>

      <View style={styles.links}>
        <Link href="/(auth)/register" style={styles.link}>
          Create a new account
        </Link>
        <Link href="/(auth)/verify-email" style={styles.link}>
          Verify email
        </Link>
        <Link href="/(auth)/reset-password" style={styles.link}>
          Reset password
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    paddingTop: spacing.xl,
    gap: spacing.sm,
  },
  brand: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: palette.backgroundAlt,
    color: palette.primary,
    fontWeight: '800',
  },
  title: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '800',
    color: palette.text,
  },
  subtitle: {
    fontSize: typography.body,
    lineHeight: 22,
    color: palette.textMuted,
  },
  primaryButton: {
    minHeight: 52,
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
  error: {
    color: palette.danger,
    fontWeight: '600',
  },
  links: {
    gap: spacing.sm,
  },
  link: {
    color: palette.primary,
    fontSize: typography.body,
    fontWeight: '700',
  },
});
