import { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';

import { metaApi } from '@/src/api';
import { AvatarPicker } from '@/src/shared/forms/AvatarPicker';
import { FormField } from '@/src/shared/forms/FormField';
import { Screen } from '@/src/shared/layout/Screen';
import { PageHeading } from '@/src/shared/ui/PageHeading';
import { SurfaceCard } from '@/src/shared/ui/SurfaceCard';
import { ThemeSelector } from '@/src/shared/ui/ThemeSelector';
import { LanguageSelector } from '@/src/shared/ui/LanguageSelector';
import { DateFormatSelector } from '@/src/shared/ui/DateFormatSelector';
import { getCapabilitySummary, hasAppCapability, isPersonalWorkspace } from '@/src/shared/lib/business';
import { Snackbar } from '@/src/shared/feedback/Snackbar';
import { useAuthStore } from '@/src/stores/auth-store';
import { usePalette } from '@/src/stores/theme-store';
import { useTranslation } from '@/src/i18n';
import { radius, spacing, typography } from '@/src/theme';
import { useThemedStyles } from '@/src/theme/use-themed-styles';
import type { AppPalette } from '@/src/theme/app-palette';

export default function SettingsScreen() {
  const colors = usePalette();
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();
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
  const [snackbar, setSnackbar] = useState<{ visible: boolean; message: string; tone: 'success' | 'danger' }>({
    visible: false,
    message: '',
    tone: 'success',
  });
  const [message, setMessage] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  const [geofencingForm, setGeofencingForm] = useState(() => ({
    officeLatitude: businessSettings?.officeLatitude !== null && businessSettings?.officeLatitude !== undefined ? String(businessSettings.officeLatitude) : '',
    officeLongitude: businessSettings?.officeLongitude !== null && businessSettings?.officeLongitude !== undefined ? String(businessSettings.officeLongitude) : '',
    officeRadiusMeters: businessSettings?.officeRadiusMeters !== null && businessSettings?.officeRadiusMeters !== undefined ? String(businessSettings.officeRadiusMeters) : '100',
  }));
  const [geofenceMessage, setGeofenceMessage] = useState('');

  async function handleGeofencingSave() {
    setGeofenceMessage('');
    try {
      const nextSettings = {
        ...(businessSettings ?? {}),
        officeLatitude: geofencingForm.officeLatitude.trim() ? Number(geofencingForm.officeLatitude) : null,
        officeLongitude: geofencingForm.officeLongitude.trim() ? Number(geofencingForm.officeLongitude) : null,
        officeRadiusMeters: geofencingForm.officeRadiusMeters.trim() ? Number(geofencingForm.officeRadiusMeters) : null,
      };
      await updateSettings(nextSettings);
      await metaApi.updateBusinessSettings(nextSettings);
      setGeofenceMessage(t('common.success'));
      setSnackbar({ visible: true, message: 'Settings saved', tone: 'success' });
    } catch (error) {
      setGeofenceMessage(error instanceof Error ? error.message : t('common.error'));
      setSnackbar({ visible: true, message: error instanceof Error ? error.message : t('common.error'), tone: 'danger' });
    }
  }

  const accessContext = {
    role: session?.role ?? user?.role ?? null,
    permissions: accessControl?.permissions ?? user?.permissions,
    accessControl,
    enabledModules: businessProfile?.enabledModules,
    businessType: businessProfile?.businessType ?? businessProfile?.type ?? null,
  };

  const permissionBadges = getCapabilitySummary(accessContext as any);
  const canOpenOwnerTools = hasAppCapability(accessContext as any, 'owner-tools');
  const isPersonal = isPersonalWorkspace(accessContext as any);

  const toggles = [
    {
      key: 'counterMode',
      label: t('settings.counterMode'),
      helper: t('settings.counterModeHelper'),
      value: Boolean(businessSettings?.counterMode ?? true),
    },
    {
      key: 'taxEnabled',
      label: t('settings.taxEnabled'),
      helper: t('settings.taxEnabledHelper'),
      value: Boolean(businessSettings?.taxEnabled ?? true),
    },
    {
      key: 'lowStockAlert',
      label: t('settings.lowStockAlert'),
      helper: t('settings.lowStockAlertHelper'),
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
    try {
      setMessage('');
      await updateProfile(profileForm);
      setSnackbar({ visible: true, message: 'Profile updated successfully', tone: 'success' });
    } catch (error) {
      setSnackbar({ visible: true, message: error instanceof Error ? error.message : t('common.error'), tone: 'danger' });
    }
  }

  async function handleAvatarChange(newUrl: string | null) {
    try {
      setMessage('');
      await updateProfile({ avatarUrl: newUrl });
      setSnackbar({ visible: true, message: 'Profile photo updated', tone: 'success' });
    } catch (error) {
      setSnackbar({ visible: true, message: error instanceof Error ? error.message : t('common.error'), tone: 'danger' });
    }
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
        title={t('settings.title')}
        subtitle={
          isPersonal
            ? 'Theme, language, profile, and tools on this personal account.'
            : 'Language, theme, quick mobile settings, and account access.'
        }
      />

      {message ? (
        <SurfaceCard>
          <Text style={styles.message}>{message}</Text>
        </SurfaceCard>
      ) : null}

      <SurfaceCard
        title={t('settings.language')}
        subtitle={t('settings.languageSubtitle')}>
        <LanguageSelector />
      </SurfaceCard>

      <SurfaceCard
        title={t('settings.dateFormat')}
        subtitle={t('settings.dateFormatSubtitle')}>
        <DateFormatSelector />
      </SurfaceCard>

      <SurfaceCard
        title={t('settings.appearance')}
        subtitle={t('settings.themeSubtitle')}>
        <ThemeSelector />
      </SurfaceCard>

      <SurfaceCard
        title={isPersonal ? 'This space' : t('settings.businessProfile')}
        subtitle={isPersonal ? 'Personal finance' : `${businessProfile?.businessType ?? 'Retail'} mobile mode`}>
        <Text style={styles.profileName}>
          {businessProfile?.businessName ?? (isPersonal ? 'Personal books' : 'Business name')}
        </Text>
        <Text style={styles.profileHint}>
          {isPersonal
            ? 'This account tracks income, expenses, and party balances. Shop tools stay on a business workspace.'
            : 'Use the web app for longer edits. Mobile keeps the essentials at the counter.'}
        </Text>
      </SurfaceCard>

      <SurfaceCard
        title={t('settings.profile')}
        subtitle={user?.email || t('settings.profileSubtitle')}>
        <AvatarPicker
          value={user?.avatarUrl}
          name={user?.name}
          size={80}
          label={user?.avatarUrl ? 'Change photo' : 'Add photo'}
          onChange={handleAvatarChange}
        />
        <FormField
          label={t('common.name')}
          value={profileForm.name}
          onChangeText={(name) => setProfileForm((current) => ({ ...current, name }))}
        />
        <FormField
          label={t('common.phone')}
          value={profileForm.phone}
          onChangeText={(phone) => setProfileForm((current) => ({ ...current, phone }))}
          keyboardType="numeric"
        />
        <Pressable style={[styles.primaryButton, { backgroundColor: colors.primary }]} onPress={() => void handleProfileSave()}>
          <Text style={styles.primaryButtonLabel}>{t('settings.saveProfile')}</Text>
        </Pressable>
      </SurfaceCard>

      {canOpenOwnerTools ? (
        <SurfaceCard
          title={t('settings.geofencingTitle')}
          subtitle={t('settings.geofencingSubtitle')}>
          <FormField
            label={t('settings.officeLatitude')}
            value={geofencingForm.officeLatitude}
            onChangeText={(lat) => setGeofencingForm((current) => ({ ...current, officeLatitude: lat }))}
            keyboardType="numeric"
            placeholder="e.g. 27.7172"
          />
          <FormField
            label={t('settings.officeLongitude')}
            value={geofencingForm.officeLongitude}
            onChangeText={(lon) => setGeofencingForm((current) => ({ ...current, officeLongitude: lon }))}
            keyboardType="numeric"
            placeholder="e.g. 85.3240"
          />
          <FormField
            label={t('settings.officeRadius')}
            value={geofencingForm.officeRadiusMeters}
            onChangeText={(rad) => setGeofencingForm((current) => ({ ...current, officeRadiusMeters: rad }))}
            keyboardType="numeric"
            placeholder="e.g. 100"
          />
          {geofenceMessage ? (
            <Text style={[styles.message, geofenceMessage.includes('failed') && { color: colors.danger }, { marginBottom: spacing.sm }]}>
              {geofenceMessage}
            </Text>
          ) : null}
          <Pressable style={[styles.primaryButton, { backgroundColor: colors.primary }]} onPress={() => void handleGeofencingSave()}>
            <Text style={styles.primaryButtonLabel}>{t('settings.saveGeofencing')}</Text>
          </Pressable>
        </SurfaceCard>
      ) : null}

      {hasAppCapability(accessContext as any, 'tables') ? (
        <SurfaceCard
          title={t('cafe.tables')}
          subtitle="Define and organize tables, guest capacities, and active status for cafe workflows.">
          <Pressable style={styles.secondaryButton} onPress={() => router.push('/tables' as any)}>
            <Text style={styles.secondaryButtonLabel}>{t('cafe.manageTables')}</Text>
          </Pressable>
        </SurfaceCard>
      ) : null}

      <SurfaceCard
        title={t('settings.permissions')}
        subtitle={t('settings.permissionsSubtitle')}>
        <View style={styles.permissionWrap}>
          {permissionBadges.map((permission) => (
            <View key={permission} style={styles.permissionChip}>
              <Text style={styles.permissionChipLabel}>{permission}</Text>
            </View>
          ))}
        </View>
      </SurfaceCard>

      {!isPersonal ? (
      <SurfaceCard title={t('settings.mobileDefaults')} subtitle={t('settings.mobileDefaultsSubtitle')}>
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
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.white}
              />
            </View>
          ))}
        </View>
      </SurfaceCard>
      ) : null}

      <SurfaceCard title={t('settings.security')} subtitle={t('settings.securitySubtitle')}>
        <Pressable style={styles.secondaryButton} onPress={() => router.push('/(app)/change-password')}>
          <Text style={styles.secondaryButtonLabel}>{t('settings.changePassword')}</Text>
        </Pressable>
        <Text style={styles.helperText}>
          {t('settings.signOutNotice')}
        </Text>
        <Pressable style={styles.signOutButton} onPress={() => void handleSignOut()} disabled={signingOut}>
          <Text style={styles.signOutLabel}>{signingOut ? t('auth.signingOut') : t('settings.signOutDevice')}</Text>
        </Pressable>
      </SurfaceCard>

      <Snackbar
        visible={snackbar.visible}
        message={snackbar.message}
        tone={snackbar.tone}
        onDismiss={() => setSnackbar((s) => ({ ...s, visible: false }))}
      />
    </Screen>
  );
}

const createStyles = (colors: AppPalette) => StyleSheet.create({
  message: {
    color: colors.success,
    fontSize: typography.body,
    fontWeight: '700',
  },
  profileName: {
    fontSize: typography.heading,
    fontWeight: '800',
    color: colors.text,
  },
  profileHint: {
    fontSize: typography.body,
    lineHeight: 22,
    color: colors.textMuted,
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
    backgroundColor: colors.successSoft,
  },
  permissionChipLabel: {
    color: colors.success,
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
    color: colors.text,
  },
  toggleHelper: {
    fontSize: typography.label,
    lineHeight: 18,
    color: colors.textMuted,
  },
  helperText: {
    fontSize: typography.label,
    lineHeight: 20,
    color: colors.textMuted,
  },
  primaryButton: {
    minHeight: 50,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonLabel: {
    color: colors.white,
    fontSize: typography.body,
    fontWeight: '800',
  },
  secondaryButton: {
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: colors.backgroundAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonLabel: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '700',
  },
  signOutButton: {
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: colors.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutLabel: {
    color: colors.danger,
    fontSize: typography.body,
    fontWeight: '800',
  },
});
