import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { metaApi } from '@/src/api';
import { isInvalidSessionError } from '@/src/api/client';
import { useToast } from '@/src/shared/feedback/ToastProvider';
import { AvatarPicker } from '@/src/shared/forms/AvatarPicker';
import { FormField } from '@/src/shared/forms/FormField';
import { useSubmissionLock } from '@/src/shared/hooks/useSubmissionLock';
import { Screen } from '@/src/shared/layout/Screen';
import { StickyActionBar } from '@/src/shared/ui/StickyActionBar';
import { SurfaceCard } from '@/src/shared/ui/SurfaceCard';
import {
  firstFieldError,
  hasFieldError,
  optionalEmail,
  optionalPanVat,
  optionalPhone,
  panVatHint,
  requiredText,
  type FieldErrors,
} from '@/src/shared/lib/validation';
import { useAuthStore } from '@/src/stores/auth-store';
import { spacing, typography } from '@/src/theme';
import type { AppPalette } from '@/src/theme/app-palette';
import { useThemedStyles } from '@/src/theme/use-themed-styles';

type Field = 'companyName' | 'panVat' | 'phone' | 'email' | 'address';

/**
 * Who the shop is: the name, PAN/VAT, contact details and logo that go on every
 * bill and identify the workspace. Saving writes business settings, and the
 * server mirrors the name and contact details onto the business record so the
 * workspace switcher and the web app do not show an older name.
 */
export function BusinessProfileScreen() {
  const styles = useThemedStyles(createStyles);
  const toast = useToast();
  const queryClient = useQueryClient();
  const businessSettings = useAuthStore((state) => state.businessSettings);
  const businessProfile = useAuthStore((state) => state.businessProfile);
  const updateSettings = useAuthStore((state) => state.updateSettings);
  const refreshWorkspaces = useAuthStore((state) => state.refreshWorkspaces);
  const submission = useSubmissionLock();

  const [form, setForm] = useState(() => ({
    companyName: String(businessSettings?.companyName ?? businessProfile?.businessName ?? ''),
    panVat: String(businessSettings?.panVat ?? ''),
    phone: String(businessSettings?.phone ?? ''),
    email: String(businessSettings?.email ?? ''),
    address: String(businessSettings?.address ?? ''),
  }));
  const [logoUrl, setLogoUrl] = useState<string | null>(
    businessSettings?.logoUrl ? String(businessSettings.logoUrl) : null,
  );
  const [errors, setErrors] = useState<FieldErrors<Field>>({});
  const [saving, setSaving] = useState(false);

  function update(key: Field, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
    // Clearing as they type keeps a stale message from contradicting the field.
    setErrors((current) => (current[key] ? { ...current, [key]: '' } : current));
  }

  function validate(): FieldErrors<Field> {
    return {
      companyName: requiredText(form.companyName, 'Enter the business name.'),
      panVat: optionalPanVat(form.panVat),
      phone: optionalPhone(form.phone),
      email: optionalEmail(form.email),
    };
  }

  async function save(nextLogoUrl: string | null = logoUrl) {
    const nextErrors = validate();
    setErrors(nextErrors);
    if (hasFieldError(nextErrors)) {
      toast.error(firstFieldError(nextErrors));
      return false;
    }

    if (!submission.tryStart()) return false;
    setSaving(true);
    try {
      const nextSettings = {
        ...(businessSettings ?? {}),
        companyName: form.companyName.trim(),
        panVat: form.panVat.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        address: form.address.trim(),
        logoUrl: nextLogoUrl,
      };
      const saved = await metaApi.updateBusinessSettings(nextSettings);
      await updateSettings({ ...nextSettings, ...(saved ?? {}) });
      // The bill header, the workspace name and the invoice preview all read
      // this, so refresh them rather than waiting for the next sign-in.
      await queryClient.invalidateQueries({ queryKey: ['business-settings'] });
      await queryClient.invalidateQueries({ queryKey: ['business-profile'] });
      await refreshWorkspaces().catch(() => null);
      toast.success('Business details saved');
      return true;
    } catch (error) {
      if (isInvalidSessionError(error)) return false;
      toast.error(error instanceof Error ? error.message : 'Could not save the business details.');
      return false;
    } finally {
      setSaving(false);
      submission.finish();
    }
  }

  /** The logo is saved on its own so the picture does not wait for the form. */
  async function handleLogoChange(nextUrl: string | null) {
    setLogoUrl(nextUrl);
    const nextSettings = { ...(businessSettings ?? {}), logoUrl: nextUrl };
    try {
      await metaApi.updateBusinessSettings(nextSettings);
      await updateSettings(nextSettings);
      await queryClient.invalidateQueries({ queryKey: ['business-settings'] });
      toast.success(nextUrl ? 'Logo updated' : 'Logo removed');
    } catch (error) {
      setLogoUrl(businessSettings?.logoUrl ? String(businessSettings.logoUrl) : null);
      toast.error(error instanceof Error ? error.message : 'Could not save the logo.');
    }
  }

  const panHint = errors.panVat ? undefined : panVatHint(form.panVat) || undefined;

  return (
    <Screen
      topBarTitle="Business information"
      footer={
        <StickyActionBar
          primary={{
            label: saving ? 'Saving…' : 'Save business details',
            tone: 'primary',
            loading: saving,
            disabled: saving,
            onPress: () => void save(),
          }}
        />
      }>
      <SurfaceCard
        title="Logo"
        subtitle="Printed at the top of every bill and receipt.">
        <View style={styles.logoRow}>
          <AvatarPicker
            value={logoUrl}
            name={form.companyName}
            size={88}
            shape="rounded"
            label={logoUrl ? 'Change logo' : 'Add logo'}
            onChange={handleLogoChange}
          />
          <Text style={styles.logoHint}>
            A square picture works best. It prints small, so a clear mark reads better than a
            detailed photo.
          </Text>
        </View>
      </SurfaceCard>

      <SurfaceCard title="Details" subtitle="How the business is named and reached.">
        <FormField
          label="Business name"
          icon="domain"
          value={form.companyName}
          onChangeText={(value) => update('companyName', value)}
          placeholder="Name as it should appear on the bill"
          autoCapitalize="words"
          error={errors.companyName}
        />
        <FormField
          label="PAN / VAT number"
          icon="card-account-details-outline"
          value={form.panVat}
          onChangeText={(value) => update('panVat', value)}
          placeholder="Leave empty if you do not have one"
          keyboardType="number-pad"
          error={errors.panVat}
          helperText={panHint}
        />
        <FormField
          label="Phone"
          icon="phone-outline"
          value={form.phone}
          onChangeText={(value) => update('phone', value)}
          placeholder="98XXXXXXXX"
          keyboardType="phone-pad"
          error={errors.phone}
        />
        <FormField
          label="Email"
          icon="email-outline"
          value={form.email}
          onChangeText={(value) => update('email', value)}
          placeholder="shop@email.com"
          keyboardType="email-address"
          autoCapitalize="none"
          error={errors.email}
        />
        <FormField
          label="Address"
          icon="map-marker-outline"
          value={form.address}
          onChangeText={(value) => update('address', value)}
          placeholder="Street, city"
          multiline
          error={errors.address}
        />
      </SurfaceCard>
    </Screen>
  );
}

const createStyles = (colors: AppPalette) =>
  StyleSheet.create({
    logoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    logoHint: {
      flex: 1,
      color: colors.textMuted,
      fontSize: typography.caption,
      lineHeight: 18,
    },
  });
