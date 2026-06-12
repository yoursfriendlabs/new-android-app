import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { StyleSheet, Text, View } from 'react-native';

import { useOnlineStatus } from '@/src/hooks/useOnlineStatus';
import { palette, radius, spacing, typography } from '@/src/theme';

export function SyncPill() {
  const { isOnline, isSyncing, pendingCount } = useOnlineStatus();

  const tone = pendingCount > 0 ? palette.warningSoft : isOnline ? palette.successSoft : palette.dangerSoft;
  const icon = pendingCount > 0 ? 'sync-alert' : isOnline ? 'cloud-check-outline' : 'cloud-off-outline';
  const label =
    pendingCount > 0 ? `${pendingCount} waiting` : isSyncing ? 'Syncing' : isOnline ? 'Synced' : 'Offline';

  return (
    <View style={[styles.pill, { backgroundColor: tone }]}>
      <MaterialCommunityIcons color={palette.text} name={icon} size={16} />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  label: {
    fontSize: typography.caption,
    fontWeight: '700',
    color: palette.text,
  },
});
