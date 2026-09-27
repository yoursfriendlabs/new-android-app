import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useSubmissionLock } from '@/src/shared/hooks/useSubmissionLock';
import { unitsApi } from '@/src/api';
import { BottomSheet } from '@/src/shared/feedback/BottomSheet';
import { useToast } from '@/src/shared/feedback/ToastProvider';
import { FormField } from '@/src/shared/forms/FormField';
import { unitLabel } from '@/src/features/inventory/lib/inventory';
import { useUnits } from '@/src/shared/hooks/useAppQueries';
import { usePalette } from '@/src/stores/theme-store';
import { radius, spacing, typography } from '@/src/theme';
import type { AppPalette } from '@/src/theme/app-palette';
import { useThemedStyles } from '@/src/theme/use-themed-styles';

export interface UnitSelection {
  primaryUnit: string;
  primaryUnitId: string;
  secondaryUnit: string;
  secondaryUnitId: string;
  conversionRate: string;
}

interface UnitPickerSheetProps {
  visible: boolean;
  value: UnitSelection;
  onApply: (value: UnitSelection) => void;
  onClose: () => void;
}

/** Which slot a freshly created unit should drop into. */
type CreatingFor = 'primary' | 'secondary' | null;

export function UnitPickerSheet({ onApply, onClose, value, visible }: UnitPickerSheetProps) {
  const colors = usePalette();
  const styles = useThemedStyles(createStyles);
  const toast = useToast();
  const queryClient = useQueryClient();
  const { data: units = [] } = useUnits();
  const [draft, setDraft] = useState<UnitSelection>(value);
  const [creatingFor, setCreatingFor] = useState<CreatingFor>(null);
  const [newUnit, setNewUnit] = useState({ name: '', symbol: '' });
  const submission = useSubmissionLock();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setDraft(value);
      setCreatingFor(null);
      setNewUnit({ name: '', symbol: '' });
    }
  }, [visible, value.primaryUnit, value.primaryUnitId, value.secondaryUnit, value.secondaryUnitId, value.conversionRate]);

  const hasSecondary = Boolean(draft.secondaryUnit.trim());

  function openCreate(slot: Exclude<CreatingFor, null>) {
    if (submission.isBusy()) return;
    setCreatingFor(slot);
    setNewUnit({ name: '', symbol: '' });
  }

  /** Adds the unit to the business, then drops it straight into the slot it was made for. */
  async function createUnit() {
    const name = newUnit.name.trim();
    if (!name) {
      toast.error('Enter a unit name.');
      return;
    }
    const symbol = newUnit.symbol.trim() || name.toLowerCase();

    if (!submission.tryStart()) return;
    try {
      setSaving(true);
      const created = await unitsApi.create({ name, symbol });
      await queryClient.invalidateQueries({ queryKey: ['units'] });
      const label = created?.name || name;

      setDraft((current) =>
        creatingFor === 'secondary'
          ? { ...current, secondaryUnitId: created?.id ?? '', secondaryUnit: label }
          : { ...current, primaryUnitId: created?.id ?? '', primaryUnit: label },
      );
      setCreatingFor(null);
      setNewUnit({ name: '', symbol: '' });
      toast.success(`${label} added`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not add this unit.');
    } finally {
      submission.finish();
      setSaving(false);
    }
  }

  const newUnitForm = (slot: Exclude<CreatingFor, null>) =>
    creatingFor === slot ? (
      <View style={styles.createCard}>
        <FormField
          label="Name"
          editable={!saving}
          value={newUnit.name}
          autoFocus
          placeholder="e.g. Kilogram, Piece, Box"
          onChangeText={(name) => setNewUnit((current) => ({ ...current, name }))}
        />
        <FormField
          label="Short form"
          editable={!saving}
          value={newUnit.symbol}
          autoCapitalize="none"
          placeholder="e.g. kg, pcs, box"
          onChangeText={(symbol) => setNewUnit((current) => ({ ...current, symbol }))}
        />
        <View style={styles.createActions}>
          <Pressable
            style={styles.createCancel}
            disabled={saving}
            onPress={() => setCreatingFor(null)}>
            <Text style={styles.createCancelLabel}>Cancel</Text>
          </Pressable>
          <Pressable
            style={[styles.createSave, (saving || !newUnit.name.trim()) && styles.disabled]}
            disabled={saving || !newUnit.name.trim()}
            onPress={() => void createUnit()}>
            {saving ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={styles.createSaveLabel}>Add unit</Text>
            )}
          </Pressable>
        </View>
      </View>
    ) : null;

  return (
    <BottomSheet
      visible={visible}
      title="Select unit"
      subtitle="Choose units set up for this business, with an optional secondary unit for pack conversions."
      onClose={() => { if (!submission.isBusy()) onClose(); }}
      footer={
        <Pressable
          style={[styles.applyButton, (saving || Boolean(creatingFor)) && styles.disabled]}
          disabled={saving || Boolean(creatingFor)}
          onPress={() => {
            onApply(draft);
            onClose();
          }}>
          <Text style={styles.applyLabel}>Apply</Text>
        </Pressable>
      }>
      <Text style={styles.sectionLabel}>Primary unit</Text>
      <View style={styles.chipWrap}>
        {units.map((unit) => {
          const active = draft.primaryUnitId === unit.id;
          return (
            <Pressable
              key={unit.id}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() =>
                setDraft((current) => ({
                  ...current,
                  primaryUnitId: unit.id,
                  primaryUnit: unit.name || unit.symbol || current.primaryUnit,
                }))
              }>
              <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{unitLabel(unit)}</Text>
            </Pressable>
          );
        })}
        <Pressable style={[styles.chip, styles.chipAdd]} onPress={() => openCreate('primary')}>
          <MaterialCommunityIcons color={colors.primary} name="plus" size={16} />
          <Text style={[styles.chipLabel, { color: colors.primary }]}>New unit</Text>
        </Pressable>
      </View>
      {!units.length ? (
        <Text style={[styles.empty, { color: colors.textMuted }]}>
          No units are set up for this business yet. Add the first one above.
        </Text>
      ) : null}
      {newUnitForm('primary')}

      <Text style={styles.sectionLabel}>Secondary unit (optional)</Text>
      <View style={styles.chipWrap}>
        <Pressable
          style={[styles.chip, !draft.secondaryUnitId && styles.chipActive]}
          onPress={() => setDraft((current) => ({ ...current, secondaryUnit: '', secondaryUnitId: '', conversionRate: '' }))}>
          <Text style={[styles.chipLabel, !draft.secondaryUnitId && styles.chipLabelActive]}>None</Text>
        </Pressable>
        {units.map((unit) => {
          const active = draft.secondaryUnitId === unit.id;
          return (
            <Pressable
              key={unit.id}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() =>
                setDraft((current) => ({
                  ...current,
                  secondaryUnitId: unit.id,
                  secondaryUnit: unit.name || unit.symbol || current.secondaryUnit,
                }))
              }>
              <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{unitLabel(unit)}</Text>
            </Pressable>
          );
        })}
        <Pressable style={[styles.chip, styles.chipAdd]} onPress={() => openCreate('secondary')}>
          <MaterialCommunityIcons color={colors.primary} name="plus" size={16} />
          <Text style={[styles.chipLabel, { color: colors.primary }]}>New unit</Text>
        </Pressable>
      </View>
      {newUnitForm('secondary')}

      {hasSecondary ? (
        <>
          <FormField
            label="Conversion rate"
            value={draft.conversionRate}
            onChangeText={(conversionRate) => setDraft((current) => ({ ...current, conversionRate }))}
            keyboardType="numeric"
            placeholder={`How many ${draft.secondaryUnit.trim() || 'secondary units'} make one ${
              draft.primaryUnit.trim() || 'primary unit'
            }`}
          />
          {draft.conversionRate.trim() && Number(draft.conversionRate) > 0 ? (
            <View style={[styles.hintCard, { backgroundColor: colors.accentSoft }]}>
              <Text style={[styles.hintText, { color: colors.primary }]}>
                1 {draft.primaryUnit.trim() || 'unit'} = {Number(draft.conversionRate)}{' '}
                {draft.secondaryUnit.trim()}
              </Text>
            </View>
          ) : null}
        </>
      ) : null}
    </BottomSheet>
  );
}

const createStyles = (colors: AppPalette) =>
  StyleSheet.create({
    sectionLabel: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: colors.textSoft,
      marginTop: spacing.sm,
    },
    chipWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    chip: {
      minHeight: 36,
      paddingHorizontal: spacing.md,
      borderRadius: radius.pill,
      backgroundColor: colors.backgroundAlt,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    chipAdd: {
      flexDirection: 'row',
      gap: 4,
      borderStyle: 'dashed',
      borderColor: colors.primary,
      backgroundColor: 'transparent',
    },
    chipLabel: {
      fontSize: typography.label,
      fontWeight: '700',
      color: colors.text,
    },
    chipLabelActive: {
      color: colors.onPrimary,
    },
    createCard: {
      gap: spacing.sm,
      padding: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      marginTop: spacing.xs,
    },
    createActions: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    createCancel: {
      minHeight: 44,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.md,
      backgroundColor: colors.backgroundAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    createCancelLabel: {
      color: colors.text,
      fontWeight: '700',
      fontSize: typography.body,
    },
    createSave: {
      flex: 1,
      minHeight: 44,
      borderRadius: radius.md,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    createSaveLabel: {
      color: colors.onPrimary,
      fontWeight: '800',
      fontSize: typography.body,
    },
    disabled: {
      opacity: 0.6,
    },
    hintCard: {
      borderRadius: radius.md,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
    },
    empty: {
      fontSize: typography.body,
      paddingVertical: spacing.sm,
    },
    hintText: {
      fontSize: typography.body,
      fontWeight: '800',
    },
    applyButton: {
      minHeight: 52,
      borderRadius: radius.md,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    applyLabel: {
      color: colors.onPrimary,
      fontSize: typography.body,
      fontWeight: '800',
    },
  });
