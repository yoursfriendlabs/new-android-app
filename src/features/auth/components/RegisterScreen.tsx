import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/src/api/client';
import {
  AuthButton,
  AuthDivider,
  AuthFooterLink,
  AuthInlineLink,
  AuthNotice,
  PasswordHints,
  StepIndicator,
} from '@/src/features/auth/components/AuthControls';
import { AuthScreen } from '@/src/features/auth/components/AuthScreen';
import { GoogleSignInButton } from '@/src/features/auth/components/GoogleSignInButton';
import { OtpInput } from '@/src/features/auth/components/OtpInput';
import {
  AccountKindPicker,
  BusinessTypePicker,
  buildBusinessTypeOptions,
  type AccountKind,
} from '@/src/features/auth/components/WorkspaceTypePicker';
import {
  digitsOnly,
  getSignupDetailsError,
  getSignupEmailError,
  getWorkspaceError,
  normalizeEmail,
  OTP_LENGTH,
  OTP_RESEND_SECONDS,
  PHONE_MIN_DIGITS,
  resolveAuthMessage,
} from '@/src/features/auth/lib/auth';
import { isGoogleSignInAvailable } from '@/src/features/auth/lib/google';
import { useTranslation } from '@/src/i18n';
import { FormField } from '@/src/shared/forms/FormField';
import { useBusinessTypes } from '@/src/shared/hooks/useAppQueries';
import { personalWorkspaceName } from '@/src/shared/lib/workspace';
import { useAuthStore } from '@/src/stores/auth-store';
import { usePalette } from '@/src/stores/theme-store';
import { spacing, typography } from '@/src/theme';

// Email first, so a taken email is caught before anyone fills in details.
// Google skips straight to the last step.
type Step = 'email' | 'code' | 'details' | 'workspace';
const EMAIL_STEPS: Step[] = ['email', 'code', 'details', 'workspace'];

export function RegisterScreen() {
  const colors = usePalette();
  const { t } = useTranslation();
  const register = useAuthStore((state) => state.register);
  const requestSignupCode = useAuthStore((state) => state.requestSignupCode);
  const verifySignupCode = useAuthStore((state) => state.verifySignupCode);
  const clearPendingSignup = useAuthStore((state) => state.clearPendingSignup);
  const pendingSignup = useAuthStore((state) => state.pendingSignup);
  const { data: businessTypes } = useBusinessTypes();
  const options = useMemo(() => buildBusinessTypeOptions(businessTypes), [businessTypes]);

  // Arriving from "Continue with Google" on the sign-in screen.
  const [step, setStep] = useState<Step>(() =>
    pendingSignup?.provider === 'google' ? 'workspace' : pendingSignup ? 'details' : 'email',
  );
  const [email, setEmail] = useState(pendingSignup?.email ?? '');
  const [code, setCode] = useState('');
  const [form, setForm] = useState({
    name: '',
    phone: '',
    password: '',
    confirmPassword: '',
    businessName: '',
    accountKind: 'personal' as AccountKind,
    businessType: options[0]?.value ?? 'retail',
  });
  const [error, setError] = useState('');
  const [emailTaken, setEmailTaken] = useState(false);
  const [notice, setNotice] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  const isGoogle = pendingSignup?.provider === 'google';
  const verifiedEmail = pendingSignup?.email ?? normalizeEmail(email);
  const displayName = isGoogle ? pendingSignup?.name || verifiedEmail.split('@')[0] : form.name.trim();
  const selectedBusinessType = options.find((option) => option.value === form.businessType) ?? options[0];
  const isPersonal = form.accountKind === 'personal';
  const phoneHelper =
    form.phone && digitsOnly(form.phone).length < PHONE_MIN_DIGITS
      ? `Needs at least ${PHONE_MIN_DIGITS} digits`
      : undefined;

  useEffect(() => {
    if (!options.length) return;
    if (options.some((option) => option.value === form.businessType)) return;
    setForm((current) => ({ ...current, businessType: options[0].value }));
  }, [form.businessType, options]);

  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const timer = setTimeout(() => setResendIn((current) => Math.max(current - 1, 0)), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setError('');
    setFieldErrors((current) => ({ ...current, [key]: '' }));
  }

  function goTo(next: Step) {
    setError('');
    setNotice('');
    setEmailTaken(false);
    setFieldErrors({});
    setStep(next);
  }

  function startOver() {
    clearPendingSignup();
    setCode('');
    goTo('email');
  }

  async function sendCode() {
    const nextError = getSignupEmailError(email);
    if (nextError) {
      setError(nextError);
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      setEmailTaken(false);
      const response = await requestSignupCode(email);
      setResendIn(response.retryAfterSeconds ?? OTP_RESEND_SECONDS);
      setCode('');
      goTo('code');
      setNotice(`We sent a ${OTP_LENGTH}-digit code to ${normalizeEmail(email)}.`);
    } catch (nextError) {
      if (nextError instanceof ApiError && nextError.status === 409) {
        setEmailTaken(true);
        setError('This email already has an account.');
      } else {
        setError(resolveAuthMessage(nextError, 'Unable to send the code. Try again.'));
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function checkCode(nextCode = code) {
    if (submitting) return;
    const otp = nextCode.replace(/\D/g, '');
    if (otp.length !== OTP_LENGTH) {
      setError(`Enter the ${OTP_LENGTH}-digit code from your email.`);
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      await verifySignupCode({ email, code: otp });
      goTo('details');
    } catch (nextError) {
      setError(resolveAuthMessage(nextError, 'Unable to check that code.'));
    } finally {
      setSubmitting(false);
    }
  }

  function saveDetails() {
    const nextError = getSignupDetailsError(form);
    if (nextError) {
      setError(nextError);
      setFieldErrors({
        name: form.name.trim().length < 2 ? 'Enter your name' : '',
        phone: digitsOnly(form.phone).length < PHONE_MIN_DIGITS ? `At least ${PHONE_MIN_DIGITS} digits` : '',
        password: form.password ? '' : 'Required',
        confirmPassword: form.password !== form.confirmPassword ? 'Does not match' : '',
      });
      return;
    }
    goTo('workspace');
  }

  async function createAccount() {
    if (!pendingSignup) {
      startOver();
      return;
    }
    const nextError = getWorkspaceError({
      accountKind: form.accountKind,
      businessName: form.businessName,
      businessType: form.businessType,
    });
    if (nextError) {
      setError(nextError);
      return;
    }

    const workspaceName = isPersonal
      ? form.businessName.trim() || personalWorkspaceName(displayName)
      : form.businessName.trim();

    try {
      setSubmitting(true);
      setError('');
      const result = await register({
        name: displayName,
        email: pendingSignup.email,
        phone: isGoogle ? undefined : form.phone.trim(),
        password: isGoogle ? undefined : form.password,
        businessName: workspaceName,
        businessType: isPersonal ? 'personal' : selectedBusinessType?.apiValue || 'retail',
        signupToken: pendingSignup.signupToken,
      });
      router.replace(result === 'verify-email' ? '/(auth)/verify-email' : '/(app)/(tabs)/home');
    } catch (nextError) {
      const message = resolveAuthMessage(nextError, 'Unable to create the account. Try again.');
      if (/email check has expired/i.test(message)) {
        startOver();
      }
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  const screenCopy: Record<Step, { title: string; subtitle: string; back: string; onBack: () => void }> = {
    email: {
      title: 'Create your account',
      subtitle: 'Start with your email. We will send a code to make sure it is yours.',
      back: 'Back to sign in',
      onBack: () => {
        clearPendingSignup();
        router.replace('/(auth)/login');
      },
    },
    code: {
      title: 'Check your email',
      subtitle: `Enter the ${OTP_LENGTH}-digit code we sent to ${verifiedEmail}.`,
      back: 'Change email',
      onBack: () => goTo('email'),
    },
    details: {
      title: 'Your details',
      subtitle: 'Your email is confirmed. Tell us a little about you.',
      back: 'Start over',
      onBack: startOver,
    },
    workspace: {
      title: 'How will you use PM?',
      subtitle: isPersonal
        ? 'Keep money, people, and notes in one place.'
        : 'Name the business and pick the type that matches your shop.',
      back: isGoogle ? 'Use a different account' : 'Your details',
      onBack: isGoogle ? startOver : () => goTo('details'),
    },
  };
  const copy = screenCopy[step];

  return (
    <AuthScreen
      backLabel={copy.back}
      onBack={copy.onBack}
      title={copy.title}
      subtitle={copy.subtitle}
      footer={
        step === 'email' ? (
          <AuthFooterLink
            prompt="Already have an account?"
            action="Sign in"
            onPress={() => router.replace('/(auth)/login')}
          />
        ) : null
      }>
      {isGoogle ? null : <StepIndicator step={EMAIL_STEPS.indexOf(step) + 1} total={EMAIL_STEPS.length} />}
      {error ? <AuthNotice tone="error" message={error} /> : null}
      {notice && !error ? <AuthNotice tone="success" message={notice} /> : null}

      {step === 'email' ? (
        <>
          {emailTaken ? (
            <View style={styles.linkRow}>
              <AuthInlineLink
                onPress={() => router.replace({ pathname: '/(auth)/login', params: { email: normalizeEmail(email) } })}>
                Sign in instead
              </AuthInlineLink>
              <Text style={[styles.muted, { color: colors.textMuted }]}>·</Text>
              <AuthInlineLink onPress={() => router.push('/(auth)/reset-password')}>Reset password</AuthInlineLink>
            </View>
          ) : null}
          <GoogleSignInButton disabled={submitting} onError={setError} onNeedsSignup={() => goTo('workspace')} />
          {isGoogleSignInAvailable() ? <AuthDivider label={t('auth.orUseEmail')} /> : null}
          <FormField
            label="Email"
            icon="email-outline"
            value={email}
            onChangeText={(value) => {
              setEmail(value);
              setError('');
              setEmailTaken(false);
            }}
            placeholder="you@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="send"
            onSubmitEditing={() => void sendCode()}
          />
          <AuthButton label="Send code" loading={submitting} onPress={() => void sendCode()} />
        </>
      ) : null}

      {step === 'code' ? (
        <>
          <OtpInput
            value={code}
            onChange={(value) => {
              setCode(value);
              setError('');
            }}
            error={Boolean(error)}
            onComplete={(value) => void checkCode(value)}
          />
          <AuthButton
            label="Verify email"
            loading={submitting}
            disabled={code.length !== OTP_LENGTH}
            onPress={() => void checkCode()}
          />
          <View style={styles.linkRow}>
            {resendIn > 0 ? (
              <Text style={[styles.muted, { color: colors.textMuted }]}>
                You can request another code in {resendIn}s
              </Text>
            ) : (
              <>
                <Text style={[styles.muted, { color: colors.textMuted }]}>Didn’t get it?</Text>
                <AuthInlineLink onPress={() => void sendCode()}>Resend code</AuthInlineLink>
              </>
            )}
          </View>
        </>
      ) : null}

      {step === 'details' ? (
        <>
          <AuthNotice tone="success" message={`${verifiedEmail} is verified.`} />
          <FormField
            label="Full name"
            icon="account-outline"
            value={form.name}
            onChangeText={(name) => update('name', name)}
            placeholder="Your name"
            autoCapitalize="words"
            autoComplete="name"
            textContentType="name"
            error={fieldErrors.name}
          />
          <FormField
            label="Phone"
            icon="phone-outline"
            value={form.phone}
            onChangeText={(phone) => update('phone', phone)}
            placeholder="98XXXXXXXX"
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
            error={fieldErrors.phone}
            helperText={phoneHelper}
          />
          <FormField
            label="Password"
            icon="lock-outline"
            value={form.password}
            onChangeText={(password) => update('password', password)}
            placeholder="Create a password"
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            error={fieldErrors.password}
          />
          <PasswordHints password={form.password} />
          <FormField
            label="Confirm password"
            icon="lock-check-outline"
            value={form.confirmPassword}
            onChangeText={(confirmPassword) => update('confirmPassword', confirmPassword)}
            placeholder="Repeat password"
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            error={fieldErrors.confirmPassword}
            returnKeyType="next"
            onSubmitEditing={saveDetails}
          />
          <AuthButton label="Continue" onPress={saveDetails} />
        </>
      ) : null}

      {step === 'workspace' ? (
        <>
          {isGoogle ? <AuthNotice tone="success" message={`Signed in with Google as ${verifiedEmail}.`} /> : null}
          <AccountKindPicker value={form.accountKind} onChange={(accountKind) => update('accountKind', accountKind)} />
          <FormField
            label={isPersonal ? 'Space name' : 'Business name'}
            icon={isPersonal ? 'home-outline' : 'domain'}
            value={form.businessName}
            onChangeText={(businessName) => update('businessName', businessName)}
            placeholder={isPersonal ? personalWorkspaceName(displayName) : 'Shop name'}
            autoCapitalize="words"
            autoComplete="organization"
            textContentType="organizationName"
            helperText={
              isPersonal
                ? 'Optional. We create a free workspace from your name if you leave this blank.'
                : 'This is how invoices and the shop workspace are labeled.'
            }
          />
          {!isPersonal ? (
            <BusinessTypePicker
              options={options}
              value={form.businessType}
              onChange={(businessType) => update('businessType', businessType)}
            />
          ) : null}
          <AuthButton
            label={isPersonal ? 'Start tracking money' : 'Create business'}
            loading={submitting}
            onPress={() => void createAccount()}
          />
        </>
      ) : null}
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  muted: {
    textAlign: 'center',
    fontSize: typography.label,
    lineHeight: 20,
  },
});
