import { Link, router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { FormField } from '@/src/components/forms/FormField';
import { Screen } from '@/src/components/layout/Screen';
import { SegmentedTabs } from '@/src/components/ui/SegmentedTabs';
import { SurfaceCard } from '@/src/components/ui/SurfaceCard';
import { useBusinessTypes } from '@/src/hooks/useAppQueries';
import { palette, radius, spacing, typography } from '@/src/theme';
import { useAuthStore } from '@/src/stores/auth-store';

export default function RegisterScreen() {
  const register = useAuthStore((state) => state.register);
  const { data: businessTypes } = useBusinessTypes();
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    businessName: '',
    businessType: 'retail',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleRegister() {
    try {
      setSubmitting(true);
      setError('');
      const result = await register(form);
      router.replace(result === 'verify-email' ? '/(auth)/verify-email' : '/(app)/(tabs)/home');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to create account.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <SurfaceCard
        title="Create business account"
        subtitle="Start with the essentials. You can keep deeper setup on the web after launch.">
        <FormField label="Owner name" value={form.name} onChangeText={(name) => setForm((current) => ({ ...current, name }))} />
        <FormField
          label="Email"
          value={form.email}
          onChangeText={(email) => setForm((current) => ({ ...current, email }))}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <FormField label="Phone" value={form.phone} onChangeText={(phone) => setForm((current) => ({ ...current, phone }))} keyboardType="numeric" />
        <FormField
          label="Password"
          value={form.password}
          onChangeText={(password) => setForm((current) => ({ ...current, password }))}
          secureTextEntry
          autoCapitalize="none"
        />
        <FormField label="Business name" value={form.businessName} onChangeText={(businessName) => setForm((current) => ({ ...current, businessName }))} />
        <SegmentedTabs
          value={form.businessType}
          onChange={(businessType) => setForm((current) => ({ ...current, businessType }))}
          options={(businessTypes ?? [
            { value: 'retail', label: 'Retail' },
            { value: 'cafe', label: 'Cafe' },
            { value: 'jewellery', label: 'Jewellery' },
          ]).map((entry) => ({ value: entry.value, label: entry.label }))}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable style={styles.primaryButton} onPress={handleRegister} disabled={submitting}>
          {submitting ? <ActivityIndicator color={palette.white} /> : <Text style={styles.primaryLabel}>Create account</Text>}
        </Pressable>
      </SurfaceCard>
      <Link href="/(auth)/login" style={styles.link}>
        Back to sign in
      </Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
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
  link: {
    color: palette.primary,
    fontSize: typography.body,
    fontWeight: '700',
  },
});
