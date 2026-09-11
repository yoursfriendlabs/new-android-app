import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { categoriesApi } from '@/src/api';
import { BottomSheet } from '@/src/shared/feedback/BottomSheet';
import { useToast } from '@/src/shared/feedback/ToastProvider';
import { FormField } from '@/src/shared/forms/FormField';
import { SearchField } from '@/src/shared/ui/SearchField';
import { useCategories } from '@/src/shared/hooks/useAppQueries';
import { usePalette } from '@/src/stores/theme-store';
import { radius, spacing, typography } from '@/src/theme';
import type { AppPalette } from '@/src/theme/app-palette';
import { useThemedStyles } from '@/src/theme/use-themed-styles';
import type { Category } from '@/src/types/models';

interface CategoryPickerSheetProps {
  visible: boolean;
  selectedId?: string;
  onSelect: (category: Category) => void;
  onClose: () => void;
}

export function CategoryPickerSheet({ onClose, onSelect, selectedId, visible }: CategoryPickerSheetProps) {
  const colors = usePalette();
  const toast = useToast();
  const styles = useThemedStyles(createStyles);
  const queryClient = useQueryClient();
  const { data: categories = [] } = useCategories();
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((category) => category.name.toLowerCase().includes(q));
  }, [categories, search]);

  async function handleAdd() {
    const name = newName.trim();
    if (!name) return;
    setSaving(true);
    try {
      const created = await categoriesApi.create({ name });
      await queryClient.invalidateQueries({ queryKey: ['categories'] });
      setNewName('');
      setAdding(false);
      onSelect(created);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet
      visible={visible}
      title="Select item category"
      onClose={onClose}
      footer={
        adding ? (
          <View style={styles.addRow}>
            <View style={{ flex: 1 }}>
              <FormField label="New category" value={newName} onChangeText={setNewName} placeholder="e.g. Dairy" />
            </View>
            <Pressable style={styles.addButton} onPress={() => void handleAdd()} disabled={saving}>
              {saving ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <Text style={styles.addButtonLabel}>Add</Text>
              )}
            </Pressable>
          </View>
        ) : (
          <Pressable style={styles.newButton} onPress={() => setAdding(true)}>
            <MaterialCommunityIcons name="plus" size={20} color={colors.onPrimary} />
            <Text style={styles.newButtonLabel}>Add New Category</Text>
          </Pressable>
        )
      }>
      <SearchField placeholder="Search Category" value={search} onChangeText={setSearch} />
      <View style={styles.list}>
        {filtered.map((category) => {
          const active = category.id === selectedId;
          return (
            <Pressable
              key={category.id}
              style={styles.row}
              onPress={() => {
                onSelect(category);
                onClose();
              }}>
              <Text style={[styles.rowLabel, { color: colors.text }]}>{category.name}</Text>
              <MaterialCommunityIcons
                name={active ? 'radiobox-marked' : 'radiobox-blank'}
                size={22}
                color={active ? colors.primary : colors.textMuted}
              />
            </Pressable>
          );
        })}
        {!filtered.length ? (
          <Text style={[styles.empty, { color: colors.textMuted }]}>No categories match “{search}”.</Text>
        ) : null}
      </View>
    </BottomSheet>
  );
}

const createStyles = (colors: AppPalette) =>
  StyleSheet.create({
    list: {
      gap: 2,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    rowLabel: {
      fontSize: typography.subheading,
      fontWeight: '600',
    },
    empty: {
      fontSize: typography.body,
      paddingVertical: spacing.lg,
      textAlign: 'center',
    },
    newButton: {
      minHeight: 52,
      borderRadius: radius.md,
      backgroundColor: colors.primary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    newButtonLabel: {
      color: colors.onPrimary,
      fontSize: typography.body,
      fontWeight: '800',
    },
    addRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: spacing.sm,
    },
    addButton: {
      minHeight: 50,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.md,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addButtonLabel: {
      color: colors.onPrimary,
      fontWeight: '800',
    },
  });
