import { Link, router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import { FormField } from '@/src/components/forms/FormField';
import { Screen } from '@/src/components/layout/Screen';
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
        
        <Text style={styles.sectionLabel}>Select Business Type</Text>
        <View style={styles.gridContainer}>
          {(businessTypes ?? [
            { value: 'retail', label: 'Retail / Grocery', description: 'Counter POS and inventory tracking' },
            { value: 'cafe', label: 'Restaurant / Cafe', description: 'Seating layout plans and counter billing' },
            { value: 'gym', label: 'Gym / Fitness', description: 'Membership subscriptions and expiry tracking' },
            { value: 'jewellery', label: 'Jewellery Shop', description: 'Detailed custom orders and valuations' },
            { value: 'general', label: 'General / Service', description: 'Standard business ledger and staff payroll' },
          ]).map((type) => {
            const isSelected = form.businessType === type.value;
            const getIcon = (val: string) => {
              switch (val) {
                case 'retail': return 'storefront-outline';
                case 'service': return 'wrench';
                case 'general_store': return 'basket-outline';
                case 'hospitality': return 'silverware-fork-knife';
                case 'cafe': return 'coffee';
                case 'gym': return 'dumbbell';
                case 'jewellery': return 'diamond-stone';
                default: return 'briefcase-outline';
              }
            };

            return (
              <Pressable
                key={type.value}
                style={[styles.gridCard, isSelected && styles.gridCardActive]}
                onPress={() => setForm((curr) => ({ ...curr, businessType: type.value }))}
              >
                <MaterialCommunityIcons
                  name={getIcon(type.value) as any}
                  size={22}
                  color={isSelected ? palette.primary : palette.textSoft}
                />
                <View style={styles.gridCardContent}>
                  <Text style={[styles.gridCardTitle, isSelected && styles.gridCardTitleActive]}>
                    {type.label}
                  </Text>
                  <Text style={styles.gridCardDesc}>
                    {type.description}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>

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
  sectionLabel: {
    fontSize: typography.label,
    fontWeight: '800',
    color: palette.textSoft,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  gridContainer: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  gridCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: palette.border,
    backgroundColor: palette.backgroundWarm,
    gap: spacing.md,
  },
  gridCardActive: {
    borderColor: palette.primary,
    backgroundColor: palette.accentSoft,
  },
  gridCardContent: {
    flex: 1,
    gap: 2,
  },
  gridCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: palette.text,
  },
  gridCardTitleActive: {
    color: palette.primary,
  },
  gridCardDesc: {
    fontSize: 11,
    color: palette.textMuted,
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
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
    textAlign: 'center',
    marginTop: spacing.md,
  },
});
