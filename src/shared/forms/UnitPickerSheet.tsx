import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/src/shared/feedback/BottomSheet';
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

export function UnitPickerSheet({ onApply, onClose, value, visible }: UnitPickerSheetProps) {
  const colors = usePalette();
  const styles = useThemedStyles(createStyles);
  const { data: units = [] } = useUnits();
  const [draft, setDraft] = useState<UnitSelection>(value);

  useEffect(() => {
    if (visible) setDraft(value);
  }, [visible, value]);

  const hasSecondary = Boolean(draft.secondaryUnit.trim());

  return (
    <BottomSheet
      visible={visible}
      title="Select unit"
      subtitle="Choose units set up for this business, with an optional secondary unit for pack conversions."
      onClose={onClose}
      footer={
        <Pressable
          style={styles.applyButton}
          onPress={() => {
            onApply(draft);
            onClose();
          }}>
          <Text style={styles.applyLabel}>Apply</Text>
        </Pressable>
      }>
      <Text style={styles.sectionLabel}>Primary unit</Text>
      {units.length ? (
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
        </View>
      ) : (
        <Text style={[styles.empty, { color: colors.textMuted }]}>No units are set up for this business yet.</Text>
      )}

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
      </View>
      {hasSecondary ? (
        <>
          <FormField
            label="Conversion rate"
            value={draft.conversionRate}
            onChangeText={(conversionRate) => setDraft((current) => ({ ...current, conversionRate }))}
            keyboardType="numeric"
            placeholder="How many primary units in one secondary"
          />
          {draft.conversionRate.trim() && Number(draft.conversionRate) > 0 ? (
            <View style={[styles.hintCard, { backgroundColor: colors.accentSoft }]}>
              <Text style={[styles.hintText, { color: colors.primary }]}>
                1 {draft.secondaryUnit.trim()} = {Number(draft.conversionRate)} {draft.primaryUnit.trim() || 'units'}
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
    chipLabel: {
      fontSize: typography.label,
      fontWeight: '700',
      color: colors.text,
    },
    chipLabelActive: {
      color: colors.onPrimary,
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
