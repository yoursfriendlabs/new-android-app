import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';

import { BottomSheet } from '@/src/shared/feedback/BottomSheet';
import { Avatar } from '@/src/shared/ui/Avatar';
import { FormField } from '@/src/shared/forms/FormField';
import { PaymentMethodSelector } from '@/src/shared/forms/PaymentMethodSelector';
import { formatCurrency } from '@/src/shared/lib/format';
import { getAttachmentLabel, isImageAttachment } from '@/src/shared/lib/uploads';
import { partyInitials } from '@/src/features/parties/lib/party';
import { buildTenderOptions } from '@/src/features/pos/lib/tender';
import { computeLineTotal } from '@/src/shared/lib/totals';
import { usePalette } from '@/src/stores/theme-store';
import { radius, spacing, typography } from '@/src/theme';
import { useThemedStyles } from '@/src/theme/use-themed-styles';
import type { AppPalette } from '@/src/theme/app-palette';
import type { PosDraft } from '@/src/types/forms';
import type { BankAccount, OrderAttribute } from '@/src/types/models';

interface PosCheckoutSheetProps {
  visible: boolean;
  cafeMode?: boolean;
  value: PosDraft;
  setValue: (updater: (current: PosDraft) => PosDraft) => void;
  subTotal: number;
  taxTotal: number;
  grandTotal: number;
  banks: BankAccount[];
  orderAttributes?: OrderAttribute[];
  onClose: () => void;
  onSelectParty: () => void;
  onEditItems: () => void;
  onSave: (mode: 'save' | 'print') => void;
  onAddImage: () => void;
  onRemoveAttachment: (uri: string) => void;
}

export function PosCheckoutSheet({
  banks,
  cafeMode = false,
  grandTotal,
  onAddImage,
  onClose,
  onEditItems,
  onRemoveAttachment,
  onSave,
  onSelectParty,
  orderAttributes = [],
  setValue,
  subTotal,
  taxTotal,
  value,
  visible,
}: PosCheckoutSheetProps) {
  const colors = usePalette();
  const styles = useThemedStyles(createStyles);
  const [moreOpen, setMoreOpen] = useState(false);
  const tendered =
    value.fullyPaid && value.amountReceived <= 0 ? grandTotal : value.amountReceived;
  const changeAmount = Math.max(tendered - grandTotal, 0);
  const dueAmount = Math.max(grandTotal - tendered, 0);
  const tenderOptions = useMemo(() => buildTenderOptions(grandTotal), [grandTotal]);
  const hasMoreDetails =
    value.discount > 0 ||
    Boolean(value.notes) ||
    Boolean(value.paymentNote) ||
    value.attachments.length > 0 ||
    orderAttributes.length > 0;

  const applyTender = (amount: number, fullyPaid?: boolean) => {
    const next = Math.max(Number(amount || 0), 0);
    setValue((current) => ({
      ...current,
      fullyPaid: fullyPaid ?? (next >= grandTotal && grandTotal > 0),
      amountReceived: next,
    }));
  };

  const primaryLabel = cafeMode
    ? 'Confirm order'
    : dueAmount > 0
      ? `Save due ${formatCurrency(dueAmount)}`
      : `Charge ${formatCurrency(grandTotal)}`;

  return (
    <BottomSheet
      visible={visible}
      title="Checkout"
      subtitle="Collect payment, then save the bill."
      onClose={onClose}
      fullHeight
      footer={
        <View style={styles.footer}>
          <Pressable style={styles.secondaryButton} onPress={() => onSave('print')}>
            <MaterialCommunityIcons color={colors.primary} name="printer-outline" size={20} />
            <Text style={styles.secondaryLabel}>Save & print</Text>
          </Pressable>
          <Pressable style={styles.primaryButton} onPress={() => onSave('save')}>
            <Text style={styles.primaryLabel}>{primaryLabel}</Text>
          </Pressable>
        </View>
      }>
      <View style={styles.stack}>
        <View style={styles.hero}>
          <View>
            <Text style={styles.heroKicker}>To collect</Text>
            <Text style={styles.heroTotal}>{formatCurrency(grandTotal)}</Text>
          </View>
          <Text style={styles.heroMeta}>
            {value.items.length} {value.items.length === 1 ? 'item' : 'items'}
          </Text>
        </View>
        <View style={styles.heroBreak}>
          <Text style={styles.heroBreakText}>Subtotal {formatCurrency(subTotal)}</Text>
          {taxTotal > 0 ? <Text style={styles.heroBreakText}>VAT {formatCurrency(taxTotal)}</Text> : null}
          {value.discount > 0 ? (
            <Text style={styles.heroBreakText}>Discount -{formatCurrency(value.discount)}</Text>
          ) : null}
        </View>

        <Pressable style={styles.partyCard} onPress={onSelectParty}>
          <View style={styles.partyLead}>
            {value.party?.name ? (
              <Avatar
                uri={value.party?.avatarUrl}
                name={value.party?.name}
                size={38}
              />
            ) : (
              <View style={styles.partyAvatar}>
                <Text style={styles.partyAvatarText}>W</Text>
              </View>
            )}
            <View style={styles.partyCopy}>
              <Text style={styles.partyTitle}>{value.party?.name ?? 'Walk-in'}</Text>
              <Text style={styles.partySubtitle}>
                {value.party?.phone ?? 'Cash sale · tap to attach a customer'}
              </Text>
            </View>
          </View>
          <Text style={styles.changeLink}>{value.party ? 'Change' : 'Select'}</Text>
        </Pressable>

        <View style={styles.card}>
          <View style={styles.tenderHeader}>
            <Text style={styles.sectionKicker}>Tender</Text>
            <Pressable
              onPress={() => applyTender(0, false)}
              style={[styles.collectLater, !value.fullyPaid && tendered === 0 && styles.collectLaterActive]}>
              <Text
                style={[
                  styles.collectLaterLabel,
                  !value.fullyPaid && tendered === 0 && styles.collectLaterLabelActive,
                ]}>
                Collect later
              </Text>
            </Pressable>
          </View>

          {!value.party && !value.fullyPaid ? (
            <Text style={styles.dueHint}>Attach a customer if this should stay on credit.</Text>
          ) : null}

          <View style={styles.amountRow}>
            <Text style={styles.amountPrefix}>Rs</Text>
            <TextInput
              value={String(tendered || '')}
              onChangeText={(next) => applyTender(Number(next || 0))}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={colors.textSoft}
              style={styles.amountInput}
            />
          </View>

          <View style={styles.chipRow}>
            {tenderOptions.map((option) => {
              const selected = Math.abs(tendered - option.value) < 0.01;
              return (
                <Pressable
                  key={option.label}
                  onPress={() => applyTender(option.value)}
                  style={[styles.chip, selected && styles.chipActive]}>
                  <Text style={[styles.chipLabel, selected && styles.chipLabelActive]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {changeAmount > 0 ? (
            <View style={[styles.statusBanner, { backgroundColor: colors.successSoft }]}>
              <Text style={[styles.statusLabel, { color: colors.success }]}>Change to return</Text>
              <Text style={[styles.statusValue, { color: colors.success }]}>{formatCurrency(changeAmount)}</Text>
            </View>
          ) : dueAmount > 0 ? (
            <View style={[styles.statusBanner, { backgroundColor: colors.warningSoft }]}>
              <Text style={[styles.statusLabel, { color: colors.warning }]}>Due</Text>
              <Text style={[styles.statusValue, { color: colors.warning }]}>{formatCurrency(dueAmount)}</Text>
            </View>
          ) : (
            <Text style={[styles.settled, { color: colors.success }]}>This bill is fully settled.</Text>
          )}

          {tendered > 0 || value.fullyPaid ? (
            <PaymentMethodSelector
              value={value.paymentMethod}
              onChange={(paymentMethod) => setValue((current) => ({ ...current, paymentMethod }))}
              bankId={value.bankId}
              onBankChange={(bankId) => setValue((current) => ({ ...current, bankId }))}
            />
          ) : null}
        </View>

        <View style={styles.card}>
          <View style={styles.billHeader}>
            <Text style={styles.sectionKicker}>Bill ({value.items.length})</Text>
            <Pressable onPress={onEditItems}>
              <Text style={styles.addItems}>Add items</Text>
            </Pressable>
          </View>
          {value.items.map((item) => (
            <View key={item.productId} style={styles.billRow}>
              <Text numberOfLines={1} style={styles.billName}>
                {item.name}
                <Text style={styles.billQty}> × {item.quantity}</Text>
              </Text>
              <Text style={styles.billAmount}>{formatCurrency(computeLineTotal(item))}</Text>
            </View>
          ))}
          {!value.items.length ? <Text style={styles.emptyBill}>Go back and add items first.</Text> : null}
        </View>

        <Pressable style={styles.moreToggle} onPress={() => setMoreOpen((open) => !open)}>
          <Text style={styles.moreToggleLabel}>Discount, tax, notes & extras</Text>
          <MaterialCommunityIcons
            color={colors.textMuted}
            name={moreOpen || hasMoreDetails ? 'chevron-up' : 'chevron-down'}
            size={20}
          />
        </Pressable>

        {moreOpen || hasMoreDetails ? (
          <View style={styles.card}>
            <FormField
              label="Discount"
              value={String(value.discount || '')}
              onChangeText={(discount) => setValue((current) => ({ ...current, discount: Number(discount || 0) }))}
              keyboardType="numeric"
              placeholder="0"
            />
            
            {/* Tax / VAT controls */}
            <View style={styles.taxControlSection}>
              <View style={styles.taxRow}>
                <Text style={styles.taxLabel}>Tax / VAT Total</Text>
                <Text style={styles.taxValue}>{formatCurrency(taxTotal)}</Text>
              </View>
              <View style={styles.taxPresetsRow}>
                <Pressable
                  style={[
                    styles.taxPresetChip,
                    value.taxOverride === 0 && styles.taxPresetChipActive,
                  ]}
                  onPress={() =>
                    setValue((current) => ({
                      ...current,
                      taxOverride: 0,
                    }))
                  }>
                  <Text
                    style={[
                      styles.taxPresetLabel,
                      value.taxOverride === 0 && styles.taxPresetLabelActive,
                    ]}>
                    0% (No Tax)
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.taxPresetChip,
                    value.taxOverride !== undefined &&
                      Math.abs(value.taxOverride - Math.round(subTotal * 0.13 * 100) / 100) < 0.05 &&
                      styles.taxPresetChipActive,
                  ]}
                  onPress={() =>
                    setValue((current) => ({
                      ...current,
                      taxOverride: Math.round(subTotal * 0.13 * 100) / 100,
                    }))
                  }>
                  <Text
                    style={[
                      styles.taxPresetLabel,
                      value.taxOverride !== undefined &&
                        Math.abs(value.taxOverride - Math.round(subTotal * 0.13 * 100) / 100) < 0.05 &&
                        styles.taxPresetLabelActive,
                    ]}>
                    13% VAT
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.taxPresetChip,
                    value.taxOverride === undefined && styles.taxPresetChipActive,
                  ]}
                  onPress={() =>
                    setValue((current) => ({
                      ...current,
                      taxOverride: undefined,
                    }))
                  }>
                  <Text
                    style={[
                      styles.taxPresetLabel,
                      value.taxOverride === undefined && styles.taxPresetLabelActive,
                    ]}>
                    Item Taxes
                  </Text>
                </Pressable>
              </View>
              <FormField
                label="Custom Tax Amount (रू)"
                value={String(value.taxOverride !== undefined ? value.taxOverride : '')}
                onChangeText={(val) =>
                  setValue((current) => ({
                    ...current,
                    taxOverride: val === '' ? undefined : Number(val || 0),
                  }))
                }
                keyboardType="numeric"
                placeholder="Enter custom tax amount"
              />
            </View>

            <FormField
              label="Invoice number"
              value={value.invoiceNo}
              onChangeText={(invoiceNo) => setValue((current) => ({ ...current, invoiceNo }))}
            />
            <FormField
              label="Payment note"
              value={value.paymentNote}
              onChangeText={(paymentNote) => setValue((current) => ({ ...current, paymentNote }))}
            />
            <FormField
              label="Notes"
              value={value.notes}
              onChangeText={(notes) => setValue((current) => ({ ...current, notes }))}
              multiline
              placeholder="Notes or remarks"
            />
            <Pressable style={styles.addImages} onPress={onAddImage}>
              <MaterialCommunityIcons color={colors.primary} name="image-plus-outline" size={20} />
              <Text style={styles.addImagesLabel}>
                Add images{value.attachments.length ? ` (${value.attachments.length})` : ''}
              </Text>
            </Pressable>
            {value.attachments.length ? (
              <View style={styles.attachments}>
                {value.attachments.map((attachment) => (
                  <View key={attachment} style={styles.attachmentCard}>
                    {isImageAttachment(attachment) ? (
                      <Image source={{ uri: attachment }} style={styles.attachmentPreview} />
                    ) : (
                      <View style={styles.attachmentFallback}>
                        <MaterialCommunityIcons color={colors.textMuted} name="file-outline" size={20} />
                      </View>
                    )}
                    <Text numberOfLines={1} style={styles.attachmentName}>
                      {getAttachmentLabel(attachment)}
                    </Text>
                    <Pressable onPress={() => onRemoveAttachment(attachment)}>
                      <MaterialCommunityIcons color={colors.danger} name="close-circle" size={18} />
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}
            {orderAttributes.map((attribute) => (
              <FormField
                key={attribute.id || attribute.key}
                label={attribute.required ? `${attribute.label} *` : attribute.label}
                value={String(value.attributes[attribute.key] ?? '')}
                onChangeText={(nextValue) =>
                  setValue((current) => ({
                    ...current,
                    attributes: { ...current.attributes, [attribute.key]: nextValue },
                  }))
                }
                keyboardType={attribute.fieldType === 'number' ? 'numeric' : 'default'}
                multiline={attribute.fieldType === 'textarea'}
                placeholder={attribute.placeholder}
              />
            ))}
          </View>
        ) : null}
      </View>
    </BottomSheet>
  );
}

const createStyles = (colors: AppPalette) =>
  StyleSheet.create({
    stack: { gap: spacing.md, paddingBottom: spacing.lg },
    hero: {
      backgroundColor: colors.primary,
      borderRadius: radius.lg,
      padding: spacing.md,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
    },
    heroKicker: {
      color: colors.onPrimary,
      opacity: 0.8,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    heroTotal: { color: colors.onPrimary, fontSize: 28, fontWeight: '800', marginTop: 4 },
    heroMeta: { color: colors.onPrimary, opacity: 0.85, fontSize: typography.caption, fontWeight: '700' },
    heroBreak: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: -spacing.sm },
    heroBreakText: { color: colors.textMuted, fontSize: typography.caption, fontWeight: '600' },
    partyCard: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      padding: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    partyLead: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    partyAvatar: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    partyAvatarText: { color: colors.primary, fontWeight: '800' },
    partyCopy: { flex: 1 },
    partyTitle: { color: colors.text, fontWeight: '700', fontSize: typography.body },
    partySubtitle: { color: colors.textMuted, fontSize: typography.caption, marginTop: 2 },
    changeLink: { color: colors.primary, fontWeight: '800', fontSize: typography.caption },
    card: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      padding: spacing.md,
      gap: spacing.sm,
    },
    tenderHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    sectionKicker: {
      color: colors.textSoft,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.7,
      textTransform: 'uppercase',
    },
    collectLater: {
      borderRadius: radius.pill,
      backgroundColor: colors.backgroundAlt,
      paddingHorizontal: spacing.sm,
      paddingVertical: 6,
    },
    collectLaterActive: { backgroundColor: colors.warningSoft },
    collectLaterLabel: { color: colors.textMuted, fontSize: typography.caption, fontWeight: '800' },
    collectLaterLabelActive: { color: colors.warning },
    dueHint: { color: colors.warning, fontSize: typography.caption, fontWeight: '600' },
    amountRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      backgroundColor: colors.backgroundAlt,
      paddingHorizontal: spacing.md,
      minHeight: 52,
    },
    amountPrefix: { color: colors.textMuted, fontWeight: '800', marginRight: spacing.sm },
    amountInput: {
      flex: 1,
      color: colors.text,
      fontSize: typography.heading,
      fontWeight: '800',
      paddingVertical: spacing.sm,
    },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
    chip: {
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.backgroundAlt,
      paddingHorizontal: spacing.sm,
      paddingVertical: 8,
    },
    chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    chipLabel: { color: colors.text, fontSize: typography.caption, fontWeight: '800' },
    chipLabelActive: { color: colors.onPrimary },
    statusBanner: {
      borderRadius: radius.md,
      padding: spacing.md,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    statusLabel: { fontWeight: '700', fontSize: typography.body },
    statusValue: { fontWeight: '800', fontSize: typography.heading },
    settled: { fontSize: typography.caption, fontWeight: '700' },
    bankWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
    bankChip: {
      borderRadius: radius.pill,
      backgroundColor: colors.backgroundAlt,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    bankChipActive: { backgroundColor: colors.primary },
    bankChipLabel: { color: colors.text, fontWeight: '700' },
    bankChipLabelActive: { color: colors.onPrimary },
    emptyBank: {
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.border,
      borderRadius: radius.md,
      padding: spacing.md,
    },
    emptyBankText: { color: colors.textMuted, fontSize: typography.caption },
    billHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    addItems: { color: colors.primary, fontWeight: '800', fontSize: typography.caption },
    billRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
    billName: { flex: 1, color: colors.text, fontWeight: '700' },
    billQty: { color: colors.textMuted, fontWeight: '600' },
    billAmount: { color: colors.text, fontWeight: '800' },
    emptyBill: { color: colors.textMuted, fontSize: typography.caption },
    moreToggle: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.backgroundAlt,
      borderRadius: radius.md,
      padding: spacing.md,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    moreToggleLabel: { color: colors.text, fontWeight: '700' },
    taxControlSection: {
      gap: spacing.xs,
      paddingVertical: spacing.xs,
    },
    taxPresetsRow: {
      flexDirection: 'row',
      gap: spacing.xs,
    },
    taxPresetChip: {
      flex: 1,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.backgroundAlt,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 34,
    },
    taxPresetChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    taxPresetLabel: {
      fontSize: typography.caption,
      fontWeight: '700',
      color: colors.text,
    },
    taxPresetLabelActive: {
      color: colors.white,
    },
    taxRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs },
    taxLabel: { color: colors.textMuted, fontWeight: '700' },
    taxValue: { color: colors.text, fontWeight: '800' },
    addImages: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.xs },
    addImagesLabel: { color: colors.primary, fontWeight: '700' },
    attachments: { gap: spacing.sm },
    attachmentCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    attachmentPreview: { width: 40, height: 40, borderRadius: 8 },
    attachmentFallback: {
      width: 40,
      height: 40,
      borderRadius: 8,
      backgroundColor: colors.backgroundAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    attachmentName: { flex: 1, color: colors.textMuted, fontSize: typography.caption },
    footer: { flexDirection: 'row', gap: spacing.sm },
    secondaryButton: {
      minHeight: 52,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: spacing.xs,
    },
    primaryButton: {
      flex: 1,
      minHeight: 52,
      borderRadius: radius.md,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.md,
    },
    secondaryLabel: { color: colors.text, fontWeight: '800' },
    primaryLabel: { color: colors.onPrimary, fontWeight: '800', fontSize: typography.body },
  });
