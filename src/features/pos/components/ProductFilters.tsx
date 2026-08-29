import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { SearchField } from '@/src/shared/ui/SearchField';
import { usePalette } from '@/src/stores/theme-store';
import { radius, spacing, typography } from '@/src/theme';

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
            containerStyle={[styles.posSearchField, { backgroundColor: colors.white, borderColor: colors.border }]}
            inputStyle={styles.posSearchInput}
          />
        </View>
        <Pressable
          style={[styles.addItemBtn, { backgroundColor: colors.primary }]}
          onPress={() => router.push('/(app)/inventory')}>
          <MaterialCommunityIcons color={colors.white} name="plus" size={22} />
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoriesScroll}>
        {categoryOptions.map((opt) => {
          const isSelected = category === opt;
          return (
            <Pressable
              key={opt}
              style={[
                styles.catChip,
                { backgroundColor: colors.backgroundAlt, borderColor: colors.border },
                isSelected && { backgroundColor: colors.primary, borderColor: colors.primary },
              ]}
              onPress={() => setCategory(opt)}>
              <Text style={[styles.catChipLabel, { color: isSelected ? colors.white : colors.text }]}>{opt}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
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
  categoriesScroll: {
    gap: spacing.xs,
    paddingVertical: 4,
  },
  catChip: {
    paddingHorizontal: spacing.md,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  catChipLabel: {
    fontSize: typography.label,
    fontWeight: '700',
  },
});
