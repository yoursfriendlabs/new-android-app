import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { productsApi } from '@/src/api';
import { useToast } from '@/src/shared/feedback/ToastProvider';
import { FormField } from '@/src/shared/forms/FormField';
import { DatePickerField } from '@/src/shared/forms/DatePickerField';
import { CategoryPickerSheet } from '@/src/shared/forms/CategoryPickerSheet';
import { UnitPickerSheet, type UnitSelection } from '@/src/shared/forms/UnitPickerSheet';
import { ProductImagePicker } from '@/src/shared/forms/ProductImagePicker';
import { Screen } from '@/src/shared/layout/Screen';
import { SegmentedTabs } from '@/src/shared/ui/SegmentedTabs';
import { StickyActionBar } from '@/src/shared/ui/StickyActionBar';
import {
  getPurityOptions,
  invalidateInventoryQueries,
  METAL_TYPE_OPTIONS,
} from '@/src/features/inventory/lib/inventory';
import { useProductById } from '@/src/shared/hooks/useAppQueries';
import { useAuthStore } from '@/src/stores/auth-store';
import { usePalette } from '@/src/stores/theme-store';
import { radius, spacing, typography } from '@/src/theme';
import type { AppPalette } from '@/src/theme/app-palette';
import { useThemedStyles } from '@/src/theme/use-themed-styles';
import type { Category, Product } from '@/src/types/models';

type FormTab = 'stock' | 'additional';

function formFromProduct(product?: Product | null) {
  return {
    imageUrl: product?.imageUrl || null,
    name: product?.name ?? '',
    companyName: String(product?.companyName ?? ''),
    sku: String(product?.sku ?? ''),
    barcode: String(product?.barcode ?? ''),
    categoryId: String(product?.categoryId ?? ''),
    categoryName: String(product?.categoryName ?? ''),
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
    lowStockAlert: product ? Boolean(product.lowStockAlert) : false,
    minStockLevel: product?.minStockLevel ? String(product.minStockLevel) : '',
    metalType: String(product?.metalType ?? ''),
    purity: String(product?.purity ?? ''),
    expiryDate: String(product?.expiryDate ?? '').slice(0, 10),
    batchNumber: String(product?.batchNumber ?? ''),
  };
}

export default function ItemFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const colors = usePalette();
  const toast = useToast();
  const styles = useThemedStyles(createStyles);
  const queryClient = useQueryClient();
  const isEditing = Boolean(id);
  const { data: product } = useProductById(id);
  const isJewellery = useAuthStore((state) => {
    const type = String(state.businessProfile?.businessType || state.businessProfile?.type || '').toLowerCase();
    return type.includes('jewel');
  });

  const [form, setForm] = useState(formFromProduct(product));
  const [tab, setTab] = useState<FormTab>('stock');
  const [categoryVisible, setCategoryVisible] = useState(false);
  const [unitVisible, setUnitVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const purityOptions = useMemo(() => getPurityOptions(form.metalType), [form.metalType]);

  // Hydrate the form once the product loads in edit mode.
  useEffect(() => {
    if (product) setForm(formFromProduct(product));
  }, [product]);

  const unitLabelText = form.secondaryUnit.trim()
    ? `${form.primaryUnit || 'unit'} & ${form.secondaryUnit}`
    : form.primaryUnit || 'Select unit';
  const conversionHint =
    form.secondaryUnit.trim() && form.conversionRate.trim() && Number(form.conversionRate) > 0
      ? `1 ${form.secondaryUnit.trim()} = ${Number(form.conversionRate)} ${form.primaryUnit.trim() || 'units'}`
      : '';

  function applyUnit(selection: UnitSelection) {
    setForm((current) => ({
      ...current,
      primaryUnit: selection.primaryUnit,
      unitId: selection.primaryUnitId,
      secondaryUnit: selection.secondaryUnit,
      conversionRate: selection.conversionRate,
    }));
  }

  function selectCategory(category: Category) {
    setForm((current) => ({ ...current, categoryId: category.id, categoryName: category.name }));
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error('Enter an item name.');
      return;
    }
    if (!form.salePrice.trim()) {
      setTab('stock');
      toast.error('Enter a sales price.');
      return;
    }
    if (!form.primaryUnit.trim() && !form.unitId) {
      setTab('stock');
      toast.error('Pick or type a unit.');
      return;
    }

    setSaving(true);
    const payload = {
      name: form.name.trim(),
      companyName: form.companyName.trim() || undefined,
      sku: form.sku.trim() || undefined,
      barcode: form.barcode.trim() || undefined,
      itemType: 'goods' as const,
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
      minStockLevel: form.lowStockAlert && form.minStockLevel.trim() ? Number(form.minStockLevel) : undefined,
      imageUrl: form.imageUrl || null,
      metalType: form.metalType || undefined,
      purity: form.purity || undefined,
      ...(isEditing
        ? {}
        : {
            openingStock: form.openingStock.trim() ? Number(form.openingStock) : 0,
            expiryDate: form.expiryDate.trim() ? form.expiryDate.trim() : undefined,
            batchNumber: form.batchNumber.trim() ? form.batchNumber.trim() : undefined,
          }),
    };

    try {
      if (id) {
        await productsApi.update(id, payload);
        await invalidateInventoryQueries(queryClient);
        router.back();
      } else {
        const created = await productsApi.create(payload);
        await invalidateInventoryQueries(queryClient);
        if (created?.id) {
          router.replace({ pathname: '/(app)/item-detail' as any, params: { id: created.id } });
        } else {
          router.back();
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen
      scrollable
      topBarTitle={isEditing ? 'Edit Item' : 'Add New Item'}
      footer={
        <StickyActionBar
          primary={{
            label: saving ? 'Saving…' : isEditing ? 'Save Changes' : 'Save',
            onPress: () => void handleSave(),
          }}
        />
      }>
      <FormField
        label="Item Name"
        value={form.name}
        onChangeText={(name) => setForm((current) => ({ ...current, name }))}
        placeholder="e.g. Amul Milk 1L"
      />

      <Pressable style={styles.selectRow} onPress={() => setCategoryVisible(true)}>
        <View style={{ flex: 1 }}>
          <Text style={styles.selectLabel}>Category</Text>
          <Text style={[styles.selectValue, { color: form.categoryName ? colors.text : colors.textMuted }]}>
            {form.categoryName || 'General'}
          </Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textMuted} />
      </Pressable>

      <SegmentedTabs
        value={tab}
        onChange={setTab}
        options={[
          { label: 'Stock Details', value: 'stock' },
          { label: 'Additional Details', value: 'additional' },
        ]}
      />

      {tab === 'stock' ? (
        <View style={styles.section}>
          <View style={styles.row}>
            {!isEditing ? (
              <>
                <View style={{ flex: 1 }}>
                  <FormField
                    label="Opening Stock"
                    value={form.openingStock}
                    onChangeText={(openingStock) => setForm((current) => ({ ...current, openingStock }))}
                    keyboardType="numeric"
                    placeholder="0"
                  />
                </View>
                <View style={{ width: spacing.sm }} />
              </>
            ) : null}
            <View style={{ flex: 1 }}>
              <Pressable style={styles.unitField} onPress={() => setUnitVisible(true)}>
                <Text style={styles.selectLabel}>Unit</Text>
                <View style={styles.unitFieldRow}>
                  <Text style={[styles.selectValue, { color: form.primaryUnit ? colors.text : colors.textMuted }]} numberOfLines={1}>
                    {unitLabelText}
                  </Text>
                  <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
                </View>
              </Pressable>
            </View>
          </View>
          {conversionHint ? (
            <View style={styles.hintRow}>
              <MaterialCommunityIcons name="information" size={16} color={colors.primary} />
              <Text style={[styles.hintText, { color: colors.textSoft }]}>{conversionHint}</Text>
            </View>
          ) : null}

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <FormField
                label="Sales Price"
                value={form.salePrice}
                onChangeText={(salePrice) => setForm((current) => ({ ...current, salePrice }))}
                keyboardType="numeric"
                placeholder="0"
              />
            </View>
            <View style={{ width: spacing.sm }} />
            <View style={{ flex: 1 }}>
              <FormField
                label="Purchase Price"
                value={form.purchasePrice}
                onChangeText={(purchasePrice) => setForm((current) => ({ ...current, purchasePrice }))}
                keyboardType="numeric"
                placeholder="0"
              />
            </View>
          </View>
          {form.secondaryUnit.trim() ? (
            <FormField
              label={`Sales Price for ${form.secondaryUnit.trim()}`}
              value={form.secondarySalePrice}
              onChangeText={(secondarySalePrice) => setForm((current) => ({ ...current, secondarySalePrice }))}
              keyboardType="numeric"
              placeholder="Optional"
            />
          ) : null}

          {!isEditing ? (
            <>
              <Text style={styles.sectionLabel}>Expiry &amp; Batch</Text>
              <DatePickerField
                label="Expiry date"
                value={form.expiryDate}
                onChangeText={(expiryDate) => setForm((current) => ({ ...current, expiryDate }))}
                helperText="Optional — tracked as a stock lot with expiry."
              />
              <FormField
                label="Batch / Lot number"
                value={form.batchNumber}
                onChangeText={(batchNumber) => setForm((current) => ({ ...current, batchNumber }))}
                placeholder="e.g. LOT-A12"
              />
            </>
          ) : (
            <Text style={[styles.mutedNote, { color: colors.textMuted }]}>
              Stock, expiry, and batches are managed from the item’s Add/Reduce Stock and Lots after saving.
            </Text>
          )}

          <Pressable
            style={[styles.toggleRow, form.lowStockAlert && styles.toggleRowOn]}
            onPress={() => setForm((current) => ({ ...current, lowStockAlert: !current.lowStockAlert }))}>
            <MaterialCommunityIcons name="bell-outline" size={20} color={form.lowStockAlert ? colors.primary : colors.textMuted} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.toggleTitle}>Low Stock Alert</Text>
              <Text style={styles.toggleCopy}>Warn on the inventory list when quantity runs low.</Text>
            </View>
            <MaterialCommunityIcons
              color={form.lowStockAlert ? colors.primary : colors.textMuted}
              name={form.lowStockAlert ? 'toggle-switch' : 'toggle-switch-off-outline'}
              size={34}
            />
          </Pressable>
          {form.lowStockAlert ? (
            <FormField
              label="Alert when stock reaches"
              value={form.minStockLevel}
              onChangeText={(minStockLevel) => setForm((current) => ({ ...current, minStockLevel }))}
              keyboardType="numeric"
              placeholder="e.g. 5"
            />
          ) : null}
        </View>
      ) : (
        <View style={styles.section}>
          <FormField
            label="Item Code"
            value={form.sku}
            onChangeText={(sku) => setForm((current) => ({ ...current, sku }))}
            placeholder="e.g. AML-1L"
          />
          <FormField
            label="Barcode"
            value={form.barcode}
            onChangeText={(barcode) => setForm((current) => ({ ...current, barcode }))}
            placeholder="Optional"
          />
          <FormField
            label="Brand / Company"
            value={form.companyName}
            onChangeText={(companyName) => setForm((current) => ({ ...current, companyName }))}
            placeholder="e.g. Amul"
          />
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <FormField
                label="MRP"
                value={form.mrpPrice}
                onChangeText={(mrpPrice) => setForm((current) => ({ ...current, mrpPrice }))}
                keyboardType="numeric"
                placeholder="Optional"
              />
            </View>
            <View style={{ width: spacing.sm }} />
            <View style={{ flex: 1 }}>
              <FormField
                label="Wholesale"
                value={form.wholesalePrice}
                onChangeText={(wholesalePrice) => setForm((current) => ({ ...current, wholesalePrice }))}
                keyboardType="numeric"
                placeholder="Optional"
              />
            </View>
          </View>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <FormField
                label="Min wholesale qty"
                value={form.minWholesaleQuantity}
                onChangeText={(minWholesaleQuantity) => setForm((current) => ({ ...current, minWholesaleQuantity }))}
                keyboardType="numeric"
                placeholder="Optional"
              />
            </View>
            <View style={{ width: spacing.sm }} />
            <View style={{ flex: 1 }}>
              <FormField
                label="Tax %"
                value={form.taxRate}
                onChangeText={(taxRate) => setForm((current) => ({ ...current, taxRate }))}
                keyboardType="numeric"
                placeholder="0"
              />
            </View>
          </View>

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

          <Text style={styles.sectionLabel}>Item image</Text>
          <View style={{ alignItems: 'center' }}>
            <ProductImagePicker
              value={form.imageUrl}
              onChange={(url) => setForm((current) => ({ ...current, imageUrl: url }))}
              label="Add Item Image"
              size={110}
            />
          </View>
        </View>
      )}

      <CategoryPickerSheet
        visible={categoryVisible}
        selectedId={form.categoryId}
        onSelect={selectCategory}
        onClose={() => setCategoryVisible(false)}
      />
      <UnitPickerSheet
        visible={unitVisible}
        value={{
          primaryUnit: form.primaryUnit,
          primaryUnitId: form.unitId,
          secondaryUnit: form.secondaryUnit,
          conversionRate: form.conversionRate,
        }}
        onApply={applyUnit}
        onClose={() => setUnitVisible(false)}
      />
    </Screen>
  );
}

const createStyles = (colors: AppPalette) =>
  StyleSheet.create({
    section: {
      gap: spacing.md,
    },
    row: {
      flexDirection: 'row',
    },
    selectRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
    },
    unitField: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      minHeight: 58,
      justifyContent: 'center',
    },
    unitFieldRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 4,
    },
    selectLabel: {
      fontSize: typography.caption,
      color: colors.textSoft,
      fontWeight: '600',
      marginBottom: 2,
    },
    selectValue: {
      fontSize: typography.body,
      fontWeight: '700',
      flexShrink: 1,
    },
    sectionLabel: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: colors.textSoft,
      marginTop: spacing.xs,
    },
    hintRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: -spacing.xs,
    },
    hintText: {
      fontSize: typography.label,
      fontWeight: '600',
    },
    mutedNote: {
      fontSize: typography.label,
      lineHeight: 18,
    },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
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
  });
