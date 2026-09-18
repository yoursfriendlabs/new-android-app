import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { orderAttributesApi } from '@/src/api';
import { BottomSheet } from '@/src/shared/feedback/BottomSheet';
import { useConfirm } from '@/src/shared/feedback/ConfirmProvider';
import { useToast } from '@/src/shared/feedback/ToastProvider';
import { FormField } from '@/src/shared/forms/FormField';
import { useOrderAttributes } from '@/src/shared/hooks/useAppQueries';
import { Screen } from '@/src/shared/layout/Screen';
import { EmptyState } from '@/src/shared/ui/EmptyState';
import { SegmentedTabs } from '@/src/shared/ui/SegmentedTabs';
import { SkeletonList } from '@/src/shared/ui/Skeleton';
import { StickyActionBar } from '@/src/shared/ui/StickyActionBar';
import { usePalette } from '@/src/stores/theme-store';
import { radius, shadows, spacing, typography } from '@/src/theme';
import type { AppPalette } from '@/src/theme/app-palette';
import { useThemedStyles } from '@/src/theme/use-themed-styles';
import type { OrderAttribute } from '@/src/types/models';

type EntityType = 'sale' | 'service';
type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

const FIELD_TYPES: { value: string; label: string; icon: IconName }[] = [
  { value: 'text', label: 'Text', icon: 'format-text' },
  { value: 'number', label: 'Number', icon: 'numeric' },
  { value: 'date', label: 'Date', icon: 'calendar-outline' },
  { value: 'select', label: 'Pick one', icon: 'format-list-bulleted' },
  { value: 'toggle', label: 'Yes / No', icon: 'toggle-switch-outline' },
  { value: 'textarea', label: 'Long text', icon: 'text-long' },
];

type AttributeForm = {
  label: string;
  fieldType: string;
  options: string;
  placeholder: string;
  required: boolean;
};

const EMPTY_FORM: AttributeForm = { label: '', fieldType: 'text', options: '', placeholder: '', required: false };

/** "Vehicle no." → "vehicle_no". The backend needs a stable key; nobody should have to type one. */
function keyFromLabel(label: string) {
  return (
    label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || `field_${Date.now()}`
  );
}

function fieldTypeMeta(fieldType: string) {
  return FIELD_TYPES.find((type) => type.value === fieldType) ?? FIELD_TYPES[0];
}

/** Extra fields shown on sale and service forms, e.g. vehicle number or delivery date. */
export function AttributesScreen() {
  const colors = usePalette();
  const styles = useThemedStyles(createStyles);
  const toast = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();

  const [entityType, setEntityType] = useState<EntityType>('sale');
  const attributesQuery = useOrderAttributes(entityType);
  const attributes = attributesQuery.data ?? [];

  const [sheetVisible, setSheetVisible] = useState(false);
  const [editing, setEditing] = useState<OrderAttribute | null>(null);
  const [form, setForm] = useState<AttributeForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  function openSheet(attribute?: OrderAttribute) {
    setEditing(attribute ?? null);
    setForm(
      attribute
        ? {
            label: attribute.label,
            fieldType: String(attribute.fieldType || 'text'),
            options: Array.isArray(attribute.options) ? attribute.options.join(', ') : '',
            placeholder: String(attribute.placeholder ?? ''),
            required: Boolean(attribute.required),
          }
        : EMPTY_FORM,
    );
    setSheetVisible(true);
  }

  async function handleSave() {
    const label = form.label.trim();
    if (!label) {
      toast.error('Enter a field name.');
      return;
    }
    const options = form.options
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
    if (form.fieldType === 'select' && !options.length) {
      toast.error('Add at least one choice, separated by commas.');
      return;
    }

    const payload = {
      entityType,
      key: editing?.key || keyFromLabel(label),
      label,
      fieldType: form.fieldType,
      placeholder: form.placeholder.trim() || undefined,
      options: form.fieldType === 'select' ? options : undefined,
      required: form.required,
      sortOrder: editing?.sortOrder ?? attributes.length,
    };

    try {
      setSaving(true);
      if (editing?.id) {
        await orderAttributesApi.update(editing.id, payload);
      } else {
        await orderAttributesApi.create(payload);
      }
      await queryClient.invalidateQueries({ queryKey: ['order-attributes', entityType] });
      setSheetVisible(false);
      toast.success(editing ? 'Field updated' : 'Field added');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete(attribute: OrderAttribute) {
    const confirmed = await confirm({
      title: 'Delete this field?',
      message: `"${attribute.label}" will be removed from ${entityType} forms. Past entries keep their values.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!confirmed) return;

    try {
      await orderAttributesApi.remove(attribute.id);
      await queryClient.invalidateQueries({ queryKey: ['order-attributes', entityType] });
      toast.success('Field deleted');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not delete this field.');
    }
  }

  return (
    <Screen
      scrollable={false}
      padded={false}
      topBarTitle="Attributes"
      footer={<StickyActionBar primary={{ label: 'New field', onPress: () => openSheet() }} />}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={attributesQuery.isRefetching} onRefresh={() => void attributesQuery.refetch()} />
        }>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          Extra details you want to ask for on every {entityType}, like vehicle number or delivery date.
        </Text>

        <SegmentedTabs
          value={entityType}
          onChange={setEntityType}
          options={[
            { label: 'Sale', value: 'sale' },
            { label: 'Service', value: 'service' },
          ]}
        />

        {attributesQuery.isLoading && !attributes.length ? <SkeletonList count={4} /> : null}

        {!attributesQuery.isLoading && !attributes.length ? (
          <EmptyState
            icon="form-textbox"
            title="No extra fields yet"
            message={`${entityType === 'sale' ? 'Sale' : 'Service'} forms only ask for the basics right now.`}
          />
        ) : null}

        <View style={styles.list}>
          {attributes.map((attribute) => {
            const meta = fieldTypeMeta(String(attribute.fieldType));
            return (
              <View
                key={attribute.id || attribute.key}
                style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.avatar, { backgroundColor: colors.accentSoft }]}>
                  <MaterialCommunityIcons name={meta.icon} size={20} color={colors.primary} />
                </View>
                <View style={styles.rowCopy}>
                  <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
                    {attribute.label}
                  </Text>
                  <Text style={[styles.rowMeta, { color: colors.textMuted }]} numberOfLines={1}>
                    {[meta.label, attribute.required ? 'Required' : 'Optional'].join('  ·  ')}
                  </Text>
                </View>
                <Pressable style={styles.iconBtn} onPress={() => openSheet(attribute)}>
                  <MaterialCommunityIcons color={colors.textMuted} name="pencil-outline" size={20} />
                </Pressable>
                <Pressable style={styles.iconBtn} onPress={() => void confirmDelete(attribute)}>
                  <MaterialCommunityIcons color={colors.danger} name="trash-can-outline" size={20} />
                </Pressable>
              </View>
            );
          })}
        </View>
      </ScrollView>

      <BottomSheet
        visible={sheetVisible}
        title={editing ? 'Edit field' : `New ${entityType} field`}
        subtitle={`Shown on the ${entityType} form.`}
        onClose={() => setSheetVisible(false)}
        footer={
          <Pressable style={styles.primaryButton} onPress={() => void handleSave()} disabled={saving || !form.label.trim()}>
            {saving ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={styles.primaryLabel}>{editing ? 'Save' : 'Create field'}</Text>
            )}
          </Pressable>
        }>
        <FormField
          label="Field name"
          value={form.label}
          placeholder="e.g. Vehicle no., Delivery date"
          onChangeText={(label) => setForm((current) => ({ ...current, label }))}
        />

        <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Answer type</Text>
        <View style={styles.chipWrap}>
          {FIELD_TYPES.map((type) => {
            const active = form.fieldType === type.value;
            return (
              <Pressable
                key={type.value}
                onPress={() => setForm((current) => ({ ...current, fieldType: type.value }))}
                style={[
                  styles.chip,
                  { backgroundColor: active ? colors.accentSoft : colors.backgroundAlt },
                  active && { borderColor: colors.primary },
                ]}>
                <MaterialCommunityIcons name={type.icon} size={16} color={active ? colors.primary : colors.textMuted} />
                <Text style={[styles.chipLabel, { color: active ? colors.primary : colors.text }]}>{type.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {form.fieldType === 'select' ? (
          <FormField
            label="Choices (comma separated)"
            value={form.options}
            placeholder="e.g. Home, Office, Pickup"
            onChangeText={(options) => setForm((current) => ({ ...current, options }))}
          />
        ) : null}

        {form.fieldType !== 'toggle' ? (
          <FormField
            label="Hint (optional)"
            value={form.placeholder}
            placeholder="Grey text shown inside the empty box"
            onChangeText={(placeholder) => setForm((current) => ({ ...current, placeholder }))}
          />
        ) : null}

        <View style={styles.switchRow}>
          <View style={styles.rowCopy}>
            <Text style={[styles.rowTitle, { color: colors.text }]}>Required</Text>
            <Text style={[styles.rowMeta, { color: colors.textMuted }]}>The form cannot be saved without it.</Text>
          </View>
          <Switch
            value={form.required}
            onValueChange={(required) => setForm((current) => ({ ...current, required }))}
            trackColor={{ true: colors.primary, false: colors.border }}
          />
        </View>
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
    rowCopy: {
      flex: 1,
      gap: 2,
    },
    rowTitle: {
      fontSize: typography.body,
      fontWeight: '700',
    },
    rowMeta: {
      fontSize: typography.caption,
    },
    iconBtn: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 18,
      backgroundColor: colors.backgroundAlt,
    },
    fieldLabel: {
      fontSize: typography.caption,
      fontWeight: '700',
      marginTop: spacing.xs,
      marginBottom: spacing.xs,
    },
    chipWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
      marginBottom: spacing.sm,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xxs,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    chipLabel: {
      fontSize: typography.caption,
      fontWeight: '700',
    },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: spacing.sm,
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
