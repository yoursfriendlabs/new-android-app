import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { isInvalidSessionError } from '@/src/api/client';
import { FormField } from '@/src/shared/forms/FormField';
import { Screen } from '@/src/shared/layout/Screen';
import { CompactThemeRow } from '@/src/shared/ui/ThemeSelector';
import { canAccessSegment, isPersonalWorkspace } from '@/src/shared/lib/business';
import { useAuthStore } from '@/src/stores/auth-store';
import { usePalette } from '@/src/stores/theme-store';
import type { AppPalette } from '@/src/theme/app-palette';
import { radius, shadows, spacing, typography } from '@/src/theme';
import { useThemedStyles } from '@/src/theme/use-themed-styles';

type Tone = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'purple';

type MenuLink = {
  id: string;
  segment: string;
  label: string;
  subtitle: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  tone: Tone;
  route: string;
};

type MenuGroup = {
  id: string;
  title: string;
  items: MenuLink[];
};

function toneColors(tone: Tone, colors: AppPalette) {
  switch (tone) {
    case 'success':
      return { fg: colors.success, bg: colors.successSoft };
    case 'warning':
      return { fg: colors.warning, bg: colors.warningSoft };
    case 'danger':
      return { fg: colors.danger, bg: colors.dangerSoft };
    case 'info':
      return { fg: colors.info, bg: colors.infoSoft };
    case 'purple':
      return { fg: colors.purple, bg: colors.purpleSoft };
    default:
      return { fg: colors.primary, bg: colors.accentSoft };
  }
}

const MENU_GROUPS: MenuGroup[] = [
  {
    id: 'daily',
    title: 'Daily work',
    items: [
      {
        id: 'quick-entry',
        segment: 'quick-entry',
        label: 'Quick entry',
        subtitle: 'Record a purchase or expense fast',
        icon: 'lightning-bolt',
        tone: 'warning',
        route: '/(app)/(tabs)/quick-entry',
      },
      {
        id: 'expenses',
        segment: 'expenses',
        label: 'Expenses',
        subtitle: 'Spending, categories, and cash out',
        icon: 'wallet-outline',
        tone: 'danger',
        route: '/(app)/(tabs)/expenses',
      },
      {
        id: 'tasks',
        segment: 'tasks',
        label: 'Tasks & notes',
        subtitle: 'To-dos, reminders, and notes',
        icon: 'checkbox-marked-circle-outline',
        tone: 'success',
        route: '/(app)/(tabs)/tasks',
      },
      {
        id: 'coins',
        segment: 'home',
        label: 'Coins',
        subtitle: 'History and merch you can redeem',
        icon: 'circle-multiple',
        tone: 'warning',
        route: '/(app)/coins',
      },
      {
        id: 'services',
        segment: 'services',
        label: 'Services',
        subtitle: 'Jobs, orders, and deliveries',
        icon: 'toolbox-outline',
        tone: 'info',
        route: '/(app)/(tabs)/services',
      },
      {
        id: 'inventory',
        segment: 'inventory',
        label: 'Inventory',
        subtitle: 'Stock, products, and low alerts',
        icon: 'package-variant-closed',
        tone: 'primary',
        route: '/(app)/(tabs)/inventory',
      },
    ],
  },
  {
    id: 'money',
    title: 'Money',
    items: [
      {
        id: 'purchases',
        segment: 'purchases',
        label: 'Purchases',
        subtitle: 'Supplier bills and stock buying',
        icon: 'cart-outline',
        tone: 'purple',
        route: '/(app)/purchases',
      },
      {
        id: 'ledger',
        segment: 'ledger',
        label: 'Ledger',
        subtitle: 'Balances, dues, and history',
        icon: 'book-open-page-variant-outline',
        tone: 'primary',
        route: '/(app)/ledger',
      },
      {
        id: 'banks',
        segment: 'banks',
        label: 'Banks',
        subtitle: 'Accounts and transfers',
        icon: 'bank-outline',
        tone: 'info',
        route: '/(app)/banks',
      },
      {
        id: 'expense-categories',
        segment: 'expenses',
        label: 'Expense categories',
        subtitle: 'Labels used when adding an expense',
        icon: 'shape-outline',
        tone: 'warning',
        route: '/(app)/expense-categories',
      },
    ],
  },
  {
    id: 'shop',
    title: 'Shop floor',
    items: [
      {
        id: 'orders',
        segment: 'orders',
        label: 'Seating map',
        subtitle: 'Tables and cafe orders',
        icon: 'table-chair',
        tone: 'primary',
        route: '/(app)/(tabs)/orders',
      },
      {
        id: 'tables',
        segment: 'tables',
        label: 'Tables',
        subtitle: 'Layout and seating setup',
        icon: 'table-furniture',
        tone: 'info',
        route: '/(app)/tables',
      },
      {
        id: 'cashier',
        segment: 'cashier',
        label: 'Cashier',
        subtitle: 'Close dining bills',
        icon: 'calculator-variant-outline',
        tone: 'success',
        route: '/(app)/cashier',
      },
    ],
  },
  {
    id: 'team',
    title: 'Team',
    items: [
      {
        id: 'staff',
        segment: 'owner-tools',
        label: 'Staff',
        subtitle: 'Team, payroll, and access',
        icon: 'account-multiple-outline',
        tone: 'purple',
        route: '/(app)/staff',
      },
      {
        id: 'attendance',
        segment: 'attendance',
        label: 'Attendance',
        subtitle: 'Check-in and check-out',
        icon: 'map-marker-radius',
        tone: 'success',
        route: '/(app)/attendance',
      },
    ],
  },
];

function initials(name?: string | null) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return 'U';
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export default function MoreScreen() {
  const colors = usePalette();
  const styles = useThemedStyles(createStyles);
  const signOut = useAuthStore((state) => state.signOut);
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const user = useAuthStore((state) => state.user);
  const session = useAuthStore((state) => state.session);
  const accessControl = useAuthStore((state) => state.accessControl);
  const businessProfile = useAuthStore((state) => state.businessProfile);

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

  const groups = useMemo(() => {
    const context = {
      role: session?.role ?? user?.role ?? undefined,
      permissions: accessControl?.permissions ?? user?.permissions,
      accessControl,
      enabledModules: businessProfile?.enabledModules,
      businessType: String(businessProfile?.businessType ?? businessProfile?.type ?? ''),
    };
    const personal = isPersonalWorkspace(context);
    return MENU_GROUPS.map((group) => ({
      ...group,
      title: personal
        ? group.id === 'daily'
          ? 'Everyday'
          : group.id === 'money'
            ? 'Books'
            : group.title
        : group.title,
      items: group.items
        .filter((item) => {
          if (item.id === 'coins') return personal;
          return canAccessSegment(context, item.segment);
        })
        .map((item) => {
          if (!personal) return item;
          if (item.id === 'expenses') {
            return { ...item, label: 'Money', subtitle: 'Income, expenses, and what you saved' };
          }
          if (item.id === 'tasks') {
            return { ...item, label: 'Notes & reminders', subtitle: 'Water, focus, notes — earn coins' };
          }
          if (item.id === 'expense-categories') {
            return { ...item, label: 'Categories', subtitle: 'Labels for spending' };
          }
          if (item.id === 'ledger') {
            return { ...item, label: 'History', subtitle: 'Every payment in and out' };
          }
          return item;
        }),
    })).filter((group) => group.items.length > 0);
  }, [
    accessControl,
    businessProfile?.businessType,
    businessProfile?.enabledModules,
    businessProfile?.type,
    session?.role,
    user?.permissions,
    user?.role,
  ]);

  async function handleProfileSave() {
    try {
      setSaving(true);
      setMessage('');
      await updateProfile(profileForm);
      setMessage('Profile updated.');
    } catch (error) {
      if (isInvalidSessionError(error)) return;
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
    <Screen showTopBar={false}>
      <View style={styles.header}>
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
          <Text style={[styles.avatarLabel, { color: colors.onPrimary }]}>{initials(user?.name)}</Text>
        </View>
        <View style={styles.headerCopy}>
          <Text style={[styles.name, { color: colors.text }]}>{user?.name || 'Your profile'}</Text>
          <Text style={[styles.meta, { color: colors.textMuted }]}>
            {user?.email || user?.phone || businessProfile?.businessName || 'PasalManager'}
          </Text>
          {businessProfile?.businessName ? (
            <Text style={[styles.businessName, { color: colors.primary }]}>{businessProfile.businessName}</Text>
          ) : null}
        </View>
      </View>

      {message ? (
        <View
          style={[
            styles.message,
            {
              backgroundColor: message.toLowerCase().includes('updated') ? colors.successSoft : colors.dangerSoft,
            },
          ]}>
          <Text
            style={{
              color: message.toLowerCase().includes('updated') ? colors.success : colors.danger,
              fontWeight: '700',
            }}>
            {message}
          </Text>
        </View>
      ) : null}

      {groups.map((group) => (
        <View key={group.id} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSoft }]}>{group.title}</Text>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {group.items.map((item, index) => {
              const tone = toneColors(item.tone, colors);
              return (
                <Pressable
                  key={item.id}
                  onPress={() => router.push(item.route as never)}
                  style={({ pressed }) => [
                    styles.row,
                    index < group.items.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                    pressed && { opacity: 0.72 },
                  ]}>
                  <View style={[styles.rowIcon, { backgroundColor: tone.bg }]}>
                    <MaterialCommunityIcons color={tone.fg} name={item.icon} size={20} />
                  </View>
                  <View style={styles.rowCopy}>
                    <Text style={[styles.rowLabel, { color: colors.text }]}>{item.label}</Text>
                    <Text numberOfLines={1} style={[styles.rowSubtitle, { color: colors.textMuted }]}>
                      {item.subtitle}
                    </Text>
                  </View>
                  <MaterialCommunityIcons color={colors.textSoft} name="chevron-right" size={20} />
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSoft }]}>Appearance</Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, padding: spacing.md, gap: spacing.md }]}>
          <Text style={[styles.hint, { color: colors.textMuted }]}>
            Color theme for this device. Buttons and screens follow your pick.
          </Text>
          <CompactThemeRow />
          <Pressable
            style={[styles.secondaryButton, { backgroundColor: colors.backgroundAlt }]}
            onPress={() => router.push('/(app)/settings')}>
            <MaterialCommunityIcons color={colors.text} name="palette-outline" size={18} />
            <Text style={[styles.secondaryLabel, { color: colors.text }]}>Customize theme</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSoft }]}>Profile</Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, padding: spacing.md, gap: spacing.md }]}>
          <FormField
            label="Name"
            value={profileForm.name}
            onChangeText={(name) => setProfileForm((current) => ({ ...current, name }))}
          />
          <FormField
            label="Phone"
            value={profileForm.phone}
            onChangeText={(phone) => setProfileForm((current) => ({ ...current, phone }))}
            keyboardType="phone-pad"
          />
          <Pressable
            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
            onPress={() => void handleProfileSave()}
            disabled={saving}>
            {saving ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={[styles.primaryLabel, { color: colors.onPrimary }]}>Save profile</Text>
            )}
          </Pressable>
        </View>
      </View>

      <View style={[styles.section, styles.lastSection]}>
        <Text style={[styles.sectionTitle, { color: colors.textSoft }]}>Security</Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, padding: spacing.md, gap: spacing.sm }]}>
          <Pressable
            style={[styles.secondaryButton, { backgroundColor: colors.backgroundAlt }]}
            onPress={() => router.push('/(app)/change-password')}>
            <MaterialCommunityIcons color={colors.text} name="lock-reset" size={18} />
            <Text style={[styles.secondaryLabel, { color: colors.text }]}>Change password</Text>
          </Pressable>
          <Pressable
            style={[styles.secondaryButton, { backgroundColor: colors.dangerSoft }]}
            onPress={() => void handleSignOut()}
            disabled={signingOut}>
            {signingOut ? (
              <ActivityIndicator color={colors.danger} />
            ) : (
              <>
                <MaterialCommunityIcons color={colors.danger} name="logout" size={18} />
                <Text style={[styles.secondaryLabel, { color: colors.danger }]}>Logout</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

const createStyles = (colors: AppPalette) => StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingBottom: spacing.sm,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLabel: {
    fontSize: 18,
    fontWeight: '800',
  },
  headerCopy: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: typography.heading,
    fontWeight: '800',
  },
  meta: {
    fontSize: typography.body,
  },
  businessName: {
    fontSize: typography.label,
    fontWeight: '700',
  },
  message: {
    padding: spacing.md,
    borderRadius: radius.sm,
  },
  section: {
    gap: spacing.sm,
  },
  lastSection: {
    paddingBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    ...shadows.card,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowCopy: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    fontSize: typography.body,
    fontWeight: '700',
  },
  rowSubtitle: {
    fontSize: typography.caption,
  },
  hint: {
    fontSize: typography.caption,
    lineHeight: 18,
  },
  primaryButton: {
    minHeight: 50,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLabel: {
    fontSize: typography.body,
    fontWeight: '800',
  },
  secondaryButton: {
    minHeight: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  secondaryLabel: {
    fontSize: typography.body,
    fontWeight: '700',
  },
});
