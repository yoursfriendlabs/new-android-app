import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { PartyPickerSheet } from '@/src/shared/forms/PartyPickerSheet';
import { Screen } from '@/src/shared/layout/Screen';
import { EmptyState } from '@/src/shared/ui/EmptyState';
import { SegmentedTabs } from '@/src/shared/ui/SegmentedTabs';
import { StickyActionBar } from '@/src/shared/ui/StickyActionBar';
import { Avatar } from '@/src/shared/ui/Avatar';
import { DatePeriod, formatCurrency, getRangeForPeriod, prettyDate } from '@/src/shared/lib/format';
import { useDebouncedValue } from '@/src/shared/hooks/useDebouncedValue';
import { useLedger, useParties, usePartyTransactions, usePurchases } from '@/src/shared/hooks/useAppQueries';
import { buildLedgerReportHtml, printHtmlDocument, shareHtmlAsPdf } from '@/src/shared/lib/report-pdf';
import { openReceiptPreview, type ReceiptInput } from '@/src/shared/lib/receipt';
import { radius, shadows, spacing, typography } from '@/src/theme';
import type { LedgerEntry, Party, PartyTransaction, Purchase } from '@/src/types/models';
import { isPersonalWorkspace } from '@/src/shared/lib/business';
import {
  getBalanceColor,
  getBalanceSoftColor,
  getPartyBalanceMeta,
  getPartyWhatsAppUrl,
  partyInitials,
  partyTypeLabel,
} from '@/src/features/parties/lib/party';
import { expenseCategory, isInCurrentMonth } from '@/src/features/money/lib/expense';
import { useAuthStore } from '@/src/stores/auth-store';
import { usePalette } from '@/src/stores/theme-store';
import { useThemedStyles } from '@/src/theme/use-themed-styles';
import type { AppPalette } from '@/src/theme/app-palette';

type LedgerPeriod = Extract<DatePeriod, 'this_month' | 'this_year'> | 'all';

function isDateInPeriod(dateStr?: string, period?: LedgerPeriod) {
  if (!dateStr || period === 'all') return true;
  const d = dateStr.slice(0, 10);
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const currentYear = `${now.getFullYear()}`;
  if (period === 'this_month') return d.startsWith(currentMonth);
  if (period === 'this_year') return d.startsWith(currentYear);
  return true;
}

function getEntryIcon(refType: string) {
  const type = refType.toLowerCase();
  if (type.includes('payment_in') || type.includes('receive') || type.includes('income')) {
    return { name: 'arrow-bottom-left' as const, tone: 'success' as const };
  }
  if (type.includes('payment_out') || type.includes('paid') || type.includes('give')) {
    return { name: 'arrow-top-right' as const, tone: 'danger' as const };
  }
  if (type.includes('sale')) {
    return { name: 'receipt-outline' as const, tone: 'info' as const };
  }
  if (type.includes('purchase')) {
    return { name: 'cart-outline' as const, tone: 'warning' as const };
  }
  if (type.includes('expense')) {
    return { name: 'wallet-outline' as const, tone: 'danger' as const };
  }
  return { name: 'swap-horizontal' as const, tone: 'neutral' as const };
}

export default function LedgerScreen() {
  const colors = usePalette();
  const styles = useThemedStyles(createStyles);
  const currency = useAuthStore((state) => state.businessProfile?.currencyCode) || 'NPR';
  const businessName = useAuthStore((state) => state.businessProfile?.businessName) || 'PM';
  const businessProfile = useAuthStore((state) => state.businessProfile);
  const personal = isPersonalWorkspace({
    businessType: String(businessProfile?.businessType ?? ''),
  });
  const [period, setPeriod] = useState<LedgerPeriod>('this_month');
  const [partySearch, setPartySearch] = useState('');
  const [pickerVisible, setPickerVisible] = useState(false);
  const [selectedParty, setSelectedParty] = useState<Party | null>(null);
  const [exporting, setExporting] = useState(false);
  const debouncedPartySearch = useDebouncedValue(partySearch);
  const { data: parties } = useParties(debouncedPartySearch, 'both');
  const range = period === 'all' ? undefined : getRangeForPeriod(period);

  const ledgerQuery = useLedger(selectedParty?.id, range);
  const personalTxQuery = usePartyTransactions(selectedParty?.id);
  const personalExpensesQuery = usePurchases('expense');

  const partyById = useMemo(() => {
    return new Map((parties ?? []).map((party) => [party.id, party]));
  }, [parties]);

  const rawLedgerEntries = ledgerQuery.data ?? [];

  const entries = useMemo<LedgerEntry[]>(() => {
    if (rawLedgerEntries.length > 0) {
      return rawLedgerEntries.filter((e) => isDateInPeriod(e.entryDate, period));
    }

    // Fallback synthesis for personal workspace or empty server ledger
    const partyTx = (personalTxQuery.data ?? []).filter((tx) => {
      if (selectedParty && tx.partyId !== selectedParty.id) return false;
      return isDateInPeriod(tx.txDate, period);
    });

    const expenses = (personalExpensesQuery.data ?? []).filter((exp) => {
      if (selectedParty && exp.partyId !== selectedParty.id) return false;
      return isDateInPeriod(exp.purchaseDate, period);
    });

    const synthesized: LedgerEntry[] = [
      ...partyTx.map((tx) => {
        const party = partyById.get(tx.partyId);
        const isReceive = tx.direction === 'receive';
        return {
          id: `tx-${tx.id}`,
          partyId: tx.partyId,
          partyName: party?.name || '',
          refType: isReceive ? 'payment_in' : 'payment_out',
          refNo: '',
          entryDate: String(tx.txDate || tx.createdAt || ''),
          description: tx.note || (isReceive ? 'Income / Payment In' : 'Payment Out'),
          debit: isReceive ? 0 : Number(tx.amount || 0),
          credit: isReceive ? Number(tx.amount || 0) : 0,
          runningBalance: undefined,
        };
      }),
      ...expenses.map((exp) => {
        const amt = Number(exp.grandTotal || (exp as any).amount || 0);
        return {
          id: `exp-${exp.id}`,
          partyId: exp.partyId || '',
          partyName: exp.partyName || (exp.partyId ? partyById.get(exp.partyId)?.name : '') || '',
          refType: 'expense',
          refNo: exp.invoiceNo || '',
          entryDate: String(exp.purchaseDate || exp.createdAt || ''),
          description: exp.notes || expenseCategory(exp),
          debit: amt,
          credit: 0,
          runningBalance: undefined,
        };
      }),
    ];

    return synthesized.sort((a, b) => String(b.entryDate).localeCompare(String(a.entryDate)));
  }, [
    rawLedgerEntries,
    personalTxQuery.data,
    personalExpensesQuery.data,
    selectedParty,
    period,
    partyById,
  ]);

  const totals = useMemo(() => {
    return entries.reduce(
      (acc, entry) => {
        const d = Number(entry.debit || 0);
        const c = Number(entry.credit || 0);
        const rawAmt = Number((entry as any).amount || (entry as any).grandTotal || (entry as any).total || 0);
        const typeLower = String(entry.refType || '').toLowerCase();
        const isExp =
          typeLower.includes('expense') ||
          typeLower.includes('purchase') ||
          typeLower.includes('out') ||
          typeLower.includes('give') ||
          typeLower.includes('payment_out');

        if (d > 0) {
          acc.debit += d;
        } else if (isExp && rawAmt > 0) {
          acc.debit += rawAmt;
        }

        if (c > 0) {
          acc.credit += c;
        } else if (!isExp && rawAmt > 0) {
          acc.credit += rawAmt;
        }
        return acc;
      },
      { debit: 0, credit: 0 },
    );
  }, [entries]);

  const latestBalance = entries[0]?.runningBalance ?? entries[entries.length - 1]?.runningBalance ?? 0;
  const net = totals.credit - totals.debit;

  const partyBalanceMeta = selectedParty ? getPartyBalanceMeta(selectedParty, undefined, personal) : null;
  const partyToneColor = partyBalanceMeta ? getBalanceColor(partyBalanceMeta.tone, colors) : colors.text;
  const partyToneSoft = partyBalanceMeta ? getBalanceSoftColor(partyBalanceMeta.tone, colors) : colors.surface;
  const whatsappUrl = selectedParty
    ? getPartyWhatsAppUrl(selectedParty, partyBalanceMeta?.tone === 'receive' ? partyBalanceMeta.absoluteAmount : 0)
    : '';

  function reportHtml() {
    return buildLedgerReportHtml({
      businessName,
      partyName: selectedParty?.name,
      from: range?.from,
      to: range?.to,
      currency,
      entries,
      totalDebit: totals.debit,
      totalCredit: totals.credit,
    });
  }

  async function handlePrint() {
    try {
      setExporting(true);
      await printHtmlDocument(reportHtml());
    } catch (error) {
      Alert.alert('Unable to print', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setExporting(false);
    }
  }

  async function handleShare() {
    try {
      setExporting(true);
      await shareHtmlAsPdf(reportHtml(), personal ? 'Share history PDF' : 'Share ledger PDF');
    } catch (error) {
      Alert.alert('Unable to share', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setExporting(false);
    }
  }

  function handleBillPreview() {
    const lines = entries.map((entry) => {
      const amount = Number(entry.credit || entry.debit || 0);
      const direction = Number(entry.credit || 0) > 0 ? 'Credit' : 'Debit';
      const desc = `${prettyDate(entry.entryDate)} · ${entry.refNo || entry.description || 'Entry'} (${direction})`;
      return {
        name: desc,
        quantity: 1,
        unitPrice: amount,
        lineTotal: amount,
      };
    });
    const html = reportHtml();
    const input: ReceiptInput = {
      heading: selectedParty?.name ? `STATEMENT - ${selectedParty.name}` : personal ? 'TRANSACTION HISTORY STATEMENT' : 'ACCOUNT LEDGER STATEMENT',
      reference: `STMT-${Date.now().toString().slice(-6)}`,
      date: new Date().toISOString(),
      dateLabel: 'Statement Date',
      partyName: selectedParty?.name,
      partyPhone: selectedParty?.phone ? String(selectedParty.phone) : undefined,
      notes: `${personal ? 'In' : 'Credit'}: ${formatCurrency(totals.credit, currency)} · ${personal ? 'Out' : 'Debit'}: ${formatCurrency(totals.debit, currency)} · Net: ${formatCurrency(net, currency)}`,
      lines,
      subTotal: totals.debit + totals.credit,
      taxTotal: 0,
      discountTotal: 0,
      grandTotal: totals.debit + totals.credit,
      amountReceived: totals.credit,
    };
    openReceiptPreview(router, input, html);
  }

  async function handleRefresh() {
    await Promise.all([
      ledgerQuery.refetch(),
      personalTxQuery.refetch(),
      personalExpensesQuery.refetch(),
    ]);
  }

  const isLoading = ledgerQuery.isLoading && !entries.length;

  return (
    <Screen
      scrollable={false}
      padded={false}
      topBarTitle={personal ? 'History' : 'Ledger'}
      topBarRight={
        <View style={styles.headerRightActions}>
          <Pressable onPress={handleBillPreview} hitSlop={8} style={styles.headerIcon}>
            <MaterialCommunityIcons color={colors.text} name="printer-outline" size={22} />
          </Pressable>
          <Pressable onPress={() => void handleShare()} hitSlop={8} style={styles.headerIcon} disabled={exporting}>
            {exporting ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <MaterialCommunityIcons color={colors.text} name="share-variant-outline" size={22} />
            )}
          </Pressable>
        </View>
      }
      footer={
        <StickyActionBar
          secondary={{ label: 'Share PDF', onPress: () => void handleShare() }}
          primary={{ label: 'Bill / Print', onPress: handleBillPreview }}
        />
      }>
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={ledgerQuery.isRefetching || personalTxQuery.isRefetching} onRefresh={() => void handleRefresh()} />
        }
        contentContainerStyle={styles.scroll}>
        
        {/* Period tabs */}
        <SegmentedTabs
          value={period}
          onChange={setPeriod}
          options={[
            { label: 'This month', value: 'this_month' },
            { label: 'This year', value: 'this_year' },
            { label: 'All time', value: 'all' },
          ]}
        />

        {/* Contact / Party selector card */}
        <Pressable
          onPress={() => setPickerVisible(true)}
          style={[styles.filterCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Avatar
            name={selectedParty?.name || (personal ? 'All Contacts' : 'All Parties')}
            uri={selectedParty?.photoUrl || selectedParty?.avatarUrl}
            size={38}
          />
          <View style={styles.filterCopy}>
            <Text style={[styles.filterLabel, { color: colors.textSoft }]}>
              {personal ? 'Contact' : 'Party'}
            </Text>
            <Text style={[styles.filterValue, { color: colors.text }]} numberOfLines={1}>
              {selectedParty?.name ?? (personal ? 'All contacts' : 'All parties')}
            </Text>
          </View>
          {selectedParty ? (
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                setSelectedParty(null);
              }}
              hitSlop={8}
              style={[styles.clearBtn, { backgroundColor: colors.backgroundAlt }]}>
              <MaterialCommunityIcons name="close" size={14} color={colors.textMuted} />
              <Text style={[styles.clearText, { color: colors.textMuted }]}>Clear</Text>
            </Pressable>
          ) : (
            <MaterialCommunityIcons name="chevron-down" size={20} color={colors.textMuted} />
          )}
        </Pressable>

        {/* Selected Party detail banner if selected */}
        {selectedParty && partyBalanceMeta ? (
          <View style={[styles.partyBanner, { backgroundColor: partyToneSoft, borderColor: colors.border }]}>
            <View style={styles.partyBannerLeft}>
              <Text style={[styles.partyBannerTitle, { color: colors.text }]}>
                {partyTypeLabel(selectedParty.type, personal)}
              </Text>
              <Text style={[styles.partyBalanceText, { color: partyToneColor }]}>
                {partyBalanceMeta.label}
              </Text>
            </View>
            <View style={styles.partyBannerActions}>
              {selectedParty.phone ? (
                <Pressable
                  onPress={() => void Linking.openURL(`tel:${selectedParty.phone}`)}
                  style={[styles.quickActionBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <MaterialCommunityIcons name="phone-outline" size={18} color={colors.primary} />
                </Pressable>
              ) : null}
              {whatsappUrl ? (
                <Pressable
                  onPress={() => void Linking.openURL(whatsappUrl)}
                  style={[styles.quickActionBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <MaterialCommunityIcons name="whatsapp" size={18} color={colors.success} />
                </Pressable>
              ) : null}
              <Pressable
                onPress={() => router.push(`/(app)/parties/${selectedParty.id}` as any)}
                style={[styles.quickActionBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <MaterialCommunityIcons name="open-in-new" size={18} color={colors.text} />
              </Pressable>
            </View>
          </View>
        ) : null}

        {/* Summary Metrics */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { backgroundColor: colors.successSoft, borderColor: colors.border }]}>
            <View style={styles.summaryCardHeader}>
              <Text style={[styles.summaryLabel, { color: colors.success }]}>
                {personal ? 'Money In' : 'Credit'}
              </Text>
              <MaterialCommunityIcons name="arrow-bottom-left" size={16} color={colors.success} />
            </View>
            <Text style={[styles.summaryValue, { color: colors.success }]}>
              {formatCurrency(totals.credit, currency)}
            </Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: colors.dangerSoft, borderColor: colors.border }]}>
            <View style={styles.summaryCardHeader}>
              <Text style={[styles.summaryLabel, { color: colors.danger }]}>
                {personal ? 'Money Out' : 'Debit'}
              </Text>
              <MaterialCommunityIcons name="arrow-top-right" size={16} color={colors.danger} />
            </View>
            <Text style={[styles.summaryValue, { color: colors.danger }]}>
              {formatCurrency(totals.debit, currency)}
            </Text>
          </View>
        </View>

        <View style={[styles.netCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View>
            <Text style={[styles.netLabel, { color: colors.textSoft }]}>Net movement</Text>
            <Text style={[styles.netValue, { color: net >= 0 ? colors.success : colors.danger }]}>
              {net >= 0 ? '+' : ''}{formatCurrency(net, currency)}
            </Text>
          </View>
          <View style={styles.netSide}>
            <Text style={[styles.netLabel, { color: colors.textSoft }]}>
              {selectedParty ? 'Balance' : 'Total Entries'}
            </Text>
            <Text style={[styles.netValue, { color: colors.text }]}>
              {selectedParty
                ? formatCurrency(Number(latestBalance || 0), currency)
                : `${entries.length} items`}
            </Text>
          </View>
        </View>

        {isLoading ? (
          <View style={styles.empty}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        ) : null}

        {!isLoading && !entries.length ? (
          <EmptyState
            title="No records found"
            message={
              selectedParty
                ? `No transactions recorded for ${selectedParty.name} in this period.`
                : personal
                  ? 'All income, expenses, and contact payments will appear here.'
                  : 'Sales, purchases, and ledger entries will appear here.'
            }
          />
        ) : null}

        {/* Entries list */}
        <View style={styles.list}>
          {entries.map((entry) => {
            const debit = Number(entry.debit || 0);
            const credit = Number(entry.credit || 0);
            const rawAmt = Number((entry as any).amount || (entry as any).grandTotal || (entry as any).total || 0);
            const typeLower = String(entry.refType || '').toLowerCase();
            const isExpenseOrOut =
              typeLower.includes('expense') ||
              typeLower.includes('purchase') ||
              typeLower.includes('out') ||
              typeLower.includes('give') ||
              typeLower.includes('payment_out') ||
              debit > credit;

            const isIncomeOrIn =
              typeLower.includes('income') ||
              typeLower.includes('sale') ||
              typeLower.includes('in') ||
              typeLower.includes('receive') ||
              typeLower.includes('payment_in') ||
              credit > debit;

            const isCredit = isIncomeOrIn || (!isExpenseOrOut && credit > 0);
            const amount = credit > 0 ? credit : debit > 0 ? debit : rawAmt;
            const iconMeta = getEntryIcon(entry.refType || (isCredit ? 'payment_in' : 'payment_out'));

            const iconBg =
              iconMeta.tone === 'success'
                ? colors.successSoft
                : iconMeta.tone === 'danger'
                  ? colors.dangerSoft
                  : iconMeta.tone === 'info'
                    ? colors.infoSoft
                    : iconMeta.tone === 'warning'
                      ? colors.warningSoft
                      : colors.backgroundAlt;

            const iconFg =
              iconMeta.tone === 'success'
                ? colors.success
                : iconMeta.tone === 'danger'
                  ? colors.danger
                  : iconMeta.tone === 'info'
                    ? colors.info
                    : iconMeta.tone === 'warning'
                      ? colors.warning
                      : colors.textMuted;

            return (
              <View
                key={entry.id}
                style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.rowIconCircle, { backgroundColor: iconBg }]}>
                  <MaterialCommunityIcons name={iconMeta.name} size={18} color={iconFg} />
                </View>
                <View style={styles.copy}>
                  <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
                    {entry.description || entry.refNo || 'Transaction'}
                  </Text>
                  <Text style={[styles.meta, { color: colors.textMuted }]}>
                    {[
                      prettyDate(entry.entryDate),
                      entry.partyName || (selectedParty ? undefined : ''),
                      entry.refNo ? `#${entry.refNo}` : undefined,
                    ]
                      .filter(Boolean)
                      .join('  ·  ')}
                  </Text>
                </View>
                <View style={styles.side}>
                  <Text style={[styles.value, { color: isCredit ? colors.success : colors.danger }]}>
                    {isCredit ? '+' : '-'}{formatCurrency(amount, currency)}
                  </Text>
                  {typeof entry.runningBalance === 'number' ? (
                    <Text style={[styles.runningBalance, { color: colors.textSoft }]}>
                      Bal {formatCurrency(entry.runningBalance, currency)}
                    </Text>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      <PartyPickerSheet
        visible={pickerVisible}
        search={partySearch}
        onSearchChange={setPartySearch}
        parties={parties ?? []}
        allowWalkIn={false}
        title={personal ? 'Filter by contact' : 'Filter by party'}
        subtitle={personal ? 'Show one contact, or view everyone.' : 'Show one statement, or view all parties.'}
        typeLabel={(party) => partyTypeLabel(party.type, personal)}
        onPick={(party) => {
          setSelectedParty(party);
          setPickerVisible(false);
        }}
        onClose={() => setPickerVisible(false)}
      />
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
    headerRightActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    headerIcon: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    filterCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderRadius: radius.lg,
      borderWidth: 1,
      padding: spacing.sm + 2,
      ...shadows.card,
    },
    filterCopy: {
      flex: 1,
      gap: 2,
    },
    filterLabel: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    filterValue: {
      fontSize: typography.body,
      fontWeight: '700',
    },
    clearBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.sm,
      paddingVertical: 6,
    },
    clearText: {
      fontSize: typography.caption,
      fontWeight: '700',
    },
    partyBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderRadius: radius.md,
      borderWidth: 1,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    partyBannerLeft: {
      flex: 1,
      gap: 2,
    },
    partyBannerTitle: {
      fontSize: typography.caption,
      fontWeight: '600',
      textTransform: 'capitalize',
    },
    partyBalanceText: {
      fontSize: typography.body,
      fontWeight: '800',
    },
    partyBannerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    quickActionBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    summaryRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    summaryCard: {
      flex: 1,
      borderRadius: radius.md,
      borderWidth: 1,
      padding: spacing.md,
      gap: 4,
    },
    summaryCardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    summaryLabel: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    summaryValue: {
      fontSize: typography.subheading,
      fontWeight: '800',
    },
    netCard: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderRadius: radius.lg,
      borderWidth: 1,
      padding: spacing.md,
      ...shadows.card,
    },
    netSide: {
      alignItems: 'flex-end',
    },
    netLabel: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    netValue: {
      marginTop: 2,
      fontSize: typography.body,
      fontWeight: '800',
    },
    empty: {
      paddingVertical: spacing.xl,
      alignItems: 'center',
    },
    list: {
      gap: spacing.xs + 2,
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
    rowIconCircle: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
    },
    copy: {
      flex: 1,
      gap: 2,
    },
    rowTitle: {
      fontSize: typography.body,
      fontWeight: '700',
    },
    meta: {
      fontSize: typography.caption,
    },
    side: {
      alignItems: 'flex-end',
      gap: 2,
    },
    value: {
      fontSize: typography.body,
      fontWeight: '800',
    },
    runningBalance: {
      fontSize: 11,
      textAlign: 'right',
    },
  });
