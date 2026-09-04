import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AuthButton, AuthFooterLink, AuthInlineLink, AuthNotice } from '@/src/features/auth/components/AuthControls';
import { AuthScreen } from '@/src/features/auth/components/AuthScreen';
import { FormField } from '@/src/shared/forms/FormField';
import { getLoginError, resolveAuthMessage } from '@/src/features/auth/lib/auth';
import { useAuthStore } from '@/src/stores/auth-store';
import { useTranslation } from '@/src/i18n';

export default function LoginScreen() {
  const { t } = useTranslation();
  const login = useAuthStore((state) => state.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleLogin() {
    const nextError = getLoginError(email, password);
    if (nextError) {
      setError(nextError);
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      const result = await login({ email, password });
      router.replace(result === 'verify-email' ? '/(auth)/verify-email' : '/(app)/(tabs)/home');
    } catch (nextError) {
      setError(resolveAuthMessage(nextError, 'Unable to sign in. Check your details and try again.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthScreen
      centered
      title={t('auth.welcomeBack')}
      subtitle={t('auth.enterCredentials')}
      footer={
        <AuthFooterLink
          prompt="New to PasalManager?"
          action={t('auth.register')}
          onPress={() => router.push('/(auth)/register')}
        />
      }>
      {error ? <AuthNotice tone="error" message={error} /> : null}

      <FormField
        label={t('auth.email')}
        icon="email-outline"
        value={email}
        onChangeText={(value) => {
          setEmail(value);
          if (error) setError('');
        }}
        placeholder="you@email.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="next"
      />

      <View>
        <FormField
          label={t('auth.password')}
          icon="lock-outline"
          value={password}
          onChangeText={(value) => {
            setPassword(value);
            if (error) setError('');
          }}
          placeholder="••••••••"
          secureTextEntry
          autoCapitalize="none"
          autoComplete="password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={() => void handleLogin()}
        />
        <View style={styles.forgotRow}>
          <AuthInlineLink onPress={() => router.push('/(auth)/reset-password')}>{t('auth.forgotPassword')}</AuthInlineLink>
        </View>
      </View>

      <AuthButton label={t('auth.login')} loading={submitting} onPress={() => void handleLogin()} />
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  forgotRow: {
    alignItems: 'flex-end',
    marginTop: 8,
  },
});
