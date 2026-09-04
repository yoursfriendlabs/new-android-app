import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { FlashList } from '@shopify/flash-list';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/src/shared/feedback/BottomSheet';
import { SearchField } from '@/src/shared/ui/SearchField';
import { formatCurrency } from '@/src/shared/lib/format';
import { getPartyBalanceMeta } from '@/src/features/parties/lib/party';
import { usePalette } from '@/src/stores/theme-store';
import { spacing, typography } from '@/src/theme';
import type { Party } from '@/src/types/models';

interface PartyPickerSheetProps {
  visible: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  parties: Party[];
  onPick: (party: Party | null) => void;
  onClose: () => void;
  allowWalkIn?: boolean;
  walkInLabel?: string;
  walkInSubtitle?: string;
  title?: string;
  subtitle?: string;
  createLabel?: string;
  onCreatePress?: () => void;
  phoneImportLabel?: string;
  onPhoneImportPress?: () => void;
  typeLabel?: (party: Party) => string;
}

export function PartyPickerSheet({
  allowWalkIn = true,
  createLabel,
  onClose,
  onCreatePress,
  onPhoneImportPress,
  onPick,
  onSearchChange,
  parties,
  phoneImportLabel,
  search,
  subtitle,
  title,
  typeLabel,
  walkInLabel,
  walkInSubtitle,
  visible,
}: PartyPickerSheetProps) {
  const colors = usePalette();

  return (
    <BottomSheet
      visible={visible}
      title={title ?? 'Select party'}
      subtitle={subtitle ?? 'Instant search, or continue with walk-in.'}
      onClose={onClose}
      fullHeight>
      <SearchField
        placeholder="Search name or phone"
        value={search}
        onChangeText={onSearchChange}
        containerStyle={[styles.searchField, { borderColor: colors.primary }]}
        inputStyle={styles.searchInput}
      />
      {onCreatePress ? (
        <Pressable style={[styles.walkInRow, { borderBottomColor: colors.border }]} onPress={onCreatePress}>
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            <MaterialCommunityIcons color={colors.white} name="account-plus-outline" size={22} />
          </View>
          <View style={styles.partyMeta}>
            <Text style={[styles.partyName, { color: colors.text }]}>{createLabel ?? 'New contact'}</Text>
            <Text style={[styles.partyInfo, { color: colors.textMuted }]}>Type a name and save in seconds</Text>
          </View>
        </Pressable>
      ) : null}
      {onPhoneImportPress ? (
        <Pressable style={[styles.walkInRow, { borderBottomColor: colors.border }]} onPress={onPhoneImportPress}>
          <View style={[styles.avatar, { backgroundColor: colors.info }]}>
            <MaterialCommunityIcons color={colors.white} name="cellphone" size={22} />
          </View>
          <View style={styles.partyMeta}>
            <Text style={[styles.partyName, { color: colors.text }]}>{phoneImportLabel ?? 'From phone contacts'}</Text>
            <Text style={[styles.partyInfo, { color: colors.textMuted }]}>Choose someone already in your phone</Text>
          </View>
        </Pressable>
      ) : null}
      {allowWalkIn ? (
        <Pressable style={[styles.walkInRow, { borderBottomColor: colors.border }]} onPress={() => onPick(null)}>
          <View style={[styles.avatar, { backgroundColor: colors.success }]}>
            <MaterialCommunityIcons color={colors.white} name="cash" size={22} />
          </View>
          <View style={styles.partyMeta}>
            <Text style={[styles.partyName, { color: colors.text }]}>{walkInLabel ?? 'Cash Sale'}</Text>
            <Text style={[styles.partyInfo, { color: colors.textMuted }]}>
              {walkInSubtitle ?? 'No account tracking on this sale'}
            </Text>
          </View>
        </Pressable>
      ) : null}
      <FlashList
        data={parties}
        renderItem={({ item }) => {
          const meta = getPartyBalanceMeta(item);
          return (
            <Pressable
              style={[styles.partyRow, { borderBottomColor: colors.border }]}
              onPress={() => onPick(item)}>
              <View style={styles.partyLead}>
                <View style={[styles.avatar, { backgroundColor: colors.surfaceMuted }]}>
                  <Text style={[styles.avatarLabel, { color: colors.text }]}>
                    {item.name
                      .split(' ')
                      .map((part) => part[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase()}
                  </Text>
                </View>
                <View style={styles.partyMeta}>
                  <Text style={[styles.partyName, { color: colors.text }]}>{item.name}</Text>
                  <Text style={[styles.partyInfo, { color: colors.textMuted }]}>
                    {typeLabel ? typeLabel(item) : item.type || 'Customer'}
                  </Text>
                </View>
              </View>
              <View style={styles.balanceWrap}>
                <Text
                  style={[
                    styles.balanceAmount,
                    {
                      color:
                        meta.tone === 'pay'
                          ? colors.danger
                          : meta.tone === 'receive'
                            ? colors.success
                            : colors.textMuted,
                    },
                  ]}>
                  {formatCurrency(meta.absoluteAmount)}
                </Text>
                <Text style={[styles.balanceType, { color: colors.textMuted }]}>
                  {meta.label}
                </Text>
              </View>
            </Pressable>
          );
        }}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  searchField: {
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
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
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
  },
  partyName: {
    fontSize: typography.subheading,
    fontWeight: '700',
  },
  partyInfo: {
    fontSize: typography.body,
  },
  balanceWrap: {
    alignItems: 'flex-end',
    gap: 2,
  },
  balanceAmount: {
    fontSize: typography.subheading,
    fontWeight: '700',
  },
  balanceType: {
    fontSize: typography.body,
  },
});
