import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';

import { isInvalidSessionError } from '@/src/api/client';
import { FormField } from '@/src/components/forms/FormField';
import { Screen } from '@/src/components/layout/Screen';
import { SurfaceCard } from '@/src/components/ui/SurfaceCard';
import { palette, radius, spacing, typography } from '@/src/theme';
import { useAuthStore } from '@/src/stores/auth-store';

export default function ChangePasswordScreen() {
  const changePassword = useAuthStore((state) => state.changePassword);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSave() {
    if (!currentPassword || !newPassword) {
      setMessage('Enter both the current and new password.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage('The new password confirmation does not match.');
      return;
    }

    try {
      setSubmitting(true);
      setMessage('');
      await changePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setMessage('Password changed successfully.');
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
    <Screen topBarTitle="Change Password">
      <SurfaceCard
        title="Security update"
        subtitle="Use the current password to confirm this change on the device.">
        <FormField
          label="Current password"
          value={currentPassword}
          onChangeText={setCurrentPassword}
          secureTextEntry
          autoCapitalize="none"
        />
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
            <ActivityIndicator color={palette.white} />
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

const styles = StyleSheet.create({
  message: {
    fontSize: typography.body,
    lineHeight: 22,
  },
  successMessage: {
    color: palette.success,
    fontWeight: '700',
  },
  errorMessage: {
    color: palette.danger,
    fontWeight: '700',
  },
  primaryButton: {
    minHeight: 52,
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
    marginTop: spacing.xs,
  },
  secondaryButtonLabel: {
    color: palette.text,
    fontSize: typography.body,
    fontWeight: '700',
  },
});
