import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { SearchField } from '@/src/components/ui/SearchField';
import { palette, radius, spacing, typography } from '@/src/theme';

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
  return (
    <View style={styles.filtersBlock}>
      <View style={styles.searchRow}>
        <View style={{ flex: 1 }}>
          <SearchField
            placeholder="Search Items..."
            value={search}
            onChangeText={setSearch}
            containerStyle={styles.posSearchField}
            inputStyle={styles.posSearchInput}
          />
        </View>
        <Pressable style={styles.addItemBtn} onPress={() => router.push('/(app)/inventory')}>
          <MaterialCommunityIcons color={palette.white} name="plus" size={22} />
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
              style={[styles.catChip, isSelected && styles.catChipActive]}
              onPress={() => setCategory(opt)}>
              <Text style={[styles.catChipLabel, isSelected && styles.catChipLabelActive]}>
                {opt}
              </Text>
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
    borderBottomColor: palette.border,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  posSearchField: {
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.md,
  },
  posSearchInput: {
    height: 48,
  },
  addItemBtn: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: palette.primary,
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
    backgroundColor: palette.backgroundAlt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.border,
  },
  catChipActive: {
    backgroundColor: palette.accent,
    borderColor: palette.accent,
  },
  catChipLabel: {
    fontSize: typography.label,
    fontWeight: '700',
    color: palette.text,
  },
  catChipLabelActive: {
    color: palette.white,
  },
});
