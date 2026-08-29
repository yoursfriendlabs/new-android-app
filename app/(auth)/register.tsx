import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';

import {
  AuthButton,
  AuthFooterLink,
  AuthNotice,
  PasswordHints,
  StepIndicator,
} from '@/src/features/auth/components/AuthControls';
import { AuthScreen } from '@/src/features/auth/components/AuthScreen';
import {
  AccountKindPicker,
  BusinessTypePicker,
  buildBusinessTypeOptions,
  type AccountKind,
} from '@/src/features/auth/components/WorkspaceTypePicker';
import { FormField } from '@/src/shared/forms/FormField';
import { useBusinessTypes } from '@/src/shared/hooks/useAppQueries';
import {
  digitsOnly,
  getRegisterAccountError,
  getWorkspaceError,
  PHONE_MIN_DIGITS,
  resolveAuthMessage,
} from '@/src/features/auth/lib/auth';
import { personalWorkspaceName } from '@/src/shared/lib/workspace';
import { useAuthStore } from '@/src/stores/auth-store';

export default function RegisterScreen() {
  const register = useAuthStore((state) => state.register);
  const { data: businessTypes } = useBusinessTypes();
  const options = useMemo(() => buildBusinessTypeOptions(businessTypes), [businessTypes]);
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    businessName: '',
    accountKind: 'personal' as AccountKind,
    businessType: options[0]?.value ?? 'retail',
  });
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

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

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setError('');
    setFieldErrors((current) => ({ ...current, [key]: '' }));
  }

  function handleContinue() {
    const nextError = getRegisterAccountError(form);
    if (nextError) {
      setError(nextError);
      setFieldErrors({
        name: form.name.trim().length < 2 ? 'Enter your name' : '',
        email: form.email ? '' : 'Required',
        phone: digitsOnly(form.phone).length < PHONE_MIN_DIGITS ? `At least ${PHONE_MIN_DIGITS} digits` : '',
        password: form.password ? '' : 'Required',
        confirmPassword: form.password !== form.confirmPassword ? 'Does not match' : '',
      });
      return;
    }
    setError('');
    setFieldErrors({});
    setStep(2);
  }

  async function handleRegister() {
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
      ? form.businessName.trim() || personalWorkspaceName(form.name)
      : form.businessName.trim();

    try {
      setSubmitting(true);
      setError('');
      const result = await register({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        password: form.password,
        businessName: workspaceName,
        businessType: isPersonal ? 'personal' : selectedBusinessType?.apiValue || 'retail',
      });
      router.replace(result === 'verify-email' ? '/(auth)/verify-email' : '/(app)/(tabs)/home');
    } catch (nextError) {
      setError(resolveAuthMessage(nextError, 'Unable to create the account. Try again.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthScreen
      backLabel={step === 2 ? 'Account details' : 'Back to sign in'}
      onBack={step === 2 ? () => setStep(1) : () => router.replace('/(auth)/login')}
      title={step === 1 ? 'Create your account' : 'How will you use PasalManager?'}
      subtitle={
        step === 1
          ? 'Personal books for home, or a full workspace for your shop.'
          : isPersonal
            ? 'Keep money, people, and notes in one place.'
            : 'Name the business and pick the type that matches your shop.'
      }
      footer={
        step === 1 ? (
          <AuthFooterLink
            prompt="Already have an account?"
            action="Sign in"
            onPress={() => router.replace('/(auth)/login')}
          />
        ) : null
      }>
      <StepIndicator step={step} total={2} />
      {error ? <AuthNotice tone="error" message={error} /> : null}

      {step === 1 ? (
        <>
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
            label="Email"
            icon="email-outline"
            value={form.email}
            onChangeText={(email) => update('email', email)}
            placeholder="you@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            error={fieldErrors.email}
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
            onSubmitEditing={handleContinue}
          />
          <AuthButton label="Continue" onPress={handleContinue} />
        </>
      ) : (
        <>
          <AccountKindPicker value={form.accountKind} onChange={(accountKind) => update('accountKind', accountKind)} />
          <FormField
            label={isPersonal ? 'Space name' : 'Business name'}
            icon={isPersonal ? 'home-outline' : 'domain'}
            value={form.businessName}
            onChangeText={(businessName) => update('businessName', businessName)}
            placeholder={
              isPersonal
                ? form.name.trim()
                  ? personalWorkspaceName(form.name)
                  : "Your name's workspace"
                : 'Shop name'
            }
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
            onPress={() => void handleRegister()}
          />
        </>
      )}
    </AuthScreen>
  );
}
