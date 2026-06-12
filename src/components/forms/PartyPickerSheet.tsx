import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { FlashList } from '@shopify/flash-list';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/src/components/feedback/BottomSheet';
import { SearchField } from '@/src/components/ui/SearchField';
import { formatCurrency } from '@/src/lib/format';
import { palette, spacing, typography } from '@/src/theme';
import type { Party } from '@/src/types/models';

interface PartyPickerSheetProps {
  visible: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  parties: Party[];
  onPick: (party: Party | null) => void;
  onClose: () => void;
  allowWalkIn?: boolean;
  title?: string;
  subtitle?: string;
}

export function PartyPickerSheet({
  allowWalkIn = true,
  onClose,
  onPick,
  onSearchChange,
  parties,
  search,
  subtitle,
  title,
  visible,
}: PartyPickerSheetProps) {
  return (
    <BottomSheet
      visible={visible}
      title={title ?? 'Select party'}
      subtitle={subtitle ?? 'Instant search, or continue with walk-in.'}
      onClose={onClose}
      fullHeight>
      <SearchField
        placeholder="Enter party name..."
        value={search}
        onChangeText={onSearchChange}
        containerStyle={styles.searchField}
        inputStyle={styles.searchInput}
      />
      {allowWalkIn ? (
        <Pressable style={styles.walkInRow} onPress={() => onPick(null)}>
          <View style={[styles.avatar, styles.walkInAvatar]}>
            <MaterialCommunityIcons color={palette.white} name="cash" size={22} />
          </View>
          <View style={styles.partyMeta}>
            <Text style={styles.partyName}>Cash Sale</Text>
            <Text style={styles.partyInfo}>No account tracking on this sale</Text>
          </View>
        </Pressable>
      ) : null}
      <FlashList
        data={parties}
        renderItem={({ item }) => (
          <Pressable style={styles.partyRow} onPress={() => onPick(item)}>
            <View style={styles.partyLead}>
              <View style={styles.avatar}>
                <Text style={styles.avatarLabel}>
                  {item.name
                    .split(' ')
                    .map((part) => part[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase()}
                </Text>
              </View>
              <View style={styles.partyMeta}>
                <Text style={styles.partyName}>{item.name}</Text>
                <Text style={styles.partyInfo}>{item.type || 'Customer'}</Text>
              </View>
            </View>
            <View style={styles.balanceWrap}>
              <Text
                style={[
                  styles.balanceAmount,
                  (item.giveBalance ?? 0) > 0 ? styles.balanceGive : styles.balanceReceive,
                ]}>
                {formatCurrency(item.receiveBalance ?? item.giveBalance ?? item.balance ?? 0)}
              </Text>
              <Text style={styles.balanceType}>
                {(item.receiveBalance ?? 0) > 0 ? 'To receive' : (item.giveBalance ?? 0) > 0 ? 'To give' : 'Clear'}
              </Text>
            </View>
          </Pressable>
        )}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  searchField: {
    borderColor: palette.success,
    borderWidth: 1.5,
  },
  searchInput: {
    fontSize: 17,
  },
  walkInRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surfaceMuted,
  },
  walkInAvatar: {
    backgroundColor: palette.success,
  },
  list: {
    paddingBottom: spacing.xxl,
  },
  partyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  partyLead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  partyMeta: {
    gap: spacing.xxs,
  },
  avatarLabel: {
    fontSize: typography.subheading,
    fontWeight: '800',
    color: palette.text,
  },
  partyName: {
    fontSize: typography.subheading,
    fontWeight: '700',
    color: palette.text,
  },
  partyInfo: {
    fontSize: typography.body,
    color: palette.textMuted,
  },
  balanceWrap: {
    alignItems: 'flex-end',
    gap: 2,
  },
  balanceAmount: {
    fontSize: typography.subheading,
    fontWeight: '700',
  },
  balanceReceive: {
    color: palette.success,
  },
  balanceGive: {
    color: palette.danger,
  },
  balanceType: {
    fontSize: typography.body,
    color: palette.textMuted,
  },
});
