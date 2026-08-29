import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AuthButton, AuthInlineLink, AuthNotice, StepIndicator } from '@/src/features/auth/components/AuthControls';
import { AuthScreen } from '@/src/features/auth/components/AuthScreen';
import { OtpInput } from '@/src/features/auth/components/OtpInput';
import { FormField } from '@/src/shared/forms/FormField';
import { isValidEmail, OTP_LENGTH, OTP_RESEND_SECONDS, resolveAuthMessage } from '@/src/features/auth/lib/auth';
import { useAuthStore } from '@/src/stores/auth-store';
import { usePalette } from '@/src/stores/theme-store';
import { spacing, typography } from '@/src/theme';

export default function VerifyEmailScreen() {
  const colors = usePalette();
  const pendingVerification = useAuthStore((state) => state.pendingVerification);
  const requestEmailOtp = useAuthStore((state) => state.requestEmailOtp);
  const verifyEmailOtp = useAuthStore((state) => state.verifyEmailOtp);
  const [email, setEmail] = useState(pendingVerification?.email ?? '');
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [tone, setTone] = useState<'error' | 'success' | 'info'>('info');
  const [submitting, setSubmitting] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [codeSent, setCodeSent] = useState(Boolean(pendingVerification?.email));

  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const timer = setTimeout(() => setResendIn((current) => Math.max(current - 1, 0)), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  async function handleResend() {
    if (!isValidEmail(email)) {
      setTone('error');
      setMessage('Enter the email you registered with.');
      return;
    }

    try {
      setSubmitting(true);
      setMessage('');
      await requestEmailOtp(email);
      setCodeSent(true);
      setResendIn(OTP_RESEND_SECONDS);
      setTone('success');
      setMessage('Verification code sent. Check your inbox.');
    } catch (error) {
      setTone('error');
      setMessage(resolveAuthMessage(error, 'Unable to send a verification code.'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerify(nextCode = code) {
    if (submitting) return;
    if (!isValidEmail(email)) {
      setTone('error');
      setMessage('Enter the email you registered with.');
      return;
    }
    const otp = nextCode.replace(/\D/g, '');
    if (otp.length !== OTP_LENGTH) {
      setTone('error');
      setMessage('Enter the 6-digit code from your email.');
      return;
    }

    try {
      setSubmitting(true);
      setMessage('');
      const result = await verifyEmailOtp({ email, code: otp });
      if (result === 'signed-in') {
        router.replace('/(app)/(tabs)/home');
        return;
      }
      setTone('info');
      setMessage('Code accepted. Finish signing in to continue.');
    } catch (error) {
      setTone('error');
      setMessage(resolveAuthMessage(error, 'Unable to verify that code.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthScreen
      backLabel="Back to sign in"
      onBack={() => router.replace('/(auth)/login')}
      title="Verify your email"
      subtitle={
        email
          ? `Enter the 6-digit code we sent to ${email}.`
          : 'Enter your email and we will send a short verification code.'
      }>
      <StepIndicator step={codeSent ? 2 : 1} total={2} />
      {message ? <AuthNotice tone={tone} message={message} /> : null}

      {!pendingVerification?.email ? (
        <FormField
          label="Email"
          icon="email-outline"
          value={email}
          onChangeText={setEmail}
          placeholder="you@email.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
        />
      ) : null}

      {codeSent ? (
        <OtpInput
          value={code}
          onChange={setCode}
          error={tone === 'error' && Boolean(message)}
          onComplete={(value) => void handleVerify(value)}
        />
      ) : null}

      {codeSent ? (
        <AuthButton
          label="Verify and continue"
          loading={submitting}
          disabled={code.length !== OTP_LENGTH}
          onPress={() => void handleVerify()}
        />
      ) : (
        <AuthButton label="Send code" loading={submitting} onPress={() => void handleResend()} />
      )}

      {codeSent ? (
        <View style={styles.resendRow}>
          {resendIn > 0 ? (
            <Text style={[styles.resend, { color: colors.textMuted }]}>You can request another code in {resendIn}s</Text>
          ) : (
            <>
              <Text style={[styles.resend, { color: colors.textMuted }]}>Didn’t get it? </Text>
              <AuthInlineLink onPress={() => void handleResend()}>Resend code</AuthInlineLink>
            </>
          )}
        </View>
      ) : null}
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  resendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: spacing.xs,
  },
  resend: {
    textAlign: 'center',
    fontSize: typography.label,
    lineHeight: 20,
  },
});
