import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { quickExpensesApi } from '@/src/api';
import { BottomSheet } from '@/src/shared/feedback/BottomSheet';
import { FormField } from '@/src/shared/forms/FormField';
import { Screen } from '@/src/shared/layout/Screen';
import { SearchField } from '@/src/shared/ui/SearchField';
import { StickyActionBar } from '@/src/shared/ui/StickyActionBar';
import { useQuickExpenses } from '@/src/shared/hooks/useAppQueries';
import { useDebouncedValue } from '@/src/shared/hooks/useDebouncedValue';
import { expenseCategoryIcon } from '@/src/features/money/lib/expense';
import { radius, shadows, spacing, typography } from '@/src/theme';
import type { QuickExpense } from '@/src/types/models';
import { usePalette } from '@/src/stores/theme-store';
import { useThemedStyles } from '@/src/theme/use-themed-styles';
import type { AppPalette } from '@/src/theme/app-palette';

export default function ExpenseCategoriesScreen() {
  const colors = usePalette();
  const styles = useThemedStyles(createStyles);
  const queryClient = useQueryClient();
  const categoriesQuery = useQuickExpenses();
  const categories = categoriesQuery.data ?? [];
  const [search, setSearch] = useState('');
  const [createName, setCreateName] = useState('');
  const [createVisible, setCreateVisible] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editingCategory, setEditingCategory] = useState<QuickExpense | null>(null);
  const [editName, setEditName] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const debouncedSearch = useDebouncedValue(search);

  const visibleCategories = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    if (!query) return categories;
    return categories.filter((category) => category.name.toLowerCase().includes(query));
  }, [categories, debouncedSearch]);

  async function handleAddCategory() {
    const name = createName.trim();
    if (!name) {
      Alert.alert('Name required', 'Enter a category name.');
      return;
    }

    try {
      setAdding(true);
      await quickExpensesApi.create({ name });
      await queryClient.invalidateQueries({ queryKey: ['quick-expenses'] });
      setCreateName('');
      setCreateVisible(false);
    } catch (error) {
      Alert.alert('Unable to create', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setAdding(false);
    }
  }

  function startEdit(category: QuickExpense) {
    setEditingCategory(category);
    setEditName(category.name);
  }

  async function handleSaveEdit() {
    if (!editingCategory) return;
    const name = editName.trim();
    if (!name) {
      Alert.alert('Name required', 'Category name cannot be empty.');
      return;
    }

    try {
      setSavingEdit(true);
      await quickExpensesApi.update(editingCategory.id, { name });
      await queryClient.invalidateQueries({ queryKey: ['quick-expenses'] });
      setEditingCategory(null);
    } catch (error) {
      Alert.alert('Unable to update', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSavingEdit(false);
    }
  }

  function confirmDelete(category: QuickExpense) {
    Alert.alert('Delete this category?', `"${category.name}" will be removed from quick labels.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await quickExpensesApi.remove(category.id);
            await queryClient.invalidateQueries({ queryKey: ['quick-expenses'] });
          } catch (error) {
            Alert.alert('Unable to delete', error instanceof Error ? error.message : 'Please try again.');
          }
        },
      },
    ]);
  }

  return (
    <Screen
      scrollable={false}
      padded={false}
      topBarTitle="Categories"
      footer={<StickyActionBar primary={{ label: 'New category', onPress: () => setCreateVisible(true) }} />}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={categoriesQuery.isRefetching} onRefresh={() => void categoriesQuery.refetch()} />
        }>
        <View style={styles.hero}>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Labels like rent, tea, and fuel, used when you add a new expense.
          </Text>
        </View>

        <SearchField placeholder="Search categories" value={search} onChangeText={setSearch} />

        {categoriesQuery.isLoading && !categories.length ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
        ) : null}

        {!categoriesQuery.isLoading && !visibleCategories.length ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.accentSoft }]}>
              <MaterialCommunityIcons name="shape-outline" size={28} color={colors.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {categories.length ? 'No matching categories' : 'No categories yet'}
            </Text>
            <Text style={[styles.emptyCopy, { color: colors.textMuted }]}>
              {categories.length
                ? 'Try a different search.'
                : 'Add a few labels so recording expenses is a one-tap choice.'}
            </Text>
          </View>
        ) : null}

        <View style={styles.list}>
          {visibleCategories.map((category) => (
            <View
              key={category.id}
              style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.avatar, { backgroundColor: colors.accentSoft }]}>
                <MaterialCommunityIcons name={expenseCategoryIcon(category.name)} size={20} color={colors.primary} />
              </View>
              <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
                {category.name}
              </Text>
              <Pressable style={styles.iconBtn} onPress={() => startEdit(category)}>
                <MaterialCommunityIcons color={colors.textMuted} name="pencil-outline" size={20} />
              </Pressable>
              <Pressable style={styles.iconBtn} onPress={() => confirmDelete(category)}>
                <MaterialCommunityIcons color={colors.danger} name="trash-can-outline" size={20} />
              </Pressable>
            </View>
          ))}
        </View>
      </ScrollView>

      <BottomSheet
        visible={createVisible}
        title="New category"
        subtitle="This label appears as a chip when recording an expense."
        onClose={() => setCreateVisible(false)}
        footer={
          <Pressable
            style={styles.primaryButton}
            onPress={() => void handleAddCategory()}
            disabled={adding || !createName.trim()}>
            {adding ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.primaryLabel}>Create category</Text>
            )}
          </Pressable>
        }>
        <FormField
          label="Name"
          value={createName}
          placeholder="e.g. Rent, Utilities, Tea"
          onChangeText={setCreateName}
        />
      </BottomSheet>

      <BottomSheet
        visible={Boolean(editingCategory)}
        title="Rename category"
        subtitle={editingCategory ? `Currently “${editingCategory.name}”.` : ''}
        onClose={() => setEditingCategory(null)}
        footer={
          <View style={styles.sheetActions}>
            <Pressable style={styles.secondaryButton} onPress={() => setEditingCategory(null)}>
              <Text style={styles.secondaryLabel}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.primaryButton} onPress={() => void handleSaveEdit()} disabled={savingEdit}>
              {savingEdit ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.primaryLabel}>Save</Text>
              )}
            </Pressable>
          </View>
        }>
        <FormField label="Name" value={editName} onChangeText={setEditName} />
      </BottomSheet>
    </Screen>
  );
}

const createStyles = (colors: AppPalette) =>
  StyleSheet.create({
    scroll: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.xxl,
      gap: spacing.md,
    },
    hero: {
      gap: spacing.xs,
    },
    title: {
      fontSize: typography.hero,
      fontWeight: '800',
      letterSpacing: -0.4,
    },
    subtitle: {
      fontSize: typography.body,
      lineHeight: 22,
    },
    list: {
      gap: spacing.sm,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderRadius: radius.lg,
      borderWidth: 1,
      padding: spacing.md,
      ...shadows.card,
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowTitle: {
      flex: 1,
      fontSize: typography.body,
      fontWeight: '700',
    },
    iconBtn: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 18,
      backgroundColor: colors.backgroundAlt,
    },
    emptyCard: {
      alignItems: 'center',
      borderRadius: radius.lg,
      borderWidth: 1,
      padding: spacing.xl,
      gap: spacing.sm,
    },
    emptyIcon: {
      width: 56,
      height: 56,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyTitle: {
      fontSize: typography.subheading,
      fontWeight: '800',
    },
    emptyCopy: {
      fontSize: typography.body,
      textAlign: 'center',
      lineHeight: 22,
    },
    sheetActions: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    secondaryButton: {
      flex: 1,
      minHeight: 52,
      borderRadius: radius.md,
      backgroundColor: colors.backgroundAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondaryLabel: {
      color: colors.text,
      fontSize: typography.body,
      fontWeight: '700',
    },
    primaryButton: {
      flex: 1,
      minHeight: 52,
      borderRadius: radius.md,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryLabel: {
      color: colors.white,
      fontSize: typography.body,
      fontWeight: '800',
    },
  });
