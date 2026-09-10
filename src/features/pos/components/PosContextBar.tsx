import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, StyleSheet, View } from 'react-native';

import { partyInitials } from '@/src/features/parties/lib/party';
import { haptics } from '@/src/shared/lib/haptics';
import { Text } from '@/src/shared/ui/Text';
import { usePalette } from '@/src/stores/theme-store';
import { radius, spacing } from '@/src/theme';
import type { AppPalette } from '@/src/theme/app-palette';
import { useThemedStyles } from '@/src/theme/use-themed-styles';

export type PosOrderType = 'takeaway' | 'dine_in' | 'delivery';

interface PosContextBarProps {
  partyName?: string | null;
  onPickParty: () => void;
  /** Cafe workspaces also choose a table or delivery here. */
  showSession?: boolean;
  orderType: PosOrderType;
  sessionLabel?: string;
  onPickSession?: () => void;
}

const SESSION_ICONS = {
  delivery: 'truck-delivery-outline',
  dine_in: 'table-chair',
  takeaway: 'shopping-outline',
} as const;

/** The "who and where" strip under the POS header: customer, and for cafes the table. */
export function PosContextBar({
  onPickParty,
  onPickSession,
  orderType,
  partyName,
  sessionLabel,
  showSession = false,
}: PosContextBarProps) {
  const colors = usePalette();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.bar}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Customer: ${partyName || 'Walk-in'}`}
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        onPress={() => {
          haptics.tapLight();
          onPickParty();
        }}>
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
          <Text variant="label" tone="onPrimary">
            {partyName ? partyInitials(partyName) : 'W'}
          </Text>
        </View>
        <View style={styles.copy}>
          <Text variant="overline" tone="soft">
            Customer
          </Text>
          <Text variant="bodyStrong" numberOfLines={1}>
            {partyName ?? 'Walk-in'}
          </Text>
        </View>
        <MaterialCommunityIcons color={colors.textMuted} name="chevron-down" size={18} />
      </Pressable>

      {showSession && onPickSession ? (
        <>
          <View style={styles.divider} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Order type: ${sessionLabel ?? 'Walk-in'}`}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => {
              haptics.tapLight();
              onPickSession();
            }}>
            <View style={[styles.avatar, { backgroundColor: colors.accentSoft }]}>
              <MaterialCommunityIcons color={colors.primary} name={SESSION_ICONS[orderType]} size={18} />
            </View>
            <View style={styles.copy}>
              <Text variant="overline" tone="soft">
                Order
              </Text>
              <Text variant="bodyStrong" numberOfLines={1}>
                {sessionLabel ?? 'Walk-in'}
              </Text>
            </View>
            <MaterialCommunityIcons color={colors.textMuted} name="chevron-down" size={18} />
          </Pressable>
        </>
      ) : null}
    </View>
  );
}

const createStyles = (colors: AppPalette) =>
  StyleSheet.create({
    bar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    row: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderRadius: radius.sm,
    },
    rowPressed: {
      opacity: 0.7,
    },
    avatar: {
      width: 36,
      height: 36,
      borderRadius: radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    copy: {
      flex: 1,
    },
    divider: {
      width: 1,
      alignSelf: 'stretch',
      backgroundColor: colors.border,
    },
  });
