import { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';

import { metaApi } from '@/src/api';
import { FormField } from '@/src/components/forms/FormField';
import { Screen } from '@/src/components/layout/Screen';
import { PageHeading } from '@/src/components/ui/PageHeading';
import { SurfaceCard } from '@/src/components/ui/SurfaceCard';
import { getCapabilitySummary, hasAppCapability } from '@/src/lib/business';
import { palette, radius, spacing, typography } from '@/src/theme';
import { useAuthStore } from '@/src/stores/auth-store';

export default function SettingsScreen() {
  const signOut = useAuthStore((state) => state.signOut);
  const user = useAuthStore((state) => state.user);
  const session = useAuthStore((state) => state.session);
  const accessControl = useAuthStore((state) => state.accessControl);
  const businessProfile = useAuthStore((state) => state.businessProfile);
  const businessSettings = useAuthStore((state) => state.businessSettings);
  const updateSettings = useAuthStore((state) => state.updateSettings);
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const [profileForm, setProfileForm] = useState({
    name: user?.name ?? '',
    phone: user?.phone ?? '',
  });
  const [message, setMessage] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  const accessContext = {
    role: session?.role ?? user?.role ?? null,
    permissions: accessControl?.permissions ?? user?.permissions,
    accessControl,
    enabledModules: businessProfile?.enabledModules,
  };

  const permissionBadges = getCapabilitySummary(accessContext);
  const canOpenOwnerTools = hasAppCapability(accessContext, 'owner-tools');

  const toggles = [
    {
      key: 'counterMode',
      label: 'Counter mode',
      helper: 'Keep sale flow optimized for walk-in billing',
      value: Boolean(businessSettings?.counterMode ?? true),
    },
    {
      key: 'taxEnabled',
      label: 'Tax enabled',
      helper: 'Apply VAT-ready totals during quick billing',
      value: Boolean(businessSettings?.taxEnabled ?? true),
    },
    {
      key: 'lowStockAlert',
      label: 'Low stock alerts',
      helper: 'Show product alerts inside quick mobile workflows',
      value: Boolean(businessSettings?.lowStockAlert ?? true),
    },
  ] as const;

  async function handleToggle(key: keyof NonNullable<typeof businessSettings>, value: boolean) {
    const nextSettings = { ...(businessSettings ?? {}), [key]: value };
    await updateSettings(nextSettings);
    try {
      await metaApi.updateBusinessSettings(nextSettings);
    } catch {
      // Keep local preference until the next successful sync.
    }
  }

  async function handleProfileSave() {
    setMessage('');
    await updateProfile(profileForm);
    setMessage('Profile updated.');
  }

  async function handleSignOut() {
    try {
      setSigningOut(true);
      await signOut();
      router.replace('/(auth)/login');
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <Screen>
      <PageHeading
        title="Settings"
        subtitle="Keep mobile focused on quick stats, quick entry, and secure account access."
      />

      {message ? (
        <SurfaceCard>
          <Text style={styles.message}>{message}</Text>
        </SurfaceCard>
      ) : null}

      <SurfaceCard
        title="Business profile"
        subtitle={`${businessProfile?.businessType ?? 'Retail'} mobile mode`}>
        <Text style={styles.profileName}>{businessProfile?.businessName ?? 'Business name'}</Text>
        <Text style={styles.profileHint}>
          Use the web app for longer edits. Mobile keeps the essentials at the counter.
        </Text>
      </SurfaceCard>

      <SurfaceCard
        title="My profile"
        subtitle={user?.email || 'Update the signed-in account details returned by the backend.'}>
        <FormField
          label="Name"
          value={profileForm.name}
          onChangeText={(name) => setProfileForm((current) => ({ ...current, name }))}
        />
        <FormField
          label="Phone"
          value={profileForm.phone}
          onChangeText={(phone) => setProfileForm((current) => ({ ...current, phone }))}
          keyboardType="numeric"
        />
        <Pressable style={styles.primaryButton} onPress={() => void handleProfileSave()}>
          <Text style={styles.primaryButtonLabel}>Save profile</Text>
        </Pressable>
      </SurfaceCard>

      <SurfaceCard
        title="Permissions"
        subtitle="Mobile access returned for this account on the current business session.">
        <View style={styles.permissionWrap}>
          {permissionBadges.map((permission) => (
            <View key={permission} style={styles.permissionChip}>
              <Text style={styles.permissionChipLabel}>{permission}</Text>
            </View>
          ))}
        </View>
      </SurfaceCard>

      <SurfaceCard title="Mobile defaults" subtitle="These switches shape the faster phone-first experience.">
        <View style={styles.toggleList}>
          {toggles.map((toggle) => (
            <View key={toggle.key} style={styles.toggleRow}>
              <View style={styles.toggleCopy}>
                <Text style={styles.toggleLabel}>{toggle.label}</Text>
                <Text style={styles.toggleHelper}>{toggle.helper}</Text>
              </View>
              <Switch
                value={toggle.value}
                onValueChange={(value) => void handleToggle(toggle.key, value)}
                trackColor={{ false: palette.border, true: palette.primary }}
                thumbColor={palette.white}
              />
            </View>
          ))}
        </View>
      </SurfaceCard>

      <SurfaceCard title="Security" subtitle="Password and session controls for this device.">
        <Pressable style={styles.secondaryButton} onPress={() => router.push('/(app)/change-password')}>
          <Text style={styles.secondaryButtonLabel}>Change password</Text>
        </Pressable>
        <Text style={styles.helperText}>
          Signing out clears local drafts, cached quick-entry data, and any pending mobile-only session state.
        </Text>
        <Pressable style={styles.signOutButton} onPress={() => void handleSignOut()} disabled={signingOut}>
          <Text style={styles.signOutLabel}>{signingOut ? 'Signing out...' : 'Log out from this device'}</Text>
        </Pressable>
      </SurfaceCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  message: {
    color: palette.success,
    fontSize: typography.body,
    fontWeight: '700',
  },
  profileName: {
    fontSize: typography.heading,
    fontWeight: '800',
    color: palette.text,
  },
  profileHint: {
    fontSize: typography.body,
    lineHeight: 22,
    color: palette.textMuted,
  },
  permissionWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  permissionChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: palette.successSoft,
  },
  permissionChipLabel: {
    color: palette.success,
    fontSize: typography.caption,
    fontWeight: '800',
  },
  toggleList: {
    gap: spacing.md,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  toggleCopy: {
    flex: 1,
    gap: spacing.xxs,
  },
  toggleLabel: {
    fontSize: typography.body,
    fontWeight: '700',
    color: palette.text,
  },
  toggleHelper: {
    fontSize: typography.label,
    lineHeight: 18,
    color: palette.textMuted,
  },
  helperText: {
    fontSize: typography.label,
    lineHeight: 20,
    color: palette.textMuted,
  },
  primaryButton: {
    minHeight: 50,
    borderRadius: radius.md,
    backgroundColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonLabel: {
    color: palette.white,
    fontSize: typography.body,
    fontWeight: '800',
  },
  secondaryButton: {
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: palette.backgroundAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonLabel: {
    color: palette.text,
    fontSize: typography.body,
    fontWeight: '700',
  },
  signOutButton: {
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: palette.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutLabel: {
    color: palette.danger,
    fontSize: typography.body,
    fontWeight: '800',
  },
});
