import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/src/shared/feedback/BottomSheet';
import { SearchField } from '@/src/shared/ui/SearchField';
import { usePalette } from '@/src/stores/theme-store';
import { spacing, typography } from '@/src/theme';
import type { AppPalette } from '@/src/theme/app-palette';
import { useThemedStyles } from '@/src/theme/use-themed-styles';
import type { Category } from '@/src/types/models';

interface CategoryFilterSheetProps {
  categories: Category[];
  selectedId: string | undefined;
  visible: boolean;
  onSelect: (id: string | undefined) => void;
  onClose: () => void;
}

export function CategoryFilterSheet({ categories, onClose, onSelect, selectedId, visible }: CategoryFilterSheetProps) {
  const colors = usePalette();
  const styles = useThemedStyles(createStyles);
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query ? categories.filter((category) => category.name.toLowerCase().includes(query)) : categories;
  }, [categories, search]);

  function choose(id: string | undefined) {
    onSelect(id);
    onClose();
  }

  return (
    <BottomSheet visible={visible} title="Filter by category" subtitle="Search all categories set up for this business." onClose={onClose}>
      <SearchField placeholder="Search categories" value={search} onChangeText={setSearch} />
      <View style={styles.list}>
        <FilterRow active={selectedId === undefined} label="All categories" onPress={() => choose(undefined)} />
        <FilterRow active={selectedId === ''} label="Uncategorized" onPress={() => choose('')} />
        {filtered.map((category) => (
          <FilterRow key={category.id} active={selectedId === category.id} label={category.name} onPress={() => choose(category.id)} />
        ))}
        {!filtered.length ? <Text style={[styles.empty, { color: colors.textMuted }]}>No categories match “{search}”.</Text> : null}
      </View>
    </BottomSheet>
  );
}

function FilterRow({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  const colors = usePalette();
  const styles = useThemedStyles(createStyles);
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
      <MaterialCommunityIcons name={active ? 'radiobox-marked' : 'radiobox-blank'} size={22} color={active ? colors.primary : colors.textMuted} />
    </Pressable>
  );
}

const createStyles = (colors: AppPalette) =>
  StyleSheet.create({
    list: { gap: 2 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: 52,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    rowLabel: { flex: 1, fontSize: typography.body, fontWeight: '600' },
    empty: { fontSize: typography.body, paddingVertical: spacing.lg, textAlign: 'center' },
  });
