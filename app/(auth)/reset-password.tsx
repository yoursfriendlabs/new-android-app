import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  AuthButton,
  AuthFooterLink,
  AuthInlineLink,
  AuthNotice,
  PasswordHints,
  StepIndicator,
} from '@/src/features/auth/components/AuthControls';
import { AuthScreen } from '@/src/features/auth/components/AuthScreen';
import { OtpInput } from '@/src/features/auth/components/OtpInput';
import { FormField } from '@/src/shared/forms/FormField';
import { authApi } from '@/src/api';
import {
  getPasswordHint,
  isStrongPassword,
  isValidEmail,
  OTP_LENGTH,
  OTP_RESEND_SECONDS,
  resolveAuthMessage,
} from '@/src/features/auth/lib/auth';
import { usePalette } from '@/src/stores/theme-store';
import { spacing, typography } from '@/src/theme';

type ResetStep = 'email' | 'otp' | 'password' | 'done';

export default function ResetPasswordScreen() {
  const colors = usePalette();
  const [step, setStep] = useState<ResetStep>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [tone, setTone] = useState<'error' | 'success' | 'info'>('info');
  const [submitting, setSubmitting] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const timer = setTimeout(() => setResendIn((current) => Math.max(current - 1, 0)), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  function showError(error: unknown, fallback: string) {
    setTone('error');
    setMessage(resolveAuthMessage(error, fallback));
  }

  async function requestCode() {
    if (!isValidEmail(email)) {
      setTone('error');
      setMessage('Enter the email linked to your account.');
      return;
    }

    setSubmitting(true);
    setMessage('');
    try {
      await authApi.requestPasswordReset({ email: email.trim() });
      setStep('otp');
      setCode('');
      setResendIn(OTP_RESEND_SECONDS);
      setTone('success');
      setMessage('We sent a 6-digit code to your email.');
    } catch (error) {
      showError(error, 'Unable to send a reset code right now.');
    } finally {
      setSubmitting(false);
    }
  }

  async function verifyCode(nextCode = code) {
    if (submitting) return;
    const otp = nextCode.replace(/\D/g, '');
    if (otp.length !== OTP_LENGTH) {
      setTone('error');
      setMessage('Enter the 6-digit code from your email.');
      return;
    }

    setSubmitting(true);
    setMessage('');
    try {
      await authApi.verifyPasswordResetOtp({ email: email.trim(), code: otp });
      setCode(otp);
      setStep('password');
      setTone('success');
      setMessage('Code verified. Choose a new password.');
    } catch (error) {
      showError(error, 'That code could not be verified.');
    } finally {
      setSubmitting(false);
    }
  }

  async function resetPassword() {
    if (!isStrongPassword(newPassword)) {
      setTone('error');
      setMessage(getPasswordHint(newPassword) || 'Choose a stronger password.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setTone('error');
      setMessage('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    setMessage('');
    try {
      await authApi.resetPassword({ email: email.trim(), code, newPassword });
      setStep('done');
      setTone('success');
      setMessage('');
    } catch (error) {
      showError(error, 'Unable to update the password.');
    } finally {
      setSubmitting(false);
    }
  }

  const stepNumber = step === 'email' ? 1 : step === 'otp' ? 2 : 3;

  if (step === 'done') {
    return (
      <AuthScreen
        title="Password updated"
        subtitle="You can now sign in with your new password."
        footer={
          <AuthFooterLink prompt="Need help?" action="Back to sign in" onPress={() => router.replace('/(auth)/login')} />
        }>
        <AuthNotice tone="success" message="Your password has been changed successfully." />
        <AuthButton label="Sign in" onPress={() => router.replace('/(auth)/login')} />
      </AuthScreen>
    );
  }

  return (
    <AuthScreen
      backLabel={step === 'email' ? 'Back to sign in' : 'Previous step'}
      onBack={() => {
        if (step === 'otp') {
          setStep('email');
          setMessage('');
          return;
        }
        if (step === 'password') {
          setStep('otp');
          setMessage('');
          return;
        }
        router.replace('/(auth)/login');
      }}
      title={step === 'email' ? 'Forgot password' : step === 'otp' ? 'Enter the code' : 'Set a new password'}
      subtitle={
        step === 'email'
          ? 'We will send a short code to the email on your account.'
          : step === 'otp'
            ? `Check ${email.trim()} and enter the 6-digit code.`
            : 'Use a password you have not used here before.'
      }
      footer={
        <AuthFooterLink
          prompt="Remembered it?"
          action="Sign in"
          onPress={() => router.replace('/(auth)/login')}
        />
      }>
      <StepIndicator step={stepNumber} total={3} />
      {message ? <AuthNotice tone={tone} message={message} /> : null}

      {step === 'email' ? (
        <>
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
            returnKeyType="send"
            onSubmitEditing={() => void requestCode()}
            helperText="Use the same email you sign in with."
          />
          <AuthButton label="Send reset code" loading={submitting} onPress={() => void requestCode()} />
        </>
      ) : null}

      {step === 'otp' ? (
        <>
          <OtpInput
            value={code}
            onChange={setCode}
            error={tone === 'error' && Boolean(message)}
            onComplete={(value) => void verifyCode(value)}
          />
          <AuthButton
            label="Verify code"
            loading={submitting}
            disabled={code.length !== OTP_LENGTH}
            onPress={() => void verifyCode()}
          />
          <View style={styles.resendRow}>
            {resendIn > 0 ? (
              <Text style={[styles.resend, { color: colors.textMuted }]}>You can request another code in {resendIn}s</Text>
            ) : (
              <>
                <Text style={[styles.resend, { color: colors.textMuted }]}>Didn’t get it? </Text>
                <AuthInlineLink onPress={() => void requestCode()}>Resend code</AuthInlineLink>
              </>
            )}
          </View>
        </>
      ) : null}

      {step === 'password' ? (
        <>
          <FormField
            label="New password"
            icon="lock-outline"
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="New password"
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
          />
          <PasswordHints password={newPassword} />
          <FormField
            label="Confirm password"
            icon="lock-check-outline"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Repeat new password"
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="go"
            onSubmitEditing={() => void resetPassword()}
          />
          <AuthButton label="Update password" loading={submitting} onPress={() => void resetPassword()} />
        </>
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
