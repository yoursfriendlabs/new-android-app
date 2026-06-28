import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { authApi } from '@/src/api';
import { FormField } from '@/src/components/forms/FormField';
import { Screen } from '@/src/components/layout/Screen';
import { SurfaceCard } from '@/src/components/ui/SurfaceCard';
import { palette, radius, typography } from '@/src/theme';

export default function ResetPasswordScreen() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [codeRequested, setCodeRequested] = useState(false);
  const [codeVerified, setCodeVerified] = useState(false);

  async function requestCode() {
    setSubmitting(true);
    setMessage('');
    try {
      await authApi.requestPasswordReset({ email: email.trim() });
      setCodeRequested(true);
      setCodeVerified(false);
      setMessage('Reset code requested. Check your email.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to request reset code.');
    } finally {
      setSubmitting(false);
    }
  }

  async function verifyCode() {
    setSubmitting(true);
    setMessage('');
    try {
      await authApi.verifyPasswordResetOtp({ email: email.trim(), code });
      setCodeVerified(true);
      setMessage('Code verified. Enter your new password to finish.');
    } catch (error) {
      setCodeVerified(false);
      setMessage(error instanceof Error ? error.message : 'Unable to verify reset code.');
    } finally {
      setSubmitting(false);
    }
  }

  async function resetPassword() {
    if (!codeVerified) {
      setMessage('Verify the OTP code before setting a new password.');
      return;
    }

    setSubmitting(true);
    setMessage('');
    try {
      await authApi.resetPassword({ email: email.trim(), code, newPassword });
      setCodeRequested(false);
      setCodeVerified(false);
      setMessage('Password updated. Go back and sign in.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to reset password.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <SurfaceCard
        title="Reset password"
        subtitle="Request a code, verify the OTP, then set the new password on the same screen.">
        <FormField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
        <Pressable style={styles.secondaryButton} onPress={requestCode} disabled={submitting}>
          {submitting ? <ActivityIndicator color={palette.text} /> : <Text style={styles.secondaryLabel}>Request code</Text>}
        </Pressable>
        <FormField label="OTP code" value={code} onChangeText={setCode} keyboardType="numeric" />
        <Pressable
          style={styles.secondaryButton}
          onPress={verifyCode}
          disabled={submitting || !codeRequested}>
          {submitting ? <ActivityIndicator color={palette.text} /> : <Text style={styles.secondaryLabel}>Verify code</Text>}
        </Pressable>
        <FormField label="New password" value={newPassword} onChangeText={setNewPassword} secureTextEntry autoCapitalize="none" />
        <Pressable style={styles.primaryButton} onPress={resetPassword} disabled={submitting || !codeVerified}>
          {submitting ? <ActivityIndicator color={palette.white} /> : <Text style={styles.primaryLabel}>Reset password</Text>}
        </Pressable>
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </SurfaceCard>
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
  secondaryButton: {
    minHeight: 46,
    borderRadius: radius.md,
    backgroundColor: palette.backgroundAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLabel: {
    color: palette.white,
    fontSize: typography.body,
    fontWeight: '800',
  },
  secondaryLabel: {
    color: palette.text,
    fontSize: typography.body,
    fontWeight: '700',
  },
  message: {
    color: palette.textMuted,
    fontSize: typography.body,
  },
});
