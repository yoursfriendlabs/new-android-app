import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

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
  minLengthText,
  requiredPhone,
  type FieldErrors,
} from '@/src/shared/lib/validation';
import { useAuthStore } from '@/src/stores/auth-store';
import { usePalette } from '@/src/stores/theme-store';
import { iconSize, radius, spacing, typography } from '@/src/theme';
import type { AppPalette } from '@/src/theme/app-palette';
import { useThemedStyles } from '@/src/theme/use-themed-styles';

type Field = 'name' | 'phone';

/**
 * The person signed in, kept apart from the business they run. One account can
 * own several workspaces, so this is edited on its own: a new phone number here
 * does not change what is printed on a shop's bills.
 */
export function OwnerProfileScreen() {
  const colors = usePalette();
  const styles = useThemedStyles(createStyles);
  const toast = useToast();
  const user = useAuthStore((state) => state.user);
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const hasPassword = useAuthStore((state) => state.user?.hasPassword !== false);
  const submission = useSubmissionLock();

  const [form, setForm] = useState(() => ({
    name: user?.name ?? '',
    phone: user?.phone ?? '',
  }));
  const [errors, setErrors] = useState<FieldErrors<Field>>({});
  const [saving, setSaving] = useState(false);

  function update(key: Field, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => (current[key] ? { ...current, [key]: '' } : current));
  }

  async function handleSave() {
    const nextErrors: FieldErrors<Field> = {
      name: minLengthText(form.name, 2, 'Enter your full name.'),
      phone: requiredPhone(form.phone),
    };
    setErrors(nextErrors);
    if (hasFieldError(nextErrors)) {
      toast.error(firstFieldError(nextErrors));
      return;
    }

    if (!submission.tryStart()) return;
    setSaving(true);
    try {
      await updateProfile({ name: form.name.trim(), phone: form.phone.trim() });
      toast.success('Your details are saved');
    } catch (error) {
      if (isInvalidSessionError(error)) return;
      toast.error(error instanceof Error ? error.message : 'Could not save your details.');
    } finally {
      setSaving(false);
      submission.finish();
    }
  }

  async function handleAvatarChange(nextUrl: string | null) {
    if (!submission.tryStart()) {
      toast.error('Your details are still saving. Please try the photo again.');
      return;
    }
    setSaving(true);
    try {
      await updateProfile({ avatarUrl: nextUrl });
      toast.success(nextUrl ? 'Photo updated' : 'Photo removed');
    } catch (error) {
      if (isInvalidSessionError(error)) return;
      toast.error(error instanceof Error ? error.message : 'Could not save the photo.');
    } finally {
      setSaving(false);
      submission.finish();
    }
  }

  const links = [
    {
      id: 'password',
      icon: 'lock-outline' as const,
      label: hasPassword ? 'Change password' : 'Set a password',
      helper: hasPassword
        ? 'Needs your current password to confirm.'
        : 'You sign in with Google. Set a password to also sign in with your email.',
      onPress: () => router.push('/(app)/change-password'),
    },
    {
      id: 'delete',
      icon: 'account-remove-outline' as const,
      label: 'Delete my account',
      helper: 'Removes this account and the workspaces only you own.',
      danger: true,
      onPress: () => router.push('/(app)/delete-account'),
    },
  ];

  return (
    <Screen
      topBarTitle="Your details"
      footer={
        <StickyActionBar
          primary={{
            label: saving ? 'Saving…' : 'Save your details',
            tone: 'primary',
            loading: saving,
            disabled: saving,
            onPress: () => void handleSave(),
          }}
        />
      }>
      <SurfaceCard title="Photo" subtitle="Shown beside your name in the app.">
        <AvatarPicker
          value={user?.avatarUrl}
          name={form.name}
          size={88}
          label={user?.avatarUrl ? 'Change photo' : 'Add photo'}
          onChange={handleAvatarChange}
          disabled={saving}
        />
      </SurfaceCard>

      <SurfaceCard title="About you" subtitle="Your own name and number, not the shop's.">
        <FormField
          label="Full name"
          icon="account-outline"
          value={form.name}
          onChangeText={(value) => update('name', value)}
          placeholder="Your name"
          autoCapitalize="words"
          error={errors.name}
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
          value={user?.email ?? ''}
          onChangeText={() => undefined}
          editable={false}
          helperText="This is how you sign in, so it cannot be changed here."
        />
      </SurfaceCard>

      <SurfaceCard title="Sign-in and account">
        <View style={styles.linkList}>
          {links.map((link) => (
            <Pressable
              key={link.id}
              accessibilityRole="button"
              accessibilityLabel={link.label}
              onPress={link.onPress}
              style={({ pressed }) => [styles.linkRow, pressed && { backgroundColor: colors.surfaceMuted }]}>
              <MaterialCommunityIcons
                name={link.icon}
                size={iconSize.control}
                color={link.danger ? colors.danger : colors.textSoft}
              />
              <View style={styles.linkCopy}>
                <Text style={[styles.linkLabel, link.danger && { color: colors.danger }]}>{link.label}</Text>
                <Text style={styles.linkHelper}>{link.helper}</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={iconSize.control} color={colors.textSoft} />
            </Pressable>
          ))}
        </View>
      </SurfaceCard>
    </Screen>
  );
}

const createStyles = (colors: AppPalette) =>
  StyleSheet.create({
    linkList: {
      gap: spacing.xs,
    },
    linkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      minHeight: 56,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.md,
    },
    linkCopy: {
      flex: 1,
      gap: 2,
    },
    linkLabel: {
      color: colors.text,
      fontSize: typography.body,
      fontWeight: '700',
    },
    linkHelper: {
      color: colors.textMuted,
      fontSize: typography.caption,
      lineHeight: 17,
    },
  });
