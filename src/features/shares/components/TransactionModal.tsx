import React, { useState, useMemo, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  Pressable,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { NepseCompany } from '../lib/nepse-scrip-list';
import {
  calculateOrderDetails,
  StockHolding,
  StockTransaction,
  TransactionType,
} from '../lib/portfolio-calc';
import { todayIso } from '@/src/shared/lib/format';
import { usePalette } from '@/src/stores/theme-store';
import { useThemedStyles } from '@/src/theme/use-themed-styles';
import { radius, spacing, typography } from '@/src/theme';
import type { AppPalette } from '@/src/theme/app-palette';

interface TransactionModalProps {
  visible: boolean;
  onClose: () => void;
  companies: NepseCompany[];
  initialSymbol?: string;
  initialType?: TransactionType;
  holding?: StockHolding;
  onSave: (tx: Omit<StockTransaction, 'id' | 'createdAt'>) => Promise<void>;
}

export function TransactionModal({
  visible,
  onClose,
  companies,
  initialSymbol,
  initialType = 'BUY',
  holding,
  onSave,
}: TransactionModalProps) {
  const colors = usePalette();
  const styles = useThemedStyles(createStyles);

  const [type, setType] = useState<TransactionType>(initialType);
  const [symbol, setSymbol] = useState<string>(initialSymbol || '');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showCompanyPicker, setShowCompanyPicker] = useState<boolean>(false);
  const [units, setUnits] = useState<string>('100');
  const [price, setPrice] = useState<string>('');
  const [date, setDate] = useState<string>(todayIso());
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Sync initial parameters when opened
  useEffect(() => {
    if (visible) {
      const targetSymbol = initialSymbol || (companies[0]?.symbol ?? '');
      setSymbol(targetSymbol);
      setType(initialType);
      const company = companies.find((c) => c.symbol.toUpperCase() === targetSymbol.toUpperCase());
      if (company) {
        setPrice(company.ltp.toString());
      }
      setUnits(holding && initialType === 'SELL' ? holding.totalUnits.toString() : '100');
      setDate(todayIso());
      setShowCompanyPicker(false);
      setSearchQuery('');
    }
  }, [visible, initialSymbol, initialType, companies, holding]);

  // Selected company lookup
  const selectedCompany = useMemo(() => {
    return companies.find((c) => c.symbol.toUpperCase() === symbol.toUpperCase());
  }, [companies, symbol]);

  // Filter companies for picker
  const filteredCompanies = useMemo(() => {
    if (!searchQuery.trim()) return companies;
    const q = searchQuery.toLowerCase().trim();
    return companies.filter(
      (c) => c.symbol.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
    );
  }, [companies, searchQuery]);

  // Real-time calculation
  const parsedUnits = parseInt(units, 10) || 0;
  const parsedPrice = parseFloat(price) || 0;

  const orderCalculation = useMemo(() => {
    return calculateOrderDetails(type, parsedUnits, parsedPrice);
  }, [type, parsedUnits, parsedPrice]);

  const handleSelectCompany = (comp: NepseCompany) => {
    setSymbol(comp.symbol);
    setPrice(comp.ltp.toString());
    setShowCompanyPicker(false);
  };

  const handleSave = async () => {
    if (!symbol.trim() || parsedUnits <= 0 || parsedPrice <= 0) return;
    setIsSubmitting(true);
    try {
      await onSave({
        symbol: symbol.toUpperCase().trim(),
        type,
        units: parsedUnits,
        pricePerUnit: parsedPrice,
        totalCost: orderCalculation.totalPayableOrReceivable,
        date: date || todayIso(),
        brokerCommission: orderCalculation.brokerCommission,
        sebonFee: orderCalculation.sebonFee,
        dpFee: orderCalculation.dpFee,
        notes: notes.trim() || undefined,
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetTitle}>
                {type === 'BUY' ? 'Buy Stock (Add to Portfolio)' : 'Sell Stock'}
              </Text>
              <Text style={styles.sheetSubtitle}>NEPSE Broker & SEBON Fee Calculator Included</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
              <MaterialCommunityIcons name="close" size={22} color={colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Type Switcher */}
            <View style={styles.typeSwitcher}>
              <Pressable
                onPress={() => setType('BUY')}
                style={[
                  styles.typeBtn,
                  type === 'BUY' && { backgroundColor: colors.successSoft, borderColor: colors.success },
                ]}
              >
                <MaterialCommunityIcons
                  name="arrow-down-left"
                  size={16}
                  color={type === 'BUY' ? colors.success : colors.textMuted}
                />
                <Text
                  style={[
                    styles.typeBtnText,
                    { color: type === 'BUY' ? colors.success : colors.textMuted },
                  ]}
                >
                  BUY (Purchase)
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setType('SELL')}
                style={[
                  styles.typeBtn,
                  type === 'SELL' && { backgroundColor: colors.dangerSoft, borderColor: colors.danger },
                ]}
              >
                <MaterialCommunityIcons
                  name="arrow-up-right"
                  size={16}
                  color={type === 'SELL' ? colors.danger : colors.textMuted}
                />
                <Text
                  style={[
                    styles.typeBtnText,
                    { color: type === 'SELL' ? colors.danger : colors.textMuted },
                  ]}
                >
                  SELL
                </Text>
              </Pressable>
            </View>

            {/* Company Selector */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Stock / Scrip</Text>
              <Pressable
                onPress={() => setShowCompanyPicker(!showCompanyPicker)}
                style={styles.companySelector}
              >
                <View>
                  <Text style={styles.selectedSymbol}>
                    {selectedCompany ? selectedCompany.symbol : symbol || 'Select Stock'}
                  </Text>
                  {selectedCompany && (
                    <Text style={styles.selectedName} numberOfLines={1}>
                      {selectedCompany.name} • LTP Rs {selectedCompany.ltp}
                    </Text>
                  )}
                </View>
                <MaterialCommunityIcons
                  name={showCompanyPicker ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={colors.textMuted}
                />
              </Pressable>

              {/* Company Picker Dropdown list */}
              {showCompanyPicker && (
                <View style={styles.pickerContainer}>
                  <View style={styles.pickerSearchRow}>
                    <MaterialCommunityIcons name="magnify" size={18} color={colors.textMuted} />
                    <TextInput
                      style={styles.pickerSearchInput}
                      placeholder="Search symbol or name..."
                      placeholderTextColor={colors.textMuted}
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                      autoFocus
                    />
                  </View>
                  <ScrollView style={styles.pickerList} nestedScrollEnabled>
                    {filteredCompanies.map((comp) => (
                      <Pressable
                        key={comp.symbol}
                        onPress={() => handleSelectCompany(comp)}
                        style={styles.pickerItem}
                      >
                        <View>
                          <Text style={styles.pickerSymbol}>{comp.symbol}</Text>
                          <Text style={styles.pickerName} numberOfLines={1}>
                            {comp.name}
                          </Text>
                        </View>
                        <Text style={styles.pickerLtp}>Rs {comp.ltp}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            {/* Units & Price row */}
            <View style={styles.rowFields}>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Units (Quantity)</Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="number-pad"
                  value={units}
                  onChangeText={setUnits}
                  placeholder="e.g. 100"
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Price Per Unit (Rs)</Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="decimal-pad"
                  value={price}
                  onChangeText={setPrice}
                  placeholder="e.g. 510.0"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            </View>

            {/* Date Input */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Trade Date (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.textInput}
                value={date}
                onChangeText={setDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            {/* Live SEBON / Broker Calculation Breakdown Card */}
            <View style={styles.calcCard}>
              <Text style={styles.calcTitle}>Trade Cost Breakdown</Text>

              <View style={styles.calcRow}>
                <Text style={styles.calcLabel}>Gross Amount ({parsedUnits} × Rs {parsedPrice})</Text>
                <Text style={styles.calcVal}>Rs {orderCalculation.grossAmount.toLocaleString()}</Text>
              </View>

              <View style={styles.calcRow}>
                <Text style={styles.calcLabel}>Broker Commission</Text>
                <Text style={styles.calcVal}>+ Rs {orderCalculation.brokerCommission}</Text>
              </View>

              <View style={styles.calcRow}>
                <Text style={styles.calcLabel}>SEBON Fee (0.015%)</Text>
                <Text style={styles.calcVal}>+ Rs {orderCalculation.sebonFee}</Text>
              </View>

              <View style={styles.calcRow}>
                <Text style={styles.calcLabel}>DP Charge</Text>
                <Text style={styles.calcVal}>+ Rs {orderCalculation.dpFee}</Text>
              </View>

              <View style={styles.calcDivider} />

              <View style={styles.calcRow}>
                <Text style={styles.effectiveLabel}>Effective Cost / Share (WACC)</Text>
                <Text style={styles.effectiveVal}>Rs {orderCalculation.effectiveRate}</Text>
              </View>

              <View style={styles.calcRow}>
                <Text style={styles.totalPayableLabel}>
                  {type === 'BUY' ? 'Total Payable Amount' : 'Total Receivable Amount'}
                </Text>
                <Text
                  style={[
                    styles.totalPayableVal,
                    { color: type === 'BUY' ? colors.text : colors.success },
                  ]}
                >
                  Rs {orderCalculation.totalPayableOrReceivable.toLocaleString()}
                </Text>
              </View>
            </View>

            {/* Save Button */}
            <Pressable
              onPress={handleSave}
              disabled={isSubmitting || parsedUnits <= 0 || parsedPrice <= 0}
              style={({ pressed }) => [
                styles.saveButton,
                { backgroundColor: type === 'BUY' ? colors.primary : colors.danger },
                (isSubmitting || parsedUnits <= 0 || parsedPrice <= 0) && { opacity: 0.5 },
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={styles.saveButtonText}>
                {isSubmitting
                  ? 'Saving...'
                  : type === 'BUY'
                  ? `Confirm Buy (Rs ${orderCalculation.totalPayableOrReceivable.toLocaleString()})`
                  : `Confirm Sell (Rs ${orderCalculation.totalPayableOrReceivable.toLocaleString()})`}
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const createStyles = (colors: AppPalette) =>
  StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    sheetContainer: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: radius.lg,
      borderTopRightRadius: radius.lg,
      maxHeight: '90%',
      paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    },
    sheetHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    sheetTitle: {
      fontSize: typography.subheading,
      fontWeight: '800',
      color: colors.text,
    },
    sheetSubtitle: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 2,
    },
    closeBtn: {
      padding: 4,
    },
    scrollContent: {
      padding: spacing.md,
    },
    typeSwitcher: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    typeBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.sm + 2,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.backgroundAlt,
      gap: 6,
    },
    typeBtnText: {
      fontSize: typography.label,
      fontWeight: '700',
    },
    fieldGroup: {
      marginBottom: spacing.md,
    },
    fieldLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textMuted,
      marginBottom: spacing.xs,
    },
    companySelector: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.backgroundAlt,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
    },
    selectedSymbol: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.text,
    },
    selectedName: {
      fontSize: typography.caption,
      color: colors.textMuted,
      marginTop: 2,
    },
    pickerContainer: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      marginTop: spacing.xs,
      overflow: 'hidden',
    },
    pickerSearchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: 6,
    },
    pickerSearchInput: {
      flex: 1,
      paddingVertical: spacing.sm,
      color: colors.text,
      fontSize: 13,
    },
    pickerList: {
      maxHeight: 180,
    },
    pickerItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    pickerSymbol: {
      fontSize: typography.label,
      fontWeight: '700',
      color: colors.text,
    },
    pickerName: {
      fontSize: typography.caption,
      color: colors.textMuted,
      maxWidth: 220,
    },
    pickerLtp: {
      fontSize: typography.label,
      fontWeight: '700',
      color: colors.primary,
    },
    rowFields: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    textInput: {
      backgroundColor: colors.backgroundAlt,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
      color: colors.text,
      fontWeight: '700',
    },
    calcCard: {
      backgroundColor: colors.backgroundAlt,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      marginBottom: spacing.lg,
    },
    calcTitle: {
      fontSize: typography.label,
      fontWeight: '800',
      color: colors.text,
      marginBottom: spacing.xs + 2,
    },
    calcRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginVertical: 2,
    },
    calcLabel: {
      fontSize: 12,
      color: colors.textMuted,
    },
    calcVal: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.text,
    },
    calcDivider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: spacing.xs + 2,
    },
    effectiveLabel: {
      fontSize: 12,
      color: colors.textMuted,
      fontWeight: '600',
    },
    effectiveVal: {
      fontSize: typography.label,
      fontWeight: '800',
      color: colors.primary,
    },
    totalPayableLabel: {
      fontSize: typography.label,
      fontWeight: '800',
      color: colors.text,
      marginTop: 4,
    },
    totalPayableVal: {
      fontSize: 16,
      fontWeight: '800',
      marginTop: 4,
    },
    saveButton: {
      borderRadius: radius.lg,
      paddingVertical: spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveButtonText: {
      fontSize: typography.body,
      fontWeight: '800',
      color: '#FFFFFF',
    },
  });
