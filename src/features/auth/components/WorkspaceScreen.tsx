import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { isInvalidSessionError } from '@/src/api/client';
import {
  BusinessTypePicker,
  buildExtraBusinessTypeOptions,
} from '@/src/features/auth/components/WorkspaceTypePicker';
import { getCreateBusinessError, resolveAuthMessage } from '@/src/features/auth/lib/auth';
import { FormField } from '@/src/shared/forms/FormField';
import { Screen } from '@/src/shared/layout/Screen';
import { PageHeading } from '@/src/shared/ui/PageHeading';
import { SurfaceCard } from '@/src/shared/ui/SurfaceCard';
import { useBusinessTypes } from '@/src/shared/hooks/useAppQueries';
import { useAuthStore } from '@/src/stores/auth-store';
import { usePalette } from '@/src/stores/theme-store';
import { radius, spacing, typography } from '@/src/theme';
import { useThemedStyles } from '@/src/theme/use-themed-styles';
import type { AppPalette } from '@/src/theme/app-palette';
import type { WorkspaceMembership } from '@/src/types/models';

function workspaceId(item: WorkspaceMembership) {
  return String(item.businessId ?? item.id);
}

function iconForType(type?: string) {
  if (/personal/i.test(String(type || ''))) return 'wallet-outline' as const;
  if (/cafe|hospitality/i.test(String(type || ''))) return 'coffee-outline' as const;
  return 'storefront-outline' as const;
}

export function WorkspaceScreen() {
  const colors = usePalette();
  const styles = useThemedStyles(createStyles);
  const session = useAuthStore((state) => state.session);
  const businessProfile = useAuthStore((state) => state.businessProfile);
  const storedBusinesses = useAuthStore((state) => state.businesses);
  const canCreateBusiness = useAuthStore((state) => state.canCreateBusiness);
  const switchWorkspace = useAuthStore((state) => state.switchWorkspace);
  const createBusiness = useAuthStore((state) => state.createBusiness);
  const refreshWorkspaces = useAuthStore((state) => state.refreshWorkspaces);
  const { data: businessTypes } = useBusinessTypes();
  const typeOptions = useMemo(() => buildExtraBusinessTypeOptions(businessTypes), [businessTypes]);

  const [name, setName] = useState('');
  const [type, setType] = useState(typeOptions[0]?.value ?? 'retail');
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!typeOptions.length) return;
    if (typeOptions.some((option) => option.value === type)) return;
    setType(typeOptions[0].value);
  }, [type, typeOptions]);

  useEffect(() => {
    let cancelled = false;
    setRefreshing(true);
    void refreshWorkspaces()
      .catch((listError) => {
        if (cancelled || isInvalidSessionError(listError)) return;
        setError(resolveAuthMessage(listError, 'Unable to load workspaces.'));
      })
      .finally(() => {
        if (!cancelled) setRefreshing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshWorkspaces]);

  const currentId = session?.businessId ?? '';
  const items = useMemo(() => {
    if (storedBusinesses.length) return storedBusinesses;
    if (!currentId) return [];
    return [
      {
        id: currentId,
        businessId: currentId,
        name: String(businessProfile?.businessName ?? session?.business?.name ?? 'Current workspace'),
        type: String(businessProfile?.businessType ?? session?.business?.businessType ?? ''),
        label: String(businessProfile?.businessType ?? 'Workspace'),
        role: String(session?.role ?? ''),
        isOwner: true,
        isPersonal: /personal/i.test(String(businessProfile?.businessType ?? '')),
        isActive: true,
      } satisfies WorkspaceMembership,
    ];
  }, [businessProfile, currentId, session?.business, session?.role, storedBusinesses]);

  async function handleSwitch(id: string) {
    if (!id || id === currentId || busyId) return;
    setError('');
    setBusyId(id);
    try {
      await switchWorkspace(id);
      router.replace('/(app)/(tabs)/home');
    } catch (switchError) {
      if (isInvalidSessionError(switchError)) return;
      setError(resolveAuthMessage(switchError, 'Unable to switch workspaces.'));
    } finally {
      setBusyId(null);
    }
  }

  async function handleCreate() {
    const nextError = getCreateBusinessError({ name, type });
    if (nextError) {
      setError(nextError);
      return;
    }
    setError('');
    setCreating(true);
    try {
      await createBusiness({ name: name.trim(), type });
      router.replace('/(app)/(tabs)/home');
    } catch (createError) {
      if (isInvalidSessionError(createError)) return;
      setError(resolveAuthMessage(createError, 'Unable to create the business.'));
    } finally {
      setCreating(false);
    }
  }

  const busy = Boolean(busyId) || creating;

  return (
    <Screen topBarTitle="Workspaces">
      <View style={styles.stack}>
      <PageHeading subtitle="Switch shops or add another business. Each extra shop starts its own trial." />

      {error ? (
        <View style={[styles.message, { backgroundColor: colors.dangerSoft }]}>
          <Text style={[styles.messageText, { color: colors.danger }]}>{error}</Text>
        </View>
      ) : null}

      <SurfaceCard title="Your workspaces" subtitle={refreshing ? 'Updating…' : undefined}>
        {items.map((item, index) => {
          const id = workspaceId(item);
          const active = id === currentId;
          const pending = busyId === id;
          return (
            <Pressable
              key={id}
              disabled={busy}
              onPress={() => void handleSwitch(id)}
              style={({ pressed }) => [
                styles.row,
                index < items.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                pressed && !busy && { opacity: 0.72 },
              ]}>
              <View style={[styles.rowIcon, { backgroundColor: active ? colors.accentSoft : colors.backgroundAlt }]}>
                <MaterialCommunityIcons
                  color={active ? colors.primary : colors.textMuted}
                  name={iconForType(item.type)}
                  size={20}
                />
              </View>
              <View style={styles.rowCopy}>
                <Text style={[styles.rowLabel, { color: colors.text }]}>{item.name}</Text>
                <Text numberOfLines={1} style={[styles.rowSubtitle, { color: colors.textMuted }]}>
                  {item.label}
                  {item.isPersonal ? ' · Personal' : ''}
                  {item.isOwner ? ' · Owner' : ''}
                </Text>
              </View>
              {pending ? (
                <ActivityIndicator color={colors.primary} />
              ) : active ? (
                <MaterialCommunityIcons color={colors.primary} name="check-circle" size={22} />
              ) : (
                <MaterialCommunityIcons color={colors.textSoft} name="chevron-right" size={20} />
              )}
            </Pressable>
          );
        })}
      </SurfaceCard>

      {canCreateBusiness ? (
        <SurfaceCard title="Add a business" subtitle="Standard or Cafe only. Personal stays unique to this account.">
          <View style={styles.create}>
            <FormField
              label="Business name"
              value={name}
              onChangeText={(value) => {
                setName(value);
                setError('');
              }}
              placeholder="Shop name"
              editable={!busy}
            />
            <BusinessTypePicker options={typeOptions} value={type} onChange={setType} />
            <Pressable
              disabled={busy}
              onPress={() => void handleCreate()}
              style={[styles.primaryButton, { backgroundColor: colors.primary, opacity: busy ? 0.7 : 1 }]}>
              {creating ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <Text style={[styles.primaryLabel, { color: colors.onPrimary }]}>Create business</Text>
              )}
            </Pressable>
          </View>
        </SurfaceCard>
      ) : (
        <Text style={[styles.hint, { color: colors.textMuted }]}>
          Only owners can add another shop. Staff stay on the workspace they were invited to.
        </Text>
      )}
      </View>
    </Screen>
  );
}

const createStyles = (colors: AppPalette) =>
  StyleSheet.create({
    stack: {
      gap: spacing.md,
    },
    message: {
      padding: spacing.md,
      borderRadius: radius.sm,
    },
    messageText: {
      fontWeight: '700',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.md,
    },
    rowIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowCopy: {
      flex: 1,
      gap: 2,
    },
    rowLabel: {
      fontSize: typography.body,
      fontWeight: '700',
    },
    rowSubtitle: {
      fontSize: typography.caption,
    },
    create: {
      gap: spacing.md,
      paddingTop: spacing.sm,
    },
    primaryButton: {
      minHeight: 50,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryLabel: {
      fontSize: typography.body,
      fontWeight: '800',
    },
    hint: {
      fontSize: typography.caption,
      lineHeight: 18,
    },
  });
