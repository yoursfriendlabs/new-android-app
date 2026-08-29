import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/src/shared/feedback/BottomSheet';
import { SearchField } from '@/src/shared/ui/SearchField';
import { loadDeviceContacts, type DeviceContactDraft } from '@/src/features/parties/lib/device-contacts';
import { partyInitials } from '@/src/features/parties/lib/party';
import { usePalette } from '@/src/stores/theme-store';
import { spacing, typography } from '@/src/theme';

interface DeviceContactSheetProps {
  visible: boolean;
  onClose: () => void;
  onPick: (contact: DeviceContactDraft) => void;
}

export function DeviceContactSheet({ onClose, onPick, visible }: DeviceContactSheetProps) {
  const colors = usePalette();
  const [search, setSearch] = useState('');
  const [contacts, setContacts] = useState<DeviceContactDraft[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) {
      setSearch('');
      return;
    }
    let cancelled = false;
    setLoading(true);
    void loadDeviceContacts()
      .then((items) => {
        if (!cancelled) setContacts(items);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const visibleContacts = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return contacts;
    return contacts.filter((item) =>
      [item.name, item.phone, item.email].some((value) => String(value || '').toLowerCase().includes(query)),
    );
  }, [contacts, search]);

  return (
    <BottomSheet
      visible={visible}
      title="Phone contacts"
      subtitle="Pick someone to save in your PasalManager contacts."
      onClose={onClose}
      fullHeight>
      <SearchField placeholder="Search name or number" value={search} onChangeText={setSearch} />
      {loading ? (
        <View style={styles.empty}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : null}
      {!loading && !visibleContacts.length ? (
        <Text style={[styles.emptyCopy, { color: colors.textMuted }]}>
          {contacts.length ? 'No matching contacts.' : 'No phone contacts are available yet.'}
        </Text>
      ) : null}
      {visibleContacts.map((item) => (
        <Pressable
          key={`${item.name}-${item.phone ?? ''}`}
          style={[styles.row, { borderBottomColor: colors.border }]}
          onPress={() => {
            onPick(item);
            onClose();
          }}>
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            <Text style={[styles.avatarText, { color: colors.white }]}>{partyInitials(item.name)}</Text>
          </View>
          <View style={styles.copy}>
            <Text style={[styles.name, { color: colors.text }]}>{item.name}</Text>
            <Text style={[styles.meta, { color: colors.textMuted }]}>
              {[item.phone, item.email].filter(Boolean).join('  ·  ') || 'No phone number'}
            </Text>
          </View>
        </Pressable>
      ))}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  empty: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  emptyCopy: {
    paddingVertical: spacing.lg,
    fontSize: typography.body,
    lineHeight: 22,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: typography.body,
    fontWeight: '800',
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: typography.body,
    fontWeight: '700',
  },
  meta: {
    fontSize: typography.label,
  },
});
