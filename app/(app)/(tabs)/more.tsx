import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { isInvalidSessionError } from '@/src/api/client';
import { FormField } from '@/src/components/forms/FormField';
import { Screen } from '@/src/components/layout/Screen';
import { SurfaceCard } from '@/src/components/ui/SurfaceCard';
import { canAccessSegment } from '@/src/lib/business';
import { palette, radius, shadows, spacing, typography } from '@/src/theme';
import { useAuthStore } from '@/src/stores/auth-store';

type QuickLink = {
  segment: string;
  label: string;
  subtitle: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  color: string;
  bgColor: string;
  route: string;
};

const QUICK_LINKS: QuickLink[] = [
  {
    segment: 'quick-entry',
    label: 'Quick Entry',
    subtitle: 'Record expense or purchase fast',
    icon: 'lightning-bolt',
    color: palette.warning,
    bgColor: palette.warningSoft,
    route: '/(app)/(tabs)/quick-entry',
  },
  {
    segment: 'pos',
    label: 'Point of Sale',
    subtitle: 'Counter billing & quick sales',
    icon: 'cash-register',
    color: palette.success,
    bgColor: palette.successSoft,
    route: '/(app)/(tabs)/pos',
  },
  {
    segment: 'orders',
    label: 'Seating Map',
    subtitle: 'Manage tables & cafe orders',
    icon: 'table-chair',
    color: palette.accent,
    bgColor: palette.accentSoft,
    route: '/(app)/(tabs)/orders',
  },
  {
    segment: 'parties',
    label: 'Parties',
    subtitle: 'Customers & suppliers',
    icon: 'account-group',
    color: palette.info,
    bgColor: palette.infoSoft,
    route: '/(app)/(tabs)/parties',
  },
  {
    segment: 'purchases',
    label: 'Purchases',
    subtitle: 'Full purchase management',
    icon: 'cart',
    color: palette.purple,
    bgColor: palette.purpleSoft,
    route: '/(app)/purchases',
  },
  {
    segment: 'banks',
    label: 'Banks',
    subtitle: 'Bank accounts & payments',
    icon: 'bank',
    color: palette.blue,
    bgColor: palette.blueSoft,
    route: '/(app)/banks',
  },
  {
    segment: 'ledger',
    label: 'Ledger',
    subtitle: 'Balances & statements',
    icon: 'book-open-page-variant',
    color: palette.accent,
    bgColor: palette.accentSoft,
    route: '/(app)/ledger',
  },
  {
    segment: 'expenses',
    label: 'Expense Categories',
    subtitle: 'Manage quick categories',
    icon: 'shape-outline',
    color: palette.accent,
    bgColor: palette.accentSoft,
    route: '/(app)/expense-categories',
  },
  {
    segment: 'owner-tools',
    label: 'Staff Directory',
    subtitle: 'Manage team and payroll settings',
    icon: 'account-multiple-plus',
    color: palette.purple,
    bgColor: palette.purpleSoft,
    route: '/(app)/staff',
  },
  {
    segment: 'tables',
    label: 'Table Seating',
    subtitle: 'Manage tables & layout',
    icon: 'table-chair',
    color: palette.primary,
    bgColor: palette.accentSoft,
    route: '/(app)/tables',
  },
  {
    segment: 'cashier',
    label: 'Billing Counter',
    subtitle: 'Process dining cashier bills',
    icon: 'calculator',
    color: palette.success,
    bgColor: palette.successSoft,
    route: '/(app)/cashier',
  },
  {
    segment: 'home',
    label: 'Attendance check',
    subtitle: 'Daily check-in / check-out',
    icon: 'map-marker-radius',
    color: palette.success,
    bgColor: palette.successSoft,
    route: '/(app)/attendance',
  },
];

export default function MoreScreen() {
  const signOut = useAuthStore((state) => state.signOut);
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const user = useAuthStore((state) => state.user);
  const session = useAuthStore((state) => state.session);
  const accessControl = useAuthStore((state) => state.accessControl);
  const businessProfile = useAuthStore((state) => state.businessProfile);
  const accessContext = {
    role: session?.role ?? user?.role ?? null,
    permissions: accessControl?.permissions ?? user?.permissions,
    accessControl,
    enabledModules: businessProfile?.enabledModules,
    businessType: businessProfile?.businessType ?? businessProfile?.type ?? null,
  };

  const [profileForm, setProfileForm] = useState({
    name: user?.name ?? '',
    phone: user?.phone ?? '',
  });
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    setProfileForm({
      name: user?.name ?? '',
      phone: user?.phone ?? '',
    });
  }, [user?.name, user?.phone]);

  const visibleLinks = QUICK_LINKS.filter((link) =>
    canAccessSegment(accessContext as any, link.segment),
  );

  async function handleProfileSave() {
    try {
      setSaving(true);
      setMessage('');
      await updateProfile(profileForm);
      setMessage('Profile updated.');
    } catch (error) {
      if (isInvalidSessionError(error)) {
        return;
      }
      setMessage(error instanceof Error ? error.message : 'Unable to update profile.');
    } finally {
      setSaving(false);
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
    <Screen scrollable padded={false} showTopBar={false}>
      {/* Header card */}
      <View style={styles.headerSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarLabel}>
            {user?.name?.slice(0, 1).toUpperCase() || 'U'}
          </Text>
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.name}>{user?.name || 'User profile'}</Text>
          <Text style={styles.meta}>
            {user?.email || user?.phone || businessProfile?.businessName || 'PasalManager'}
          </Text>
          {businessProfile?.businessName ? (
            <Text style={styles.businessName}>{businessProfile.businessName}</Text>
          ) : null}
        </View>
      </View>

      {message ? (
        <View style={styles.messageWrap}>
          <Text
            style={[
              styles.message,
              message.toLowerCase().includes('updated')
                ? styles.successMessage
                : styles.errorMessage,
            ]}>
            {message}
          </Text>
        </View>
      ) : null}

      {/* Quick access links */}
      {visibleLinks.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Access</Text>
          <View style={styles.linksGrid}>
            {visibleLinks.map((link) => (
              <Pressable
                key={link.segment}
                style={styles.linkCard}
                onPress={() => router.push(link.route as any)}>
                <View style={[styles.linkIcon, { backgroundColor: link.bgColor }]}>
                  <MaterialCommunityIcons
                    color={link.color}
                    name={link.icon}
                    size={20}
                  />
                </View>
                <View style={styles.linkCopy}>
                  <Text style={styles.linkLabel}>{link.label}</Text>
                  <Text numberOfLines={1} style={styles.linkSubtitle}>
                    {link.subtitle}
                  </Text>
                </View>
                <MaterialCommunityIcons
                  color={palette.textSoft}
                  name="chevron-right"
                  size={20}
                />
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {/* Profile section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Profile</Text>
        <View style={styles.card}>
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
          <Pressable
            style={styles.primaryButton}
            onPress={() => void handleProfileSave()}
            disabled={saving}>
            {saving ? (
              <ActivityIndicator color={palette.white} />
            ) : (
              <Text style={styles.primaryButtonLabel}>Save profile</Text>
            )}
          </Pressable>
        </View>
      </View>

      {/* Security section */}
      <View style={[styles.section, styles.lastSection]}>
        <Text style={styles.sectionTitle}>Security</Text>
        <View style={styles.card}>
          <Pressable
            style={styles.secondaryButton}
            onPress={() => router.push('/(app)/change-password')}>
            <MaterialCommunityIcons color={palette.text} name="lock-reset" size={18} />
            <Text style={styles.secondaryButtonLabel}>Change password</Text>
          </Pressable>
          <Pressable
            style={styles.signOutButton}
            onPress={() => void handleSignOut()}
            disabled={signingOut}>
            {signingOut ? (
              <ActivityIndicator color={palette.danger} />
            ) : (
              <>
                <MaterialCommunityIcons color={palette.danger} name="logout" size={18} />
                <Text style={styles.signOutLabel}>Logout</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLabel: {
    color: palette.white,
    fontSize: 20,
    fontWeight: '800',
  },
  headerCopy: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: typography.heading,
    fontWeight: '800',
    color: palette.text,
  },
  meta: {
    fontSize: typography.body,
    color: palette.textMuted,
  },
  businessName: {
    fontSize: typography.label,
    color: palette.primary,
    fontWeight: '700',
  },
  messageWrap: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  message: {
    fontSize: typography.body,
    fontWeight: '700',
    padding: spacing.md,
    borderRadius: radius.sm,
  },
  successMessage: {
    color: palette.success,
    backgroundColor: palette.successSoft,
  },
  errorMessage: {
    color: palette.danger,
    backgroundColor: palette.dangerSoft,
  },
  section: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  lastSection: {
    paddingBottom: spacing.xxxl,
  },
  sectionTitle: {
    fontSize: typography.label,
    fontWeight: '800',
    color: palette.textSoft,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  linksGrid: {
    gap: spacing.xs,
  },
  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: palette.surface,
    ...shadows.card,
  },
  linkIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkCopy: {
    flex: 1,
    gap: 2,
  },
  linkLabel: {
    fontSize: typography.body,
    fontWeight: '700',
    color: palette.text,
  },
  linkSubtitle: {
    fontSize: typography.caption,
    color: palette.textMuted,
  },
  card: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: palette.surface,
    gap: spacing.md,
    ...shadows.card,
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
    flexDirection: 'row',
    gap: spacing.xs,
  },
  secondaryButtonLabel: {
    color: palette.text,
    fontSize: typography.body,
    fontWeight: '700',
  },
  signOutButton: {
    minHeight: 50,
    borderRadius: radius.md,
    backgroundColor: palette.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  signOutLabel: {
    color: palette.danger,
    fontSize: typography.body,
    fontWeight: '800',
  },
});
