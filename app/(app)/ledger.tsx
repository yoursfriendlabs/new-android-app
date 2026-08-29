import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PartyPickerSheet } from '@/src/shared/forms/PartyPickerSheet';
import { Screen } from '@/src/shared/layout/Screen';
import { EmptyState } from '@/src/shared/ui/EmptyState';
import { SegmentedTabs } from '@/src/shared/ui/SegmentedTabs';
import { StickyActionBar } from '@/src/shared/ui/StickyActionBar';
import { DatePeriod, formatCurrency, getRangeForPeriod, prettyDate } from '@/src/shared/lib/format';
import { useDebouncedValue } from '@/src/shared/hooks/useDebouncedValue';
import { useLedger, useParties } from '@/src/shared/hooks/useAppQueries';
import { buildLedgerReportHtml, printHtmlDocument, shareHtmlAsPdf } from '@/src/shared/lib/report-pdf';
import { radius, shadows, spacing, typography } from '@/src/theme';
import type { Party } from '@/src/types/models';
import { isPersonalWorkspace } from '@/src/shared/lib/business';
import { partyTypeLabel } from '@/src/features/parties/lib/party';
import { useAuthStore } from '@/src/stores/auth-store';
import { usePalette } from '@/src/stores/theme-store';
import { useThemedStyles } from '@/src/theme/use-themed-styles';
import type { AppPalette } from '@/src/theme/app-palette';

type LedgerPeriod = Extract<DatePeriod, 'this_month' | 'this_year'> | 'all';

export default function LedgerScreen() {
  const colors = usePalette();
  const styles = useThemedStyles(createStyles);
  const currency = useAuthStore((state) => state.businessProfile?.currencyCode) || 'NPR';
  const businessName = useAuthStore((state) => state.businessProfile?.businessName) || 'PasalManager';
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
  const entries = ledgerQuery.data ?? [];

  const totals = useMemo(() => {
    return entries.reduce(
      (acc, entry) => {
        acc.debit += Number(entry.debit || 0);
        acc.credit += Number(entry.credit || 0);
        return acc;
      },
      { debit: 0, credit: 0 },
    );
  }, [entries]);

  const latestBalance = entries[0]?.runningBalance ?? entries[entries.length - 1]?.runningBalance ?? 0;
  const net = totals.credit - totals.debit;

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
      await shareHtmlAsPdf(reportHtml(), 'Share ledger PDF');
    } catch (error) {
      Alert.alert('Unable to share', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <Screen
      scrollable={false}
      padded={false}
      topBarTitle={personal ? 'History' : 'Ledger'}
      topBarRight={
        <Pressable onPress={() => void handleShare()} hitSlop={8} style={styles.headerIcon} disabled={exporting}>
          {exporting ? (
            <ActivityIndicator color={colors.primary} size="small" />
          ) : (
            <MaterialCommunityIcons color={colors.text} name="share-variant-outline" size={22} />
          )}
        </Pressable>
      }
      footer={
        <StickyActionBar
          secondary={{ label: 'Share PDF', onPress: () => void handleShare() }}
          primary={{ label: 'Print PDF', onPress: () => void handlePrint() }}
        />
      }>
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={ledgerQuery.isRefetching} onRefresh={() => void ledgerQuery.refetch()} />
        }
        contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {personal
              ? 'Every payment in and out, for one contact or everyone.'
              : 'Debits, credits, and running balance for one party or everyone.'}
          </Text>
        </View>

        <SegmentedTabs
          value={period}
          onChange={setPeriod}
          options={[
            { label: 'This month', value: 'this_month' },
            { label: 'This year', value: 'this_year' },
            { label: 'All time', value: 'all' },
          ]}
        />

        <Pressable
          onPress={() => setPickerVisible(true)}
          style={[styles.filterCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.filterIcon, { backgroundColor: colors.accentSoft }]}>
            <MaterialCommunityIcons name="account-search-outline" size={20} color={colors.primary} />
          </View>
          <View style={styles.filterCopy}>
            <Text style={[styles.filterLabel, { color: colors.textSoft }]}>
              {personal ? 'Contact' : 'Party'}
            </Text>
            <Text style={[styles.filterValue, { color: colors.text }]}>
              {selectedParty?.name ?? (personal ? 'All contacts' : 'All parties')}
            </Text>
          </View>
          {selectedParty ? (
            <Pressable
              onPress={() => setSelectedParty(null)}
              hitSlop={8}
              style={[styles.clearBtn, { backgroundColor: colors.backgroundAlt }]}>
              <Text style={[styles.clearText, { color: colors.textMuted }]}>Clear</Text>
            </Pressable>
          ) : (
            <MaterialCommunityIcons name="chevron-down" size={20} color={colors.textMuted} />
          )}
        </Pressable>

        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { backgroundColor: colors.dangerSoft, borderColor: colors.border }]}>
            <Text style={[styles.summaryLabel, { color: colors.danger }]}>Debit</Text>
            <Text style={[styles.summaryValue, { color: colors.danger }]}>{formatCurrency(totals.debit, currency)}</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: colors.successSoft, borderColor: colors.border }]}>
            <Text style={[styles.summaryLabel, { color: colors.success }]}>Credit</Text>
            <Text style={[styles.summaryValue, { color: colors.success }]}>{formatCurrency(totals.credit, currency)}</Text>
          </View>
        </View>

        <View style={[styles.netCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View>
            <Text style={[styles.netLabel, { color: colors.textSoft }]}>Net movement</Text>
            <Text style={[styles.netValue, { color: colors.text }]}>{formatCurrency(net, currency)}</Text>
          </View>
          <View style={styles.netSide}>
            <Text style={[styles.netLabel, { color: colors.textSoft }]}>Latest balance</Text>
            <Text style={[styles.netValue, { color: colors.text }]}>{formatCurrency(Number(latestBalance || 0), currency)}</Text>
          </View>
        </View>

        {ledgerQuery.isLoading && !entries.length ? (
          <View style={styles.empty}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : null}

        {!ledgerQuery.isLoading && !entries.length ? (
          <EmptyState
            title="No ledger entries"
            message={
              selectedParty
                ? `Nothing posted for ${selectedParty.name} in this period.`
                : personal
                  ? 'Income, expenses, and payments to contacts will show here.'
                  : 'Sales, purchases, and party payments will show here.'
            }
          />
        ) : null}

        <View style={styles.list}>
          {entries.map((entry) => {
            const debit = Number(entry.debit || 0);
            const credit = Number(entry.credit || 0);
            const positive = credit >= debit;
            return (
              <View key={entry.id} style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.copy}>
                  <Text style={[styles.rowTitle, { color: colors.text }]}>
                    {entry.refNo || entry.description || 'Ledger entry'}
                  </Text>
                  <Text style={[styles.meta, { color: colors.textMuted }]}>
                    {[prettyDate(entry.entryDate), entry.partyName, entry.refType].filter(Boolean).join('  ·  ')}
                  </Text>
                </View>
                <View style={styles.side}>
                  <Text style={[styles.value, { color: positive ? colors.success : colors.danger }]}>
                    {positive ? '+' : '-'}
                    {formatCurrency(Math.abs(credit - debit), currency)}
                  </Text>
                  <Text style={[styles.runningBalance, { color: colors.textSoft }]}>
                    Bal {formatCurrency(Number(entry.runningBalance || 0), currency)}
                    {entry.balanceDirection ? ` ${entry.balanceDirection}` : ''}
                  </Text>
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
        subtitle={personal ? 'Show one person, or keep all contacts.' : 'Show one statement, or keep all parties.'}
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
    headerIcon: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    hero: {
      gap: spacing.xs,
    },
    title: {
      fontSize: typography.heading,
      fontWeight: '800',
    },
    subtitle: {
      fontSize: typography.body,
      lineHeight: 22,
    },
    filterCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderRadius: radius.lg,
      borderWidth: 1,
      padding: spacing.md,
      ...shadows.card,
    },
    filterIcon: {
      width: 40,
      height: 40,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
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
      borderRadius: radius.sm,
      paddingHorizontal: spacing.sm,
      paddingVertical: 6,
    },
    clearText: {
      fontSize: typography.caption,
      fontWeight: '700',
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
      marginTop: 4,
      fontSize: typography.body,
      fontWeight: '800',
    },
    empty: {
      paddingVertical: spacing.xl,
      alignItems: 'center',
    },
    list: {
      gap: spacing.sm,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: spacing.md,
      borderRadius: radius.lg,
      borderWidth: 1,
      padding: spacing.md,
      ...shadows.card,
    },
    copy: {
      flex: 1,
      gap: spacing.xxs,
    },
    rowTitle: {
      fontSize: typography.body,
      fontWeight: '700',
    },
    meta: {
      fontSize: typography.label,
    },
    side: {
      alignItems: 'flex-end',
      gap: spacing.xxs,
    },
    value: {
      fontSize: typography.body,
      fontWeight: '800',
    },
    runningBalance: {
      fontSize: typography.caption,
      textAlign: 'right',
    },
  });
