import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { categoriesApi, productsApi } from '@/src/api';
import { BottomSheet } from '@/src/shared/feedback/BottomSheet';
import { FormField } from '@/src/shared/forms/FormField';
import { SegmentedTabs } from '@/src/shared/ui/SegmentedTabs';
import { useCategories, useUnits } from '@/src/shared/hooks/useAppQueries';
import {
  getPurityOptions,
  invalidateInventoryQueries,
  METAL_TYPE_OPTIONS,
  unitLabel,
} from '@/src/features/inventory/lib/inventory';
import { useAuthStore } from '@/src/stores/auth-store';
import { usePalette } from '@/src/stores/theme-store';
import { radius, spacing, typography } from '@/src/theme';
import type { AppPalette } from '@/src/theme/app-palette';
import { useThemedStyles } from '@/src/theme/use-themed-styles';
import type { Product } from '@/src/types/models';

type ItemType = 'goods' | 'service';

interface ProductFormSheetProps {
  visible: boolean;
  product?: Product | null;
  onClose: () => void;
}

function formFromProduct(product?: Product | null) {
  return {
    name: product?.name ?? '',
    companyName: String(product?.companyName ?? ''),
    sku: String(product?.sku ?? ''),
    itemType: (String(product?.itemType || 'goods').toLowerCase() === 'service' ? 'service' : 'goods') as ItemType,
    categoryId: String(product?.categoryId ?? ''),
    unitId: String(product?.unitId || product?.primaryUnitId || ''),
    primaryUnit: product?.primaryUnit ?? '',
    secondaryUnit: String(product?.secondaryUnit ?? ''),
    conversionRate: product?.secondaryConversionRate ? String(product.secondaryConversionRate) : '',
    salePrice: product ? String(product.salePrice ?? '') : '',
    purchasePrice: product?.purchasePrice != null ? String(product.purchasePrice) : '',
    mrpPrice: product?.mrpPrice ? String(product.mrpPrice) : '',
    wholesalePrice: product?.wholesalePrice ? String(product.wholesalePrice) : '',
    secondarySalePrice: product?.secondarySalePrice ? String(product.secondarySalePrice) : '',
    minWholesaleQuantity: product?.minWholesaleQuantity ? String(product.minWholesaleQuantity) : '',
    openingStock: '',
    taxRate: product?.taxRate != null ? String(product.taxRate) : '0',
    lowStockAlert: product ? Boolean(product.lowStockAlert) : true,
    metalType: String(product?.metalType ?? ''),
    purity: String(product?.purity ?? ''),
    expiryDate: String(product?.expiryDate ?? '').slice(0, 10),
    batchNumber: String(product?.batchNumber ?? ''),
  };
}

export function ProductFormSheet({ onClose, product, visible }: ProductFormSheetProps) {
  const colors = usePalette();
  const styles = useThemedStyles(createStyles);
  const queryClient = useQueryClient();
  const isJewellery = useAuthStore((state) => {
    const type = String(state.businessProfile?.businessType || state.businessProfile?.type || '').toLowerCase();
    return type.includes('jewel');
  });
  const { data: categories = [] } = useCategories();
  const { data: units = [] } = useUnits();
  const [form, setForm] = useState(formFromProduct(product));
  const [newCategory, setNewCategory] = useState('');
  const [addingCategory, setAddingCategory] = useState(false);
  const [saving, setSaving] = useState(false);
  const isEditing = Boolean(product?.id);
  const purityOptions = useMemo(() => getPurityOptions(form.metalType), [form.metalType]);

  useEffect(() => {
    if (visible) {
      setForm(formFromProduct(product));
      setNewCategory('');
      setAddingCategory(false);
    }
  }, [product, visible]);

  async function handleAddCategory() {
    const name = newCategory.trim();
    if (!name) return;
    try {
      const created = await categoriesApi.create({ name });
      await queryClient.invalidateQueries({ queryKey: ['categories'] });
      setForm((current) => ({ ...current, categoryId: created.id }));
      setNewCategory('');
      setAddingCategory(false);
    } catch (error) {
      Alert.alert('Unable to add category', error instanceof Error ? error.message : 'Please try again.');
    }
  }

  async function handleSave() {
    if (!form.name.trim()) {
      Alert.alert('Name required', 'Enter a product name.');
      return;
    }
    if (!form.salePrice.trim()) {
      Alert.alert('Sale price required', 'Enter a selling price.');
      return;
    }
    if (!form.primaryUnit.trim() && !form.unitId) {
      Alert.alert('Unit required', 'Pick or enter a primary unit.');
      return;
    }

    setSaving(true);
    const payload = {
      name: form.name.trim(),
      companyName: form.companyName.trim() || undefined,
      sku: form.sku.trim() || undefined,
      itemType: form.itemType,
      categoryId: form.categoryId || undefined,
      unitId: form.unitId || undefined,
      primaryUnit: form.primaryUnit.trim() || 'pcs',
      secondaryUnit: form.secondaryUnit.trim() || undefined,
      conversionRate: form.conversionRate.trim() ? Number(form.conversionRate) : undefined,
      secondaryConversionRate: form.conversionRate.trim() ? Number(form.conversionRate) : undefined,
      salePrice: Number(form.salePrice || 0),
      purchasePrice: form.purchasePrice.trim() ? Number(form.purchasePrice) : undefined,
      mrpPrice: form.mrpPrice.trim() ? Number(form.mrpPrice) : undefined,
      wholesalePrice: form.wholesalePrice.trim() ? Number(form.wholesalePrice) : undefined,
      secondarySalePrice: form.secondarySalePrice.trim() ? Number(form.secondarySalePrice) : undefined,
      minWholesaleQuantity: form.minWholesaleQuantity.trim() ? Number(form.minWholesaleQuantity) : undefined,
      taxRate: form.taxRate.trim() ? Number(form.taxRate) : undefined,
      lowStockAlert: form.lowStockAlert,
      metalType: form.metalType || undefined,
      purity: form.purity || undefined,
      ...(isEditing
        ? {}
        : {
            openingStock: form.openingStock.trim() ? Number(form.openingStock) : 0,
            expiryDate: form.expiryDate || undefined,
            batchNumber: form.batchNumber.trim() || undefined,
          }),
    };

    try {
      if (product?.id) {
        await productsApi.update(product.id, payload);
      } else {
        await productsApi.create(payload);
      }
      await invalidateInventoryQueries(queryClient);
      onClose();
    } catch (error) {
      Alert.alert(
        isEditing ? 'Unable to update product' : 'Unable to create product',
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet
      visible={visible}
      title={isEditing ? 'Edit product' : 'New product'}
      subtitle={isEditing ? 'Update catalog details, prices, and units.' : 'Add an item with price, unit, and opening stock.'}
      onClose={onClose}
      fullHeight
      footer={
        <Pressable style={styles.saveButton} onPress={() => void handleSave()} disabled={saving}>
          {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveLabel}>{isEditing ? 'Save changes' : 'Create product'}</Text>}
        </Pressable>
      }>
      <FormField label="Name" value={form.name} onChangeText={(name) => setForm((current) => ({ ...current, name }))} placeholder="e.g. Coca-Cola 250ml" />
      <FormField label="Brand" value={form.companyName} onChangeText={(companyName) => setForm((current) => ({ ...current, companyName }))} placeholder="Optional" />
      <FormField label="SKU / item code" value={form.sku} onChangeText={(sku) => setForm((current) => ({ ...current, sku }))} placeholder="Optional" />

      <Text style={styles.sectionLabel}>Type</Text>
      <SegmentedTabs
        value={form.itemType}
        onChange={(itemType) => setForm((current) => ({ ...current, itemType }))}
        options={[
          { label: 'Goods', value: 'goods' },
          { label: 'Service', value: 'service' },
        ]}
      />

      <Text style={styles.sectionLabel}>Category</Text>
      <View style={styles.chipWrap}>
        {categories.map((category) => {
          const active = form.categoryId === category.id;
          return (
            <Pressable
              key={category.id}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setForm((current) => ({ ...current, categoryId: active ? '' : category.id }))}>
              <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{category.name}</Text>
            </Pressable>
          );
        })}
        <Pressable style={styles.chipAdd} onPress={() => setAddingCategory((current) => !current)}>
          <MaterialCommunityIcons color={colors.primary} name="plus" size={16} />
          <Text style={styles.chipAddLabel}>New</Text>
        </Pressable>
      </View>
      {addingCategory ? (
        <View style={styles.inlineRow}>
          <View style={{ flex: 1 }}>
            <FormField label="New category" value={newCategory} onChangeText={setNewCategory} placeholder="e.g. Drinks" />
          </View>
          <Pressable style={styles.inlineButton} onPress={() => void handleAddCategory()}>
            <Text style={styles.inlineButtonLabel}>Add</Text>
          </Pressable>
        </View>
      ) : null}

      <Text style={styles.sectionLabel}>Primary unit</Text>
      {units.length ? (
        <View style={styles.chipWrap}>
          {units.map((unit) => {
            const active = form.unitId === unit.id;
            return (
              <Pressable
                key={unit.id}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() =>
                  setForm((current) => ({
                    ...current,
                    unitId: unit.id,
                    primaryUnit: unit.name || unit.symbol || current.primaryUnit,
                  }))
                }>
                <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{unitLabel(unit)}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      <FormField
        label="Or type a unit"
        value={form.primaryUnit}
        onChangeText={(primaryUnit) => setForm((current) => ({ ...current, primaryUnit, unitId: '' }))}
        placeholder="pcs, kg, box"
      />
      <FormField label="Secondary unit" value={form.secondaryUnit} onChangeText={(secondaryUnit) => setForm((current) => ({ ...current, secondaryUnit }))} placeholder="Optional, e.g. pack" />
      {form.secondaryUnit ? (
        <FormField
          label="Conversion rate"
          value={form.conversionRate}
          onChangeText={(conversionRate) => setForm((current) => ({ ...current, conversionRate }))}
          keyboardType="numeric"
          placeholder="How many primary units in one secondary"
        />
      ) : null}

      <View style={styles.formRow}>
        <View style={{ flex: 1 }}>
          <FormField label="Sale price" value={form.salePrice} onChangeText={(salePrice) => setForm((current) => ({ ...current, salePrice }))} keyboardType="numeric" />
        </View>
        <View style={{ width: spacing.sm }} />
        <View style={{ flex: 1 }}>
          <FormField label="Purchase price" value={form.purchasePrice} onChangeText={(purchasePrice) => setForm((current) => ({ ...current, purchasePrice }))} keyboardType="numeric" />
        </View>
      </View>
      <View style={styles.formRow}>
        <View style={{ flex: 1 }}>
          <FormField label="MRP" value={form.mrpPrice} onChangeText={(mrpPrice) => setForm((current) => ({ ...current, mrpPrice }))} keyboardType="numeric" />
        </View>
        <View style={{ width: spacing.sm }} />
        <View style={{ flex: 1 }}>
          <FormField label="Wholesale" value={form.wholesalePrice} onChangeText={(wholesalePrice) => setForm((current) => ({ ...current, wholesalePrice }))} keyboardType="numeric" />
        </View>
      </View>
      {form.secondaryUnit ? (
        <FormField
          label={`Sale price (${form.secondaryUnit})`}
          value={form.secondarySalePrice}
          onChangeText={(secondarySalePrice) => setForm((current) => ({ ...current, secondarySalePrice }))}
          keyboardType="numeric"
          placeholder="Optional"
        />
      ) : null}
      <FormField
        label="Min wholesale qty"
        value={form.minWholesaleQuantity}
        onChangeText={(minWholesaleQuantity) => setForm((current) => ({ ...current, minWholesaleQuantity }))}
        keyboardType="numeric"
        placeholder="Optional"
      />
      <FormField label="Tax %" value={form.taxRate} onChangeText={(taxRate) => setForm((current) => ({ ...current, taxRate }))} keyboardType="numeric" />
      <Pressable
        style={[styles.toggleRow, form.lowStockAlert && styles.toggleRowOn]}
        onPress={() => setForm((current) => ({ ...current, lowStockAlert: !current.lowStockAlert }))}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.toggleTitle}>Low stock alert</Text>
          <Text style={styles.toggleCopy}>Warn on the inventory list when quantity runs low.</Text>
        </View>
        <MaterialCommunityIcons
          color={form.lowStockAlert ? colors.primary : colors.textMuted}
          name={form.lowStockAlert ? 'checkbox-marked' : 'checkbox-blank-outline'}
          size={22}
        />
      </Pressable>

      {!isEditing && form.itemType === 'goods' ? (
        <>
          <FormField
            label="Opening stock"
            value={form.openingStock}
            onChangeText={(openingStock) => setForm((current) => ({ ...current, openingStock }))}
            keyboardType="numeric"
            placeholder="0"
          />
          <FormField label="Expiry date" value={form.expiryDate} onChangeText={(expiryDate) => setForm((current) => ({ ...current, expiryDate }))} placeholder="YYYY-MM-DD" />
          <FormField label="Batch number" value={form.batchNumber} onChangeText={(batchNumber) => setForm((current) => ({ ...current, batchNumber }))} placeholder="Optional" />
        </>
      ) : null}

      {isJewellery ? (
        <>
          <Text style={styles.sectionLabel}>Metal</Text>
          <View style={styles.chipWrap}>
            {METAL_TYPE_OPTIONS.map((option) => {
              const active = form.metalType === option.value;
              return (
                <Pressable
                  key={option.value}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setForm((current) => ({ ...current, metalType: option.value, purity: '' }))}>
                  <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
          {purityOptions.length ? (
            <>
              <Text style={styles.sectionLabel}>Purity</Text>
              <View style={styles.chipWrap}>
                {purityOptions.map((option) => {
                  const active = form.purity === option;
                  return (
                    <Pressable
                      key={option}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => setForm((current) => ({ ...current, purity: option }))}>
                      <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{option}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
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
      color: colors.white,
    },
    chipAdd: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      minHeight: 36,
      paddingHorizontal: spacing.md,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.primary,
      backgroundColor: colors.accentSoft,
    },
    chipAddLabel: {
      fontSize: typography.label,
      fontWeight: '800',
      color: colors.primary,
    },
    inlineRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: spacing.sm,
    },
    inlineButton: {
      minHeight: 50,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.md,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    inlineButtonLabel: {
      color: colors.white,
      fontWeight: '800',
    },
    formRow: {
      flexDirection: 'row',
    },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.backgroundAlt,
      padding: spacing.md,
    },
    toggleRowOn: {
      borderColor: colors.primary,
      backgroundColor: colors.accentSoft,
    },
    toggleTitle: {
      fontSize: typography.body,
      fontWeight: '700',
      color: colors.text,
    },
    toggleCopy: {
      fontSize: typography.caption,
      color: colors.textMuted,
      lineHeight: 18,
    },
    saveButton: {
      minHeight: 52,
      borderRadius: radius.md,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveLabel: {
      color: colors.white,
      fontSize: typography.body,
      fontWeight: '800',
    },
  });
