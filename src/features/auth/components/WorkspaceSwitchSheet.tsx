import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { isInvalidSessionError } from '@/src/api/client';
import { resolveAuthMessage } from '@/src/features/auth/lib/auth';
import { BottomSheet } from '@/src/shared/feedback/BottomSheet';
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

interface WorkspaceSwitchSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function WorkspaceSwitchSheet({ onClose, visible }: WorkspaceSwitchSheetProps) {
  const colors = usePalette();
  const styles = useThemedStyles(createStyles);
  const session = useAuthStore((state) => state.session);
  const businessProfile = useAuthStore((state) => state.businessProfile);
  const storedBusinesses = useAuthStore((state) => state.businesses);
  const switchWorkspace = useAuthStore((state) => state.switchWorkspace);
  const refreshWorkspaces = useAuthStore((state) => state.refreshWorkspaces);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible) return;
    setError('');
    void refreshWorkspaces().catch(() => {});
  }, [refreshWorkspaces, visible]);

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

  async function handleSelect(id: string) {
    if (!id || busyId) return;
    if (id === currentId) {
      onClose();
      return;
    }

    setError('');
    setBusyId(id);
    try {
      await switchWorkspace(id);
      onClose();
    } catch (switchError) {
      if (isInvalidSessionError(switchError)) return;
      setError(resolveAuthMessage(switchError, 'Unable to switch workspaces.'));
    } finally {
      setBusyId(null);
    }
  }

  function handleManage() {
    onClose();
    router.push('/(app)/workspaces' as never);
  }

  return (
    <BottomSheet
      visible={visible}
      heightRatio={0.82}
      title="Switch Workspace"
      subtitle="Select a workspace to switch mode or company"
      onClose={onClose}>
      <View style={styles.container}>
        {error ? (
          <View style={[styles.errorBox, { backgroundColor: colors.dangerSoft }]}>
            <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.list}>
          {items.map((item, index) => {
            const id = workspaceId(item);
            const active = id === currentId;
            const isBusy = busyId === id;

            return (
              <Pressable
                key={id}
                disabled={Boolean(busyId)}
                onPress={() => void handleSelect(id)}
                style={({ pressed }) => [
                  styles.itemRow,
                  {
                    backgroundColor: active ? colors.accentSoft : colors.surface,
                    borderColor: active ? colors.primary : colors.border,
                  },
                  pressed && !busyId && { opacity: 0.72 },
                ]}>
                <View
                  style={[
                    styles.itemIconWrap,
                    {
                      backgroundColor: active ? colors.primary : colors.backgroundAlt,
                    },
                  ]}>
                  <MaterialCommunityIcons
                    name={iconForType(item.type)}
                    size={22}
                    color={active ? colors.onPrimary : colors.text}
                  />
                </View>

                <View style={styles.itemCopy}>
                  <View style={styles.itemNameRow}>
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.itemName,
                        { color: colors.text, fontWeight: active ? '800' : '700' },
                      ]}>
                      {item.name}
                    </Text>
                    {active ? (
                      <View style={[styles.activeBadge, { backgroundColor: colors.primary }]}>
                        <Text style={[styles.activeBadgeText, { color: colors.onPrimary }]}>Active</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text numberOfLines={1} style={[styles.itemSubtitle, { color: colors.textMuted }]}>
                    {item.label}
                    {item.isPersonal
                      ? ' · Personal mode'
                      : item.isOwner || item.role === 'owner'
                        ? ' · Owner'
                        : ` · Staff (${item.role || 'Member'})`}
                  </Text>
                </View>

                {isBusy ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : active ? (
                  <MaterialCommunityIcons name="check-circle" size={22} color={colors.primary} />
                ) : (
                  <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textSoft} />
                )}
              </Pressable>
            );
          })}
        </View>

        <Pressable
          onPress={handleManage}
          style={({ pressed }) => [
            styles.manageButton,
            { backgroundColor: colors.backgroundAlt, borderColor: colors.border },
            pressed && { opacity: 0.75 },
          ]}>
          <MaterialCommunityIcons name="cog-outline" size={20} color={colors.text} />
          <Text style={[styles.manageText, { color: colors.text }]}>Add or manage workspaces</Text>
          <MaterialCommunityIcons name="chevron-right" size={18} color={colors.textSoft} />
        </Pressable>
      </View>
    </BottomSheet>
  );
}

const createStyles = (colors: AppPalette) =>
  StyleSheet.create({
    container: {
      gap: spacing.md,
      paddingBottom: spacing.sm,
    },
    errorBox: {
      padding: spacing.sm,
      borderRadius: radius.sm,
    },
    errorText: {
      fontSize: typography.caption,
      fontWeight: '700',
    },
    list: {
      gap: spacing.xs,
    },
    itemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1.5,
    },
    itemIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    itemCopy: {
      flex: 1,
      gap: 3,
    },
    itemNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    itemName: {
      fontSize: typography.body,
      flexShrink: 1,
    },
    activeBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: radius.pill,
    },
    activeBadgeText: {
      fontSize: 10,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    itemSubtitle: {
      fontSize: typography.caption,
    },
    manageButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      marginTop: spacing.xs,
    },
    manageText: {
      fontSize: typography.label,
      fontWeight: '700',
      flex: 1,
      textAlign: 'left',
      marginLeft: spacing.xs,
    },
  });
