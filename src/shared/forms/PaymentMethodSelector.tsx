import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';

import { usePalette } from '@/src/stores/theme-store';
import { useThemedStyles } from '@/src/theme/use-themed-styles';
import { radius, spacing, typography } from '@/src/theme';
import type { AppPalette } from '@/src/theme/app-palette';
import { useBanks } from '@/src/shared/hooks/useAppQueries';
import { formatCurrency } from '@/src/shared/lib/format';
import { useAuthStore } from '@/src/stores/auth-store';
import type { BankAccount, PaymentMethod } from '@/src/types/models';

export interface PaymentMethodSelectorProps {
  value: PaymentMethod;
  onChange: (value: PaymentMethod, bankId?: string) => void;
  bankId?: string;
  onBankChange?: (bankId: string) => void;
  activeBackgroundColor?: string;
  activeTextColor?: string;
  inactiveBackgroundColor?: string;
  inactiveTextColor?: string;
  showBalances?: boolean;
  layout?: 'horizontal' | 'grid';
}

function getAccountVisual(name: string, colors: AppPalette) {
  const normalized = (name || '').toLowerCase();
  if (normalized.includes('cash')) {
    return {
      icon: 'cash' as const,
      color: colors.success,
      bg: colors.successSoft,
      type: 'cash' as const,
    };
  }
  if (
    normalized.includes('esewa') ||
    normalized.includes('khalti') ||
    normalized.includes('ime') ||
    normalized.includes('wallet') ||
    normalized.includes('pay')
  ) {
    return {
      icon: 'wallet-outline' as const,
      color: colors.warning,
      bg: colors.warningSoft,
      type: 'wallet' as const,
    };
  }
  return {
    icon: 'bank-outline' as const,
    color: colors.primary,
    bg: colors.accentSoft,
    type: 'bank' as const,
  };
}

export function PaymentMethodSelector({
  value,
  onChange,
  bankId,
  onBankChange,
  activeBackgroundColor,
  activeTextColor,
  inactiveBackgroundColor,
  inactiveTextColor,
  showBalances = true,
  layout = 'horizontal',
}: PaymentMethodSelectorProps) {
  const colors = usePalette();
  const styles = useThemedStyles(createStyles);
  const currency = useAuthStore((state) => state.businessProfile?.currencyCode) || 'NPR';
  const { data: banksData } = useBanks();

  const activeAccounts = useMemo(
    () => (banksData ?? []).filter((b) => b.isActive),
    [banksData]
  );

  // If there's an active bank and none is selected yet, default to first bank when value is 'bank'
  const selectedBankId = bankId || (value === 'bank' && activeAccounts.length ? activeAccounts[0].id : '');

  const handleSelectCash = () => {
    onChange('cash', undefined);
    onBankChange?.('');
  };

  const handleSelectAccount = (account: BankAccount) => {
    onChange('bank', account.id);
    onBankChange?.(account.id);
  };

  const isCashActive = value === 'cash';

  const renderCashOption = () => (
    <Pressable
      key="cash-account"
      style={[
        styles.accountCard,
        layout === 'grid' && styles.accountCardGrid,
        isCashActive
          ? {
              backgroundColor: activeBackgroundColor ?? colors.accentSoft,
              borderColor: colors.primary,
              borderWidth: 2,
            }
          : {
              backgroundColor: inactiveBackgroundColor ?? colors.surface,
              borderColor: colors.border,
              borderWidth: 1,
            },
      ]}
      onPress={handleSelectCash}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.iconWrap, { backgroundColor: colors.successSoft }]}>
          <MaterialCommunityIcons name="cash" size={18} color={colors.success} />
        </View>
        <View style={styles.cardTexts}>
          <Text
            numberOfLines={1}
            style={[
              styles.accountName,
              { color: isCashActive ? (activeTextColor ?? colors.primary) : (inactiveTextColor ?? colors.text) },
              isCashActive && { fontWeight: '800' },
            ]}
          >
            Cash
          </Text>
          <Text style={[styles.accountMeta, { color: colors.textMuted }]}>Cash in Hand</Text>
        </View>
      </View>

      {showBalances && (
        <View style={styles.balanceRow}>
          <Text style={[styles.balanceLabel, { color: colors.textMuted }]}>Instant Cash</Text>
        </View>
      )}
    </Pressable>
  );

  const renderAccountOption = (account: BankAccount) => {
    const isSelected = value === 'bank' && selectedBankId === account.id;
    const visual = getAccountVisual(account.name, colors);

    return (
      <Pressable
        key={account.id}
        style={[
          styles.accountCard,
          layout === 'grid' && styles.accountCardGrid,
          isSelected
            ? {
                backgroundColor: activeBackgroundColor ?? colors.accentSoft,
                borderColor: colors.primary,
                borderWidth: 2,
              }
            : {
                backgroundColor: inactiveBackgroundColor ?? colors.surface,
                borderColor: colors.border,
                borderWidth: 1,
              },
        ]}
        onPress={() => handleSelectAccount(account)}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.iconWrap, { backgroundColor: visual.bg }]}>
            <MaterialCommunityIcons name={visual.icon} size={18} color={visual.color} />
          </View>
          <View style={styles.cardTexts}>
            <Text
              numberOfLines={1}
              style={[
                styles.accountName,
                { color: isSelected ? (activeTextColor ?? colors.primary) : (inactiveTextColor ?? colors.text) },
                isSelected && { fontWeight: '800' },
              ]}
            >
              {account.name}
            </Text>
            <Text numberOfLines={1} style={[styles.accountMeta, { color: colors.textMuted }]}>
              {account.accountNumber ? `•••• ${String(account.accountNumber).slice(-4)}` : visual.type === 'wallet' ? 'Wallet' : 'Bank Account'}
            </Text>
          </View>
        </View>

        {showBalances && (
          <View style={styles.balanceRow}>
            <Text style={[styles.balanceLabel, { color: colors.textMuted }]}>Bal: </Text>
            <Text style={[styles.balanceVal, { color: colors.text }]}>
              {formatCurrency(account.currentBalance ?? 0, currency)}
            </Text>
          </View>
        )}
      </Pressable>
    );
  };

  const renderAddAccountBtn = () => (
    <Pressable
      key="add-account-btn"
      style={[
        styles.addAccountCard,
        layout === 'grid' && styles.accountCardGrid,
        { borderColor: colors.border, backgroundColor: colors.backgroundAlt },
      ]}
      onPress={() => router.push('/(app)/banks' as never)}
    >
      <MaterialCommunityIcons name="plus-circle-outline" size={20} color={colors.primary} />
      <Text style={[styles.addAccountLabel, { color: colors.primary }]}>+ Add Bank / Wallet</Text>
    </Pressable>
  );

  if (layout === 'grid') {
    return (
      <View style={styles.gridContainer}>
        {renderCashOption()}
        {activeAccounts.map(renderAccountOption)}
        {renderAddAccountBtn()}
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.scrollContainer}
    >
      {renderCashOption()}
      {activeAccounts.map(renderAccountOption)}
      {renderAddAccountBtn()}
    </ScrollView>
  );
}

const createStyles = (colors: AppPalette) =>
  StyleSheet.create({
    scrollContainer: {
      flexDirection: 'row',
      gap: spacing.xs + 2,
      paddingVertical: spacing.xs,
    },
    gridContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs + 2,
      paddingVertical: spacing.xs,
    },
    accountCard: {
      minWidth: 140,
      borderRadius: radius.md,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs + 2,
      justifyContent: 'center',
    },
    accountCardGrid: {
      width: '48%',
      minWidth: 0,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    iconWrap: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardTexts: {
      flex: 1,
    },
    accountName: {
      fontSize: typography.label,
      fontWeight: '700',
    },
    accountMeta: {
      fontSize: 10,
      marginTop: 1,
    },
    balanceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 6,
      paddingTop: 4,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    balanceLabel: {
      fontSize: 10,
      fontWeight: '600',
    },
    balanceVal: {
      fontSize: 11,
      fontWeight: '800',
    },
    addAccountCard: {
      minWidth: 120,
      borderRadius: radius.md,
      borderWidth: 1,
      borderStyle: 'dashed',
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs + 2,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
    },
    addAccountLabel: {
      fontSize: 11,
      fontWeight: '700',
    },
  });
