import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { quickExpensesApi } from '@/src/api';
import { BottomSheet } from '@/src/components/feedback/BottomSheet';
import { FormField } from '@/src/components/forms/FormField';
import { Screen } from '@/src/components/layout/Screen';
import { PageHeading } from '@/src/components/ui/PageHeading';
import { SurfaceCard } from '@/src/components/ui/SurfaceCard';
import { useQuickExpenses } from '@/src/hooks/useAppQueries';
import { palette, radius, spacing, typography } from '@/src/theme';
import type { QuickExpense } from '@/src/types/models';

export default function ExpenseCategoriesScreen() {
  const queryClient = useQueryClient();
  const { data: categories, isLoading } = useQuickExpenses();
  const [newCategoryName, setNewCategoryName] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingCategory, setEditingCategory] = useState<QuickExpense | null>(null);
  const [editCategoryName, setEditCategoryName] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  async function handleAddCategory() {
    const name = newCategoryName.trim();
    if (!name) {
      Alert.alert('Required field', 'Please enter a category name.');
      return;
    }

    try {
      setAdding(true);
      await quickExpensesApi.create({ name });
      await queryClient.invalidateQueries({ queryKey: ['quick-expenses'] });
      setNewCategoryName('');
      Alert.alert('Success', `Category "${name}" created successfully.`);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Unable to create category.');
    } finally {
      setAdding(false);
    }
  }

  function startEditCategory(category: QuickExpense) {
    setEditingCategory(category);
    setEditCategoryName(category.name);
  }

  async function handleSaveEdit() {
    if (!editingCategory) return;
    const name = editCategoryName.trim();
    if (!name) {
      Alert.alert('Required field', 'Category name cannot be empty.');
      return;
    }

    try {
      setSavingEdit(true);
      await quickExpensesApi.update(editingCategory.id, { name });
      await queryClient.invalidateQueries({ queryKey: ['quick-expenses'] });
      setEditingCategory(null);
      Alert.alert('Success', 'Category updated successfully.');
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Unable to update category.');
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDeleteCategory(category: QuickExpense) {
    Alert.alert(
      'Confirm Delete',
      `Are you sure you want to delete "${category.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await quickExpensesApi.remove(category.id);
              await queryClient.invalidateQueries({ queryKey: ['quick-expenses'] });
              Alert.alert('Success', 'Category deleted successfully.');
            } catch (error) {
              Alert.alert('Error', error instanceof Error ? error.message : 'Unable to delete category.');
            }
          },
        },
      ]
    );
  }

  const topBarRight = (
    <Pressable
      style={styles.topBarBack}
      onPress={() => router.back()}>
      <MaterialCommunityIcons color={palette.text} name="close" size={24} />
    </Pressable>
  );

  return (
    <Screen scrollable={false} padded={false} topBarTitle="Expense Categories" topBarRight={topBarRight} topBarLeading="back">
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <PageHeading
          title="Expense Categories"
          subtitle="Add, modify, or delete quick category labels used for mobile expense entry."
        />

        <SurfaceCard title="Create Category" subtitle="Define a new expense label template.">
          <View style={styles.createRow}>
            <View style={{ flex: 1 }}>
              <FormField
                label="Category Name"
                value={newCategoryName}
                placeholder="e.g. Rent, Utilities, Tea & Snacks"
                onChangeText={setNewCategoryName}
              />
            </View>
            <Pressable
              style={[styles.createBtn, !newCategoryName.trim() && styles.createBtnDisabled]}
              onPress={() => void handleAddCategory()}
              disabled={!newCategoryName.trim() || adding}>
              {adding ? (
                <ActivityIndicator color={palette.white} size="small" />
              ) : (
                <Text style={styles.createBtnText}>Create</Text>
              )}
            </Pressable>
          </View>
        </SurfaceCard>

        <SurfaceCard title="Existing Categories" subtitle="Active categories currently synchronized on the device.">
          {isLoading ? (
            <ActivityIndicator color={palette.success} size="large" style={styles.loader} />
          ) : (
            <View style={styles.list}>
              {(categories ?? []).map((cat) => (
                <View key={cat.id} style={styles.row}>
                  <View style={styles.copy}>
                    <Text style={styles.title}>{cat.name}</Text>
                  </View>
                  <View style={styles.actions}>
                    <Pressable
                      style={styles.actionIconBtn}
                      onPress={() => startEditCategory(cat)}>
                      <MaterialCommunityIcons color={palette.success} name="pencil-outline" size={20} />
                    </Pressable>
                    <Pressable
                      style={styles.actionIconBtn}
                      onPress={() => void handleDeleteCategory(cat)}>
                      <MaterialCommunityIcons color={palette.danger} name="trash-can-outline" size={20} />
                    </Pressable>
                  </View>
                </View>
              ))}
              {!(categories ?? []).length ? (
                <Text style={styles.emptyText}>No categories found. Create a category above to get started.</Text>
              ) : null}
            </View>
          )}
        </SurfaceCard>
      </ScrollView>

      {/* Edit Category BottomSheet */}
      <BottomSheet
        visible={Boolean(editingCategory)}
        title="Edit Category Name"
        subtitle="Rename this category label template."
        onClose={() => setEditingCategory(null)}
        fullHeight
        footer={
          <View style={styles.sheetFooterActions}>
            <Pressable
              style={styles.sheetSecondaryButton}
              onPress={() => setEditingCategory(null)}>
              <Text style={styles.sheetSecondaryButtonLabel}>Cancel</Text>
            </Pressable>
            <Pressable
              style={styles.sheetPrimaryButton}
              onPress={() => void handleSaveEdit()}
              disabled={savingEdit}>
              {savingEdit ? (
                <ActivityIndicator color={palette.white} size="small" />
              ) : (
                <Text style={styles.sheetPrimaryButtonLabel}>Save Changes</Text>
              )}
            </Pressable>
          </View>
        }>
        {editingCategory ? (
          <View style={styles.sheetContent}>
            <FormField
              label="Category Name"
              value={editCategoryName}
              placeholder="e.g. Electricity, Office Maintenance"
              onChangeText={setEditCategoryName}
            />
          </View>
        ) : null}
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xxxl,
  },
  topBarBack: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  createBtn: {
    minHeight: 50,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: palette.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createBtnDisabled: {
    backgroundColor: palette.backgroundAlt,
  },
  createBtnText: {
    color: palette.white,
    fontWeight: '800',
    fontSize: typography.body,
  },
  list: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radius.md,
    backgroundColor: palette.surfaceMuted,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  copy: {
    flex: 1,
  },
  title: {
    fontSize: typography.body,
    fontWeight: '700',
    color: palette.text,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  actionIconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: palette.backgroundAlt,
  },
  loader: {
    marginVertical: spacing.xl,
  },
  emptyText: {
    fontSize: typography.body,
    color: palette.textSoft,
    fontWeight: '500',
    textAlign: 'center',
    marginVertical: spacing.md,
    fontStyle: 'italic',
  },
  sheetFooterActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  sheetSecondaryButton: {
    flex: 1,
    minHeight: 54,
    borderRadius: radius.md,
    backgroundColor: palette.backgroundAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetSecondaryButtonLabel: {
    color: palette.text,
    fontSize: typography.body,
    fontWeight: '700',
  },
  sheetPrimaryButton: {
    flex: 1,
    minHeight: 54,
    borderRadius: radius.md,
    backgroundColor: palette.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetPrimaryButtonLabel: {
    color: palette.white,
    fontSize: typography.body,
    fontWeight: '800',
  },
  sheetContent: {
    paddingBottom: spacing.lg,
  },
});
