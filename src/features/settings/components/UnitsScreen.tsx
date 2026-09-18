import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { unitsApi } from '@/src/api';
import { BottomSheet } from '@/src/shared/feedback/BottomSheet';
import { useConfirm } from '@/src/shared/feedback/ConfirmProvider';
import { useToast } from '@/src/shared/feedback/ToastProvider';
import { FormField } from '@/src/shared/forms/FormField';
import { useUnits } from '@/src/shared/hooks/useAppQueries';
import { useDebouncedValue } from '@/src/shared/hooks/useDebouncedValue';
import { Screen } from '@/src/shared/layout/Screen';
import { EmptyState } from '@/src/shared/ui/EmptyState';
import { SearchField } from '@/src/shared/ui/SearchField';
import { SkeletonList } from '@/src/shared/ui/Skeleton';
import { StickyActionBar } from '@/src/shared/ui/StickyActionBar';
import { usePalette } from '@/src/stores/theme-store';
import { radius, shadows, spacing, typography } from '@/src/theme';
import type { AppPalette } from '@/src/theme/app-palette';
import { useThemedStyles } from '@/src/theme/use-themed-styles';
import type { Unit } from '@/src/types/models';

type UnitForm = { name: string; symbol: string };

const EMPTY_FORM: UnitForm = { name: '', symbol: '' };

/** Units used on items (pcs, kg, box…). Create, rename, and delete in one list. */
export function UnitsScreen() {
  const colors = usePalette();
  const styles = useThemedStyles(createStyles);
  const toast = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const unitsQuery = useUnits();
  const units = unitsQuery.data ?? [];

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [editing, setEditing] = useState<Unit | null>(null);
  const [form, setForm] = useState<UnitForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const visibleUnits = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    if (!query) return units;
    return units.filter(
      (unit) => unit.name.toLowerCase().includes(query) || String(unit.symbol ?? '').toLowerCase().includes(query),
    );
  }, [units, debouncedSearch]);

  function openSheet(unit?: Unit) {
    setEditing(unit ?? null);
    setForm(unit ? { name: unit.name, symbol: String(unit.symbol ?? '') } : EMPTY_FORM);
    setSheetVisible(true);
  }

  async function handleSave() {
    const name = form.name.trim();
    const symbol = form.symbol.trim() || name.toLowerCase();
    if (!name) {
      toast.error('Enter a unit name.');
      return;
    }

    try {
      setSaving(true);
      if (editing) {
        await unitsApi.update(editing.id, { name, symbol });
      } else {
        await unitsApi.create({ name, symbol });
      }
      await queryClient.invalidateQueries({ queryKey: ['units'] });
      setSheetVisible(false);
      toast.success(editing ? 'Unit updated' : 'Unit added');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete(unit: Unit) {
    const confirmed = await confirm({
      title: 'Delete this unit?',
      message: `"${unit.name}" will no longer be offered when adding items.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!confirmed) return;

    try {
      await unitsApi.remove(unit.id);
      await queryClient.invalidateQueries({ queryKey: ['units'] });
      toast.success('Unit deleted');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not delete this unit.');
    }
  }

  return (
    <Screen
      scrollable={false}
      padded={false}
      topBarTitle="Units"
      footer={<StickyActionBar primary={{ label: 'New unit', onPress: () => openSheet() }} />}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={unitsQuery.isRefetching} onRefresh={() => void unitsQuery.refetch()} />}>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          How you count and sell stock, like pcs, kg, litre or box. These show up when adding an item.
        </Text>

        <SearchField placeholder="Search units" value={search} onChangeText={setSearch} />

        {unitsQuery.isLoading && !units.length ? <SkeletonList count={5} /> : null}

        {!unitsQuery.isLoading && !visibleUnits.length ? (
          <EmptyState
            icon="scale-balance"
            title={units.length ? 'No matching units' : 'No units yet'}
            message={units.length ? 'Try a different search.' : 'Add the units your shop sells in.'}
          />
        ) : null}

        <View style={styles.list}>
          {visibleUnits.map((unit) => (
            <View key={unit.id} style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.avatar, { backgroundColor: colors.accentSoft }]}>
                <Text style={[styles.symbol, { color: colors.primary }]} numberOfLines={1}>
                  {String(unit.symbol || unit.name).slice(0, 4)}
                </Text>
              </View>
              <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
                {unit.name}
              </Text>
              <Pressable style={styles.iconBtn} onPress={() => openSheet(unit)}>
                <MaterialCommunityIcons color={colors.textMuted} name="pencil-outline" size={20} />
              </Pressable>
              <Pressable style={styles.iconBtn} onPress={() => void confirmDelete(unit)}>
                <MaterialCommunityIcons color={colors.danger} name="trash-can-outline" size={20} />
              </Pressable>
            </View>
          ))}
        </View>
      </ScrollView>

      <BottomSheet
        visible={sheetVisible}
        title={editing ? 'Edit unit' : 'New unit'}
        subtitle="The short form is what prints on bills, e.g. kg."
        onClose={() => setSheetVisible(false)}
        footer={
          <Pressable style={styles.primaryButton} onPress={() => void handleSave()} disabled={saving || !form.name.trim()}>
            {saving ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={styles.primaryLabel}>{editing ? 'Save' : 'Create unit'}</Text>
            )}
          </Pressable>
        }>
        <FormField
          label="Name"
          value={form.name}
          placeholder="e.g. Kilogram, Piece, Box"
          onChangeText={(name) => setForm((current) => ({ ...current, name }))}
        />
        <FormField
          label="Short form"
          value={form.symbol}
          placeholder="e.g. kg, pcs, box"
          autoCapitalize="none"
          onChangeText={(symbol) => setForm((current) => ({ ...current, symbol }))}
        />
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
    symbol: {
      fontSize: typography.caption,
      fontWeight: '800',
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
    primaryButton: {
      flex: 1,
      minHeight: 52,
      borderRadius: radius.md,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryLabel: {
      color: colors.onPrimary,
      fontSize: typography.body,
      fontWeight: '800',
    },
  });
