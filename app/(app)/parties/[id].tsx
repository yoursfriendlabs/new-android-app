import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useLocalSearchParams } from 'expo-router';
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

import { PartyFormSheet } from '@/src/features/parties/components/PartyFormSheet';
import { PartyTransactionSheet } from '@/src/features/parties/components/PartyTransactionSheet';
import { Screen } from '@/src/shared/layout/Screen';
import { StickyActionBar } from '@/src/shared/ui/StickyActionBar';
import { usePartyById, usePartyStatement } from '@/src/shared/hooks/useAppQueries';
import { formatCurrency, prettyDate } from '@/src/shared/lib/format';
import { isCafeWorkspace, isPersonalWorkspace } from '@/src/shared/lib/business';
import { buildPartyStatementHtml, shareHtmlAsPdf } from '@/src/shared/lib/report-pdf';
import {
  buildExpenseReceipt,
  buildPartyStatementReceipt,
  buildPartyTransactionReceipt,
  buildSaleReceipt,
  openReceiptPreview,
} from '@/src/shared/lib/receipt';
import {
  getBalanceColor,
  getBalanceSoftColor,
  getPartyBalanceMeta,
  getPartyWhatsAppUrl,
  getStatementAmount,
  getStatementRowTitle,
  getStatementTypeLabel,
  isEditableStatementRow,
  partyInitials,
  partyTypeLabel,
  toAmount,
} from '@/src/features/parties/lib/party';
import { useAuthStore } from '@/src/stores/auth-store';
import { usePalette } from '@/src/stores/theme-store';
import type { AppPalette } from '@/src/theme/app-palette';
import { radius, shadows, spacing, typography } from '@/src/theme';
import type { Party, PartyStatementRow, PartyTransaction, Purchase, Sale } from '@/src/types/models';
import { useThemedStyles } from '@/src/theme/use-themed-styles';

function statementBadge(type: string, colors: AppPalette) {
  switch (type) {
    case 'sale':
      return { bg: colors.successSoft, fg: colors.success };
    case 'service':
      return { bg: colors.infoSoft, fg: colors.info };
    case 'purchase':
      return { bg: colors.warningSoft, fg: colors.warning };
    case 'expense':
    case 'payment_out':
      return { bg: colors.dangerSoft, fg: colors.danger };
    case 'payment_in':
      return { bg: colors.successSoft, fg: colors.success };
    default:
      return { bg: colors.backgroundAlt, fg: colors.textMuted };
  }
}

function toEditableTransaction(row: PartyStatementRow, partyId: string): PartyTransaction {
  return {
    id: row.id,
    partyId,
    direction: row.type === 'payment_out' ? 'give' : 'receive',
    amount: toAmount(row.amount),
    txDate: String(row.date || '').slice(0, 10),
    paymentMethod: row.paymentMethod === 'bank' ? 'bank' : 'cash',
    bankId: row.bankId || undefined,
    note: row.note,
  };
}

export default function PartyDetailScreen() {
  const colors = usePalette();
  const styles = useThemedStyles(createStyles);
  const { id } = useLocalSearchParams<{ id: string }>();
  const currency = useAuthStore((state) => state.businessProfile?.currencyCode) || 'NPR';
  const businessName = useAuthStore((state) => state.businessProfile?.businessName) || 'PM';
  const businessProfile = useAuthStore((state) => state.businessProfile);
  const cafeWorkspace = isCafeWorkspace({
    businessType: String(businessProfile?.businessType ?? ''),
    enabledModules: businessProfile?.enabledModules,
  });
  const personal = isPersonalWorkspace({
    businessType: String(businessProfile?.businessType ?? ''),
  });
  const partyQuery = usePartyById(id);
  const statementQuery = usePartyStatement(id);
  const [editVisible, setEditVisible] = useState(false);
  const [paymentVisible, setPaymentVisible] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<PartyTransaction | null>(null);
  const [exporting, setExporting] = useState(false);

  const party = useMemo<Party | null>(() => {
    if (!partyQuery.data && !statementQuery.data?.party) return null;
    return {
      ...(partyQuery.data ?? {}),
      ...(statementQuery.data?.party ?? {}),
    } as Party;
  }, [partyQuery.data, statementQuery.data?.party]);

  const summary = statementQuery.data?.summary;
  const rows = statementQuery.data?.rows ?? [];
  const balanceMeta = getPartyBalanceMeta(party, summary?.currentAmount, personal);
  const toneColor = getBalanceColor(balanceMeta.tone, colors);
  const toneSoft = getBalanceSoftColor(balanceMeta.tone, colors);
  const whatsappUrl = getPartyWhatsAppUrl(
    party,
    balanceMeta.tone === 'receive' ? balanceMeta.absoluteAmount : 0,
  );

  const summaryCards = personal
    ? [
        { key: 'in', label: 'Received', total: summary?.totalPaymentIn ?? 0, due: 0 },
        { key: 'out', label: 'Paid', total: summary?.totalPaymentOut ?? 0, due: 0 },
        { key: 'expenses', label: 'Expenses', total: summary?.totalExpenses ?? 0, due: summary?.expensesDue ?? 0 },
      ]
    : [
        { key: 'sales', label: 'Sales', total: summary?.totalSales ?? 0, due: summary?.salesDue ?? 0 },
        ...(!cafeWorkspace
          ? [{ key: 'services', label: 'Services', total: summary?.totalServices ?? 0, due: summary?.servicesDue ?? 0 }]
          : []),
        { key: 'purchases', label: 'Purchases', total: summary?.totalPurchases ?? 0, due: summary?.purchasesDue ?? 0 },
        { key: 'expenses', label: 'Expenses', total: summary?.totalExpenses ?? 0, due: summary?.expensesDue ?? 0 },
      ];

  async function handleRefresh() {
    await Promise.all([partyQuery.refetch(), statementQuery.refetch()]);
  }

  async function callParty() {
    const phone = String(party?.phone || '').trim();
    if (!phone) return;
    await Linking.openURL(`tel:${phone}`);
  }

  async function openWhatsApp() {
    if (!whatsappUrl) return;
    await Linking.openURL(whatsappUrl);
  }

  function openPayment(transaction?: PartyTransaction | null) {
    setEditingTransaction(transaction ?? null);
    setPaymentVisible(true);
  }

  async function handleShareStatement() {
    if (!party) return;
    try {
      setExporting(true);
      await shareHtmlAsPdf(
        buildPartyStatementHtml({
          businessName,
          party,
          currency,
          rows,
          currentAmount: summary?.currentAmount ?? party.currentAmount,
        }),
        'Share party statement',
      );
    } catch (error) {
      Alert.alert('Unable to share', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setExporting(false);
    }
  }

  if ((partyQuery.isLoading || statementQuery.isLoading) && !party) {
    return (
      <Screen scrollable={false} topBarTitle={personal ? 'Contact' : 'Party'} topBarLeading="back">
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </Screen>
    );
  }

  if (!party) {
    return (
      <Screen topBarTitle={personal ? 'Contact' : 'Party'} topBarLeading="back">
        <Text style={[styles.emptyCopy, { color: colors.textMuted }]}>
          {personal ? 'This contact could not be found.' : 'This party could not be found.'}
        </Text>
      </Screen>
    );
  }

  const handlePrintRow = (row: PartyStatementRow) => {
    if (!party) return;

    if (row.type === 'payment_in' || row.type === 'payment_out') {
      const tx: PartyTransaction = {
        id: String(row.id),
        businessId: businessProfile?.id ? String(businessProfile.id) : '',
        partyId: party.id,
        direction: row.type === 'payment_in' ? 'receive' : 'give',
        amount: getStatementAmount(row),
        paymentMethod: (row.paymentMethod as any) || 'cash',
        bankId: row.bankId ? String(row.bankId) : undefined,
        txDate: row.date ? String(row.date) : new Date().toISOString(),
        note: row.description ? String(row.description) : '',
        createdAt: row.date ? String(row.date) : new Date().toISOString(),
        updatedAt: row.date ? String(row.date) : new Date().toISOString(),
      };
      const { input, html } = buildPartyTransactionReceipt(tx, party, businessProfile);
      openReceiptPreview(router, input, html);
    } else if (row.type === 'sale') {
      const sale: Sale = {
        id: String(row.id),
        businessId: businessProfile?.id ? String(businessProfile.id) : '',
        invoiceNo: row.referenceNo ? String(row.referenceNo) : `INV-${row.id}`,
        partyId: party.id,
        partyName: party.name,
        saleDate: row.date ? String(row.date) : new Date().toISOString(),
        status: 'completed',
        paymentStatus: toAmount(row.dueAmount) <= 0 ? 'paid' : 'partial',
        paymentMethod: (row.paymentMethod as any) || 'cash',
        bankId: row.bankId ? String(row.bankId) : undefined,
        subTotal: getStatementAmount(row),
        taxTotal: 0,
        discountTotal: 0,
        grandTotal: getStatementAmount(row),
        amountReceived: getStatementAmount(row) - toAmount(row.dueAmount),
        items: [],
        createdAt: row.date ? String(row.date) : new Date().toISOString(),
        updatedAt: row.date ? String(row.date) : new Date().toISOString(),
      };
      const { input, html } = buildSaleReceipt(sale, businessProfile);
      openReceiptPreview(router, input, html);
    } else {
      const purchase: Purchase = {
        id: String(row.id),
        businessId: businessProfile?.id ? String(businessProfile.id) : '',
        invoiceNo: row.referenceNo ? String(row.referenceNo) : `EXP-${row.id}`,
        entryType: row.type === 'purchase' ? 'purchase' : 'expense',
        partyId: party.id,
        partyName: party.name,
        purchaseDate: row.date ? String(row.date) : new Date().toISOString(),
        status: 'completed',
        paymentStatus: toAmount(row.dueAmount) <= 0 ? 'paid' : 'partial',
        paymentMethod: (row.paymentMethod as any) || 'cash',
        bankId: row.bankId ? String(row.bankId) : undefined,
        subTotal: getStatementAmount(row),
        taxTotal: 0,
        discountTotal: 0,
        grandTotal: getStatementAmount(row),
        amountReceived: getStatementAmount(row) - toAmount(row.dueAmount),
        notes: row.description ? String(row.description) : '',
        items: [],
        createdAt: row.date ? String(row.date) : new Date().toISOString(),
        updatedAt: row.date ? String(row.date) : new Date().toISOString(),
      };
      const { input, html } = buildExpenseReceipt(purchase, businessProfile);
      openReceiptPreview(router, input, html);
    }
  };

  const handlePreviewAllTransactions = () => {
    if (!party) return;
    const { input, html } = buildPartyStatementReceipt(
      party,
      rows,
      summary,
      businessProfile,
      personal,
    );
    openReceiptPreview(router, input, html);
  };

  return (
    <Screen
      scrollable={false}
      padded={false}
      topBarTitle={party.name}
      topBarLeading="back"
      topBarRight={
        <View style={styles.headerActions}>
          <Pressable
            onPress={handlePreviewAllTransactions}
            style={[styles.headerBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            accessibilityLabel="Bill Preview">
            <MaterialCommunityIcons name="printer-outline" size={20} color={colors.text} />
          </Pressable>
          <Pressable
            onPress={() => void handleShareStatement()}
            disabled={exporting}
            style={[styles.headerBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {exporting ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <MaterialCommunityIcons name="share-variant-outline" size={20} color={colors.text} />
            )}
          </Pressable>
          <Pressable
            onPress={() => setEditVisible(true)}
            style={[styles.headerBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <MaterialCommunityIcons name="pencil-outline" size={20} color={colors.text} />
          </Pressable>
        </View>
      }
      footer={
        <StickyActionBar
          secondary={{ label: 'Bill / Print', onPress: handlePreviewAllTransactions }}
          primary={{ label: personal ? 'Record money' : 'Record payment', onPress: () => openPayment() }}
        />
      }>
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={partyQuery.isRefetching || statementQuery.isRefetching}
            onRefresh={() => void handleRefresh()}
          />
        }
        contentContainerStyle={styles.scroll}>
        <View style={[styles.profileCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.profileTop}>
            <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
              <Text style={[styles.avatarText, { color: colors.white }]}>{partyInitials(party.name)}</Text>
            </View>
            <View style={styles.profileCopy}>
              <Text style={[styles.profileName, { color: colors.text }]}>{party.name}</Text>
              <View style={styles.chipRow}>
                <View style={[styles.typeChip, { backgroundColor: colors.backgroundAlt }]}>
                  <Text style={[styles.typeChipText, { color: colors.textMuted }]}>
                    {partyTypeLabel(party.type, personal)}
                  </Text>
                </View>
                {party.phone ? (
                  <Text style={[styles.profileMeta, { color: colors.textMuted }]}>{party.phone}</Text>
                ) : null}
              </View>
              {party.address ? (
                <Text style={[styles.profileMeta, { color: colors.textSoft }]}>{party.address}</Text>
              ) : null}
            </View>
          </View>

          <View style={[styles.balanceHero, { backgroundColor: toneSoft }]}>
            <Text style={[styles.balanceLabel, { color: toneColor }]}>{balanceMeta.label}</Text>
            <Text style={[styles.balanceValue, { color: toneColor }]}>
              {formatCurrency(balanceMeta.absoluteAmount, currency)}
            </Text>
          </View>

          <View style={styles.actionRow}>
            <ActionButton
              colors={colors}
              disabled={!party.phone}
              icon="phone-outline"
              label="Call"
              onPress={() => void callParty()}
            />
            <ActionButton
              colors={colors}
              disabled={!whatsappUrl}
              icon="whatsapp"
              label="WhatsApp"
              onPress={() => void openWhatsApp()}
            />
            <ActionButton
              colors={colors}
              icon="cash-plus"
              label={personal ? 'Money' : 'Pay'}
              onPress={() => openPayment()}
            />
          </View>
        </View>

        <View style={styles.metrics}>
          {summaryCards.map((card) => (
            <View
              key={card.key}
              style={[styles.metricCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.metricLabel, { color: colors.textSoft }]}>{card.label}</Text>
              <Text style={[styles.metricValue, { color: colors.text }]}>{formatCurrency(card.total, currency)}</Text>
              <Text style={[styles.metricDue, { color: card.due > 0 ? colors.danger : colors.textSoft }]}>
                Due {formatCurrency(card.due, currency)}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.sectionHead}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Transactions</Text>
            <Text style={[styles.sectionMeta, { color: colors.textMuted }]}>
              {summary?.totalRows ?? rows.length} entries
              {personal ? ' · money in and out' : ' · payments, sales, and bills'}
            </Text>
          </View>
          <Pressable
            onPress={handlePreviewAllTransactions}
            style={[styles.statementBillBtn, { backgroundColor: colors.accentSoft, borderColor: colors.primary }]}>
            <MaterialCommunityIcons name="receipt-text-outline" size={16} color={colors.primary} />
            <Text style={[styles.statementBillBtnText, { color: colors.primary }]}>Bill Preview</Text>
          </Pressable>
        </View>

        {!rows.length ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No transactions yet</Text>
            <Text style={[styles.emptyCopy, { color: colors.textMuted }]}>
              {personal
                ? 'Record money received or paid, and it will appear on this contact.'
                : 'Record a payment, or this party’s sales and purchases will appear here automatically.'}
            </Text>
          </View>
        ) : (
          <View style={styles.txList}>
            {rows.map((row) => {
              const badge = statementBadge(row.type, colors);
              const amount = getStatementAmount(row);
              const running = getPartyBalanceMeta(party, row.runningBalance ?? undefined, personal);
              const canEdit = isEditableStatementRow(row);

              return (
                <Pressable
                  key={`${row.type}-${row.id}`}
                  disabled={!canEdit}
                  onPress={() => canEdit && openPayment(toEditableTransaction(row, party.id))}
                  style={[styles.txCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={styles.txTop}>
                    <View style={[styles.txBadge, { backgroundColor: badge.bg }]}>
                      <Text style={[styles.txBadgeText, { color: badge.fg }]}>
                        {getStatementTypeLabel(row.type, personal)}
                      </Text>
                    </View>
                    <Text style={[styles.txAmount, { color: colors.text }]}>{formatCurrency(amount, currency)}</Text>
                  </View>
                  <Text style={[styles.txTitle, { color: colors.text }]}>{getStatementRowTitle(row)}</Text>
                  <View style={styles.txMetaRow}>
                    <Text style={[styles.txMeta, { color: colors.textMuted }]}>
                      {[prettyDate(row.date), row.status, row.paymentMethod === 'bank' ? 'Bank' : row.paymentMethod === 'cash' ? 'Cash' : '']
                        .filter(Boolean)
                        .join('  ·  ')}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <Pressable
                        hitSlop={6}
                        onPress={(e) => {
                          e.stopPropagation?.();
                          handlePrintRow(row);
                        }}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                        <MaterialCommunityIcons name="printer-outline" size={14} color={colors.primary} />
                        <Text style={[styles.txEdit, { color: colors.primary }]}>Bill / Print</Text>
                      </Pressable>
                      {canEdit ? (
                        <Text style={[styles.txEdit, { color: colors.primary }]}>Edit</Text>
                      ) : null}
                    </View>
                  </View>
                  {toAmount(row.dueAmount) > 0 && row.type !== 'payment_in' && row.type !== 'payment_out' ? (
                    <Text style={[styles.txDue, { color: colors.danger }]}>
                      Due {formatCurrency(toAmount(row.dueAmount), currency)}
                    </Text>
                  ) : null}
                  {row.runningBalance != null ? (
                    <Text style={[styles.txRunning, { color: getBalanceColor(running.tone, colors) }]}>
                      Balance {formatCurrency(running.absoluteAmount, currency)} {running.label.toLowerCase()}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>

      <PartyFormSheet
        visible={editVisible}
        party={party}
        onClose={() => setEditVisible(false)}
        onDeleted={() => {
          if (router.canGoBack()) router.back();
          else router.replace('/(app)/parties');
        }}
      />
      <PartyTransactionSheet
        visible={paymentVisible}
        party={party}
        transaction={editingTransaction}
        onClose={() => {
          setPaymentVisible(false);
          setEditingTransaction(null);
        }}
      />
    </Screen>
  );
}

function ActionButton({
  colors,
  disabled,
  icon,
  label,
  onPress,
}: {
  colors: AppPalette;
  disabled?: boolean;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.actionBtn,
        { backgroundColor: colors.backgroundAlt, opacity: disabled ? 0.45 : pressed ? 0.85 : 1 },
      ]}>
      <MaterialCommunityIcons name={icon} size={18} color={colors.text} />
      <Text style={[styles.actionLabel, { color: colors.text }]}>{label}</Text>
    </Pressable>
  );
}

const createStyles = (colors: AppPalette) => StyleSheet.create({
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  profileCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.card,
  },
  profileTop: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '800',
  },
  profileCopy: {
    flex: 1,
    gap: 6,
  },
  profileName: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.xs,
  },
  typeChip: {
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  typeChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  profileMeta: {
    fontSize: typography.label,
  },
  balanceHero: {
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 2,
  },
  balanceLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  balanceValue: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionLabel: {
    fontSize: typography.label,
    fontWeight: '700',
  },
  metrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  metricCard: {
    width: '48%',
    flexGrow: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    gap: 4,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  metricValue: {
    fontSize: typography.body,
    fontWeight: '800',
  },
  metricDue: {
    fontSize: typography.caption,
    fontWeight: '600',
  },
  sectionHead: {
    paddingTop: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  statementBillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  statementBillBtnText: {
    fontSize: typography.caption,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: typography.subheading,
    fontWeight: '800',
  },
  sectionMeta: {
    fontSize: typography.caption,
    marginTop: 2,
  },
  txList: {
    gap: spacing.sm,
  },
  txCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    gap: 6,
  },
  txTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  txBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  txBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  txAmount: {
    fontSize: typography.body,
    fontWeight: '800',
  },
  txTitle: {
    fontSize: typography.body,
    fontWeight: '700',
  },
  txMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  txMeta: {
    fontSize: typography.caption,
    flex: 1,
  },
  txEdit: {
    fontSize: typography.caption,
    fontWeight: '700',
  },
  txDue: {
    fontSize: typography.caption,
    fontWeight: '700',
  },
  txRunning: {
    fontSize: typography.caption,
    fontWeight: '700',
  },
  emptyCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.xl,
    gap: spacing.xs,
  },
  emptyTitle: {
    fontSize: typography.subheading,
    fontWeight: '700',
  },
  emptyCopy: {
    fontSize: typography.body,
    lineHeight: 22,
  },
});
