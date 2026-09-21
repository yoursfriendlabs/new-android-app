import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';

import { isInvalidSessionError } from '@/src/api/client';
import { FormField } from '@/src/shared/forms/FormField';
import { Screen } from '@/src/shared/layout/Screen';
import { SurfaceCard } from '@/src/shared/ui/SurfaceCard';
import { radius, spacing, typography } from '@/src/theme';
import { useAuthStore } from '@/src/stores/auth-store';
import { usePalette } from '@/src/stores/theme-store';
import { useThemedStyles } from '@/src/theme/use-themed-styles';
import type { AppPalette } from '@/src/theme/app-palette';

export default function ChangePasswordScreen() {
  const colors = usePalette();
  const styles = useThemedStyles(createStyles);
  const changePassword = useAuthStore((state) => state.changePassword);
  // Google sign-ups have no password yet, so they set one without the old one.
  const hasPassword = useAuthStore((state) => state.user?.hasPassword !== false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSave() {
    if ((hasPassword && !currentPassword) || !newPassword) {
      setMessage(hasPassword ? 'Enter both the current and new password.' : 'Enter a new password.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage('The new password confirmation does not match.');
      return;
    }

    try {
      setSubmitting(true);
      setMessage('');
      await changePassword(hasPassword ? { currentPassword, newPassword } : { newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setMessage(hasPassword ? 'Password changed successfully.' : 'Password set successfully.');
    } catch (error) {
      if (isInvalidSessionError(error)) {
        return;
      }

      setMessage(error instanceof Error ? error.message : 'Unable to change the password.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen topBarTitle={hasPassword ? 'Change Password' : 'Set Password'}>
      <SurfaceCard
        title="Security update"
        subtitle={
          hasPassword
            ? 'Use the current password to confirm this change on the device.'
            : 'You sign in with Google. Set a password to also sign in with your email.'
        }>
        {hasPassword ? (
          <FormField
            label="Current password"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry
            autoCapitalize="none"
          />
        ) : null}
        <FormField
          label="New password"
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
          autoCapitalize="none"
        />
        <FormField
          label="Confirm new password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          autoCapitalize="none"
        />
        {message ? (
          <Text style={[styles.message, message.includes('successfully') ? styles.successMessage : styles.errorMessage]}>
            {message}
          </Text>
        ) : null}
        <Pressable style={styles.primaryButton} onPress={() => void handleSave()} disabled={submitting}>
          {submitting ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={styles.primaryButtonLabel}>Save new password</Text>
          )}
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => router.back()} disabled={submitting}>
          <Text style={styles.secondaryButtonLabel}>Back to profile</Text>
        </Pressable>
      </SurfaceCard>
    </Screen>
  );
}

const createStyles = (colors: AppPalette) => StyleSheet.create({
  message: {
    fontSize: typography.body,
    lineHeight: 22,
  },
  successMessage: {
    color: colors.success,
    fontWeight: '700',
  },
  errorMessage: {
    color: colors.danger,
    fontWeight: '700',
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonLabel: {
    color: colors.onPrimary,
    fontSize: typography.body,
    fontWeight: '800',
  },
  secondaryButton: {
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: colors.backgroundAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  secondaryButtonLabel: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '700',
  },
});
