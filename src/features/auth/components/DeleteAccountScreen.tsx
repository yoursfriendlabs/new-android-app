import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';

import { authApi } from '@/src/api';
import { useTranslation } from '@/src/i18n';
import { useConfirm } from '@/src/shared/feedback/ConfirmProvider';
import { useToast } from '@/src/shared/feedback/ToastProvider';
import { FormField } from '@/src/shared/forms/FormField';
import { Screen } from '@/src/shared/layout/Screen';
import { SkeletonList } from '@/src/shared/ui/Skeleton';
import { SurfaceCard } from '@/src/shared/ui/SurfaceCard';
import { Text } from '@/src/shared/ui/Text';
import { useAuthStore } from '@/src/stores/auth-store';
import { usePalette } from '@/src/stores/theme-store';
import { radius, spacing } from '@/src/theme';
import { useThemedStyles } from '@/src/theme/use-themed-styles';
import type { AppPalette } from '@/src/theme/app-palette';

const CONFIRM_WORD = 'DELETE';

export function DeleteAccountScreen() {
  const colors = usePalette();
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();
  const confirm = useConfirm();
  const toast = useToast();
  const deleteAccount = useAuthStore((state) => state.deleteAccount);
  const [password, setPassword] = useState('');
  const [typed, setTyped] = useState('');
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const planQuery = useQuery({
    queryKey: ['account-deletion-plan'],
    queryFn: () => authApi.accountDeletionPlan(),
    staleTime: 0,
  });
  const workspaces = planQuery.data?.workspaces ?? [];
  const canSubmit = password.length > 0 && typed.trim().toUpperCase() === CONFIRM_WORD && !deleting && planQuery.isSuccess && !planQuery.isFetching;

  async function handleDelete() {
    if (!canSubmit) return;
    if (!password) {
      setError(t('deleteAccount.passwordRequired'));
      return;
    }
    const ok = await confirm({
      title: t('deleteAccount.confirmTitle'),
      message: t('deleteAccount.confirmMessage'),
      confirmLabel: t('deleteAccount.submit'),
      destructive: true,
    });
    if (!ok) return;

    try {
      setDeleting(true);
      setError('');
      await deleteAccount(password);
      toast.success(t('deleteAccount.done'));
      router.replace('/(auth)/login');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
      setDeleting(false);
    }
  }

  return (
    <Screen topBarTitle={t('deleteAccount.title')}>
      <SurfaceCard>
        <View style={styles.warning}>
          <MaterialCommunityIcons name="alert-octagon-outline" size={22} color={colors.danger} />
          <Text variant="bodyStrong" tone="danger" style={styles.flex}>
            {t('deleteAccount.intro')}
          </Text>
        </View>
        <Text variant="subheading">{t('deleteAccount.whatHappens')}</Text>
        <Bullet text={t('deleteAccount.accountErased')} />
        <Bullet text={t('deleteAccount.notesErased')} />
      </SurfaceCard>

      <SurfaceCard title={t('deleteAccount.workspacesTitle')}>
        {planQuery.isLoading ? (
          <SkeletonList count={2} trailing={false} />
        ) : planQuery.isError ? (
          <Pressable onPress={() => void planQuery.refetch()}><Text tone="muted">{t('deleteAccount.loadError')} · {t('common.refresh')}</Text></Pressable>
        ) : (
          workspaces.map((workspace) => {
            const removed = workspace.outcome === 'delete';
            return (
              <View key={workspace.id} style={styles.workspaceRow}>
                <MaterialCommunityIcons
                  name={removed ? 'trash-can-outline' : 'logout-variant'}
                  size={20}
                  color={removed ? colors.danger : colors.textMuted}
                />
                <View style={styles.flex}>
                  <Text variant="bodyStrong">{workspace.name}</Text>
                  <Text variant="caption" tone={removed ? 'danger' : 'muted'}>
                    {removed ? t('deleteAccount.workspaceDelete') : t('deleteAccount.workspaceLeave')}
                  </Text>
                  {removed && workspace.staffCount > 0 ? (
                    <Text variant="caption" tone="muted">
                      {t('deleteAccount.staffLoseAccess', { count: workspace.staffCount })}
                    </Text>
                  ) : null}
                </View>
              </View>
            );
          })
        )}
        <Text variant="caption" tone="muted">{t('deleteAccount.exportHint')}</Text>
      </SurfaceCard>

      <SurfaceCard>
        <FormField
          label={t('deleteAccount.passwordLabel')}
          value={password}
          onChangeText={(value) => {
            setPassword(value);
            setError('');
          }}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="current-password"
          textContentType="password"
        />
        <FormField
          label={t('deleteAccount.typeConfirm')}
          value={typed}
          onChangeText={setTyped}
          placeholder={CONFIRM_WORD}
          autoCapitalize="characters"
          error={error || undefined}
        />
        <Pressable
          style={[styles.deleteButton, !canSubmit && styles.disabled]}
          onPress={() => void handleDelete()}
          disabled={!canSubmit}
          accessibilityRole="button">
          {deleting ? (
            <ActivityIndicator color={colors.onDanger} />
          ) : (
            <Text variant="bodyStrong" color={colors.onDanger}>
              {t('deleteAccount.submit')}
            </Text>
          )}
        </Pressable>
      </SurfaceCard>
    </Screen>
  );
}

function Bullet({ text }: { text: string }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.bullet}>
      <Text tone="muted">•</Text>
      <Text tone="muted" style={styles.flex}>
        {text}
      </Text>
    </View>
  );
}

const createStyles = (colors: AppPalette) =>
  StyleSheet.create({
    flex: { flex: 1 },
    warning: {
      flexDirection: 'row',
      gap: spacing.sm,
      alignItems: 'center',
      padding: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.dangerSoft,
    },
    bullet: { flexDirection: 'row', gap: spacing.sm },
    workspaceRow: {
      flexDirection: 'row',
      gap: spacing.md,
      alignItems: 'flex-start',
      paddingVertical: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    deleteButton: {
      minHeight: 52,
      borderRadius: radius.md,
      backgroundColor: colors.danger,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: spacing.sm,
    },
    disabled: { opacity: 0.5 },
  });
