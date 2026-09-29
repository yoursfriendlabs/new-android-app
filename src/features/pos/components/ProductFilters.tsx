import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { SegmentedTabs } from '@/src/shared/ui/SegmentedTabs';
import { SearchField } from '@/src/shared/ui/SearchField';
import { usePalette } from '@/src/stores/theme-store';
import { radius, spacing } from '@/src/theme';

interface ProductFiltersProps {
  search: string;
  setSearch: (text: string) => void;
  category: string;
  setCategory: (cat: string) => void;
  categoryOptions: string[];
}

export function ProductFilters({
  search,
  setSearch,
  category,
  setCategory,
  categoryOptions,
}: ProductFiltersProps) {
  const colors = usePalette();

  return (
    <View style={[styles.filtersBlock, { borderBottomColor: colors.border }]}>
      <View style={styles.searchRow}>
        <View style={{ flex: 1 }}>
          <SearchField
            placeholder="Search products"
            value={search}
            onChangeText={setSearch}
            containerStyle={[styles.posSearchField, { backgroundColor: colors.surface, borderColor: colors.border }]}
            inputStyle={styles.posSearchInput}
          />
        </View>
        <Pressable
          style={[styles.addItemBtn, { backgroundColor: colors.primary }]}
          onPress={() => router.push('/(app)/inventory')}>
          <MaterialCommunityIcons color={colors.onPrimary} name="plus" size={22} />
        </Pressable>
      </View>

      <SegmentedTabs
        value={category}
        options={categoryOptions.map((option) => ({ label: option, value: option }))}
        onChange={setCategory}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  filtersBlock: {
    padding: spacing.md,
    gap: spacing.sm,
    borderBottomWidth: 1,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  posSearchField: {
    borderWidth: 1,
    borderRadius: radius.md,
  },
  posSearchInput: {
    height: 48,
  },
  addItemBtn: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
