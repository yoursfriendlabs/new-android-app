import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { FormField } from '@/src/components/forms/FormField';
import { Screen } from '@/src/components/layout/Screen';
import { SurfaceCard } from '@/src/components/ui/SurfaceCard';
import { palette, radius, typography } from '@/src/theme';
import { useAuthStore } from '@/src/stores/auth-store';

export default function VerifyEmailScreen() {
  const pendingVerification = useAuthStore((state) => state.pendingVerification);
  const requestEmailOtp = useAuthStore((state) => state.requestEmailOtp);
  const verifyEmailOtp = useAuthStore((state) => state.verifyEmailOtp);
  const [email, setEmail] = useState(pendingVerification?.email ?? 'owner@example.com');
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleResend() {
    try {
      setSubmitting(true);
      setMessage('');
      await requestEmailOtp(email);
      setMessage('Verification code sent. Check your email.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to send verification code.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerify() {
    try {
      setSubmitting(true);
      setMessage('');
      const result = await verifyEmailOtp({ email, code });
      if (result === 'signed-in') {
        router.replace('/(app)/(tabs)/home');
        return;
      }
      setMessage('Code accepted, but the session is still waiting for verification.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to verify email.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <SurfaceCard title="Verify email" subtitle="Finish OTP verification to unlock the business account on this device.">
        <FormField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
        <Pressable style={styles.secondaryButton} onPress={handleResend} disabled={submitting}>
          {submitting ? <ActivityIndicator color={palette.text} /> : <Text style={styles.secondaryLabel}>Send code</Text>}
        </Pressable>
        <FormField label="OTP code" value={code} onChangeText={setCode} keyboardType="numeric" />
        <Pressable style={styles.primaryButton} onPress={handleVerify} disabled={submitting}>
          {submitting ? <ActivityIndicator color={palette.white} /> : <Text style={styles.primaryLabel}>Verify and continue</Text>}
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
