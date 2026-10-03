import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { addDays, parseISO } from 'date-fns';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useDayBook } from '@/src/features/money/hooks/useDayBook';
import { useTranslation } from '@/src/i18n';
import { Screen } from '@/src/shared/layout/Screen';
import { EmptyState } from '@/src/shared/ui/EmptyState';
import { PageHeading } from '@/src/shared/ui/PageHeading';
import { SurfaceCard } from '@/src/shared/ui/SurfaceCard';
import { formatCurrency, localIsoDate, prettyDate } from '@/src/shared/lib/format';
import { radius, spacing, typography } from '@/src/theme';
import type { AppPalette } from '@/src/theme/app-palette';
import { useThemedStyles } from '@/src/theme/use-themed-styles';
import { usePalette } from '@/src/stores/theme-store';
import type { DayBookAccount, DayBookEntry } from '@/src/types/models';

const ACCOUNT_ICONS: Record<DayBookAccount['type'], 'cash' | 'bank' | 'wallet'> = {
  cash: 'cash',
  bank: 'bank',
  other: 'wallet',
};

function shiftIsoDate(iso: string, days: number) {
  try {
    return localIsoDate(addDays(parseISO(iso), days));
  } catch {
    return iso;
  }
}

/**
 * The day book: a day's money closed off per account, so the owner reads cash
 * in hand and every bank balance from one screen. The server works out every
 * figure; nothing is added up here.
 */
export function DayBookScreen() {
  const colors = usePalette();
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();

  const [date, setDate] = useState(() => localIsoDate());
  const { data, isLoading, isRefreshing, refetch, error, hasNextPage, isFetchingNextPage, loadMore } = useDayBook({ date });

  const accounts = data?.accounts ?? [];
  const totals = data?.totals;
  const entries = data?.entries ?? [];
  const isToday = date === localIsoDate();

  const bankCount = useMemo(
    () => accounts.filter((account) => account.type !== 'cash').length,
    [accounts],
  );

  return (
    <Screen
      topBarTitle={t('dayBook.title')}
      header={<PageHeading title={t('dayBook.title')} subtitle={t('dayBook.subtitle')} />}
      scrollable={false}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refetch} tintColor={colors.primary} />}
      >
        {/* Which day */}
        <View style={styles.dateBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('dayBook.previousDay')}
            style={styles.dateStep}
            onPress={() => setDate((current) => shiftIsoDate(current, -1))}
          >
            <MaterialCommunityIcons name="chevron-left" size={22} color={colors.text} />
          </Pressable>

          <View style={styles.dateLabelWrap}>
            <Text style={styles.dateLabel}>{prettyDate(date)}</Text>
            {isToday ? <Text style={styles.dateHint}>{t('dayBook.today')}</Text> : null}
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('dayBook.nextDay')}
            style={styles.dateStep}
            onPress={() => setDate((current) => shiftIsoDate(current, 1))}
          >
            <MaterialCommunityIcons name="chevron-right" size={22} color={colors.text} />
          </Pressable>

          {!isToday ? (
            <Pressable accessibilityRole="button" style={styles.todayChip} onPress={() => setDate(localIsoDate())}>
              <Text style={styles.todayChipText}>{t('dayBook.today')}</Text>
            </Pressable>
          ) : null}
        </View>

        {error ? (
          <SurfaceCard>
            <Text style={styles.errorText}>{t('dayBook.loadFailed')}</Text>
          </SurfaceCard>
        ) : null}

        {isLoading && !data ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : null}

        {totals ? (
          <>
            {/* The one number the owner came for */}
            <SurfaceCard style={styles.headlineCard}>
              <Text style={styles.headlineLabel}>{t('dayBook.totalOnHand')}</Text>
              <Text style={styles.headlineValue}>{formatCurrency(totals.closing)}</Text>
              <View style={styles.splitRow}>
                <View style={styles.splitItem}>
                  <Text style={styles.splitLabel}>{t('dayBook.cashInHand')}</Text>
                  <Text style={styles.splitValue}>{formatCurrency(totals.cash.closing)}</Text>
                </View>
                <View style={styles.splitItem}>
                  <Text style={styles.splitLabel}>{t('dayBook.inBanks')}</Text>
                  <Text style={styles.splitValue}>{formatCurrency(totals.bank.closing)}</Text>
                </View>
              </View>
              {accounts.some((account) => account.type === 'other') ? (
                <View style={styles.splitItem}>
                  <Text style={styles.splitLabel}>{t('dayBook.otherAccounts')}</Text>
                  <Text style={styles.splitValue}>{formatCurrency(totals.other.closing)}</Text>
                </View>
              ) : null}
            </SurfaceCard>

            {/* The day's movement */}
            <View style={styles.flowRow}>
              <View style={[styles.flowCard, { backgroundColor: colors.successSoft, borderColor: colors.border }]}>
                <MaterialCommunityIcons name="arrow-down-left" size={18} color={colors.success} />
                <Text style={styles.flowLabel}>{t('dayBook.moneyIn')}</Text>
                <Text style={[styles.flowValue, { color: colors.success }]}>{formatCurrency(totals.in)}</Text>
              </View>
              <View style={[styles.flowCard, { backgroundColor: colors.dangerSoft, borderColor: colors.border }]}>
                <MaterialCommunityIcons name="arrow-up-right" size={18} color={colors.danger} />
                <Text style={styles.flowLabel}>{t('dayBook.moneyOut')}</Text>
                <Text style={[styles.flowValue, { color: colors.danger }]}>{formatCurrency(totals.out)}</Text>
              </View>
            </View>

            {/* Account by account */}
            <Text style={styles.sectionTitle}>
              {t('dayBook.accounts')} · {bankCount + 1}
            </Text>
            {accounts.map((account) => (
              <AccountCard
                key={`${account.type}-${account.id}`}
                account={account}
                isToday={isToday}
                styles={styles}
                colors={colors}
                t={t}
              />
            ))}

            {/* What made up the day */}
            <Text style={styles.sectionTitle}>
              {t('dayBook.entries')} · {t('dayBook.entryCount', { count: totals.count })}
            </Text>
            {entries.length ? (
              <SurfaceCard style={styles.entriesCard}>
                {entries.map((entry, index) => (
                  <EntryRow
                    key={entry.id}
                    entry={entry}
                    accounts={accounts}
                    isLast={index === entries.length - 1}
                    styles={styles}
                    colors={colors}
                    t={t}
                  />
                ))}
              </SurfaceCard>
            ) : (
              <SurfaceCard>
                <EmptyState
                  icon="book-open-variant"
                  title={t('dayBook.noEntries')}
                  message={t('dayBook.noEntriesHint')}
                  variant="inline"
                />
              </SurfaceCard>
            )}

            {hasNextPage ? (
              <Pressable accessibilityRole="button" disabled={isFetchingNextPage} style={styles.loadMore} onPress={loadMore}>
                {isFetchingNextPage ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.todayChipText}>{t('dayBook.loadMore')}</Text>}
              </Pressable>
            ) : null}

            <Text style={styles.footnote}>
              {t('dayBook.openingCash')}: {formatCurrency(data?.cashOpeningBalance ?? 0)} — {t('dayBook.openingCashHint')}
            </Text>
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

interface AccountCardProps {
  account: DayBookAccount;
  isToday: boolean;
  styles: ReturnType<typeof createStyles>;
  colors: AppPalette;
  t: (key: string, params?: Record<string, string | number>) => string;
}

function AccountCard({ account, colors, isToday, styles, t }: AccountCardProps) {
  // Only meaningful for today: the stored balance is a live figure, not history.
  const hasGap = account.type === 'bank'
    && isToday
    && account.recordedBalance !== undefined
    && account.recordedBalance !== null
    && Math.abs(account.closing - account.recordedBalance) > 0.009;

  return (
    <SurfaceCard style={styles.accountCard}>
      <View style={styles.accountHead}>
        <View style={[styles.accountIcon, { backgroundColor: colors.accentSoft }]}>
          <MaterialCommunityIcons name={ACCOUNT_ICONS[account.type]} size={18} color={colors.primaryText} />
        </View>
        <View style={styles.accountHeadText}>
          <Text style={styles.accountName}>{account.type === 'cash' ? t('dayBook.cashInHand') : account.name}</Text>
          {account.accountNumber ? <Text style={styles.accountMeta}>{account.accountNumber}</Text> : null}
          {account.type === 'other' ? <Text style={styles.accountMeta}>{t('dayBook.walletAccount')}</Text> : null}
        </View>
        {account.isActive === false ? (
          <Text style={styles.inactiveTag}>{t('dayBook.inactive')}</Text>
        ) : null}
      </View>

      <View>
        <Text style={styles.accountClosing}>{formatCurrency(account.closing)}</Text>
        <Text style={styles.accountMeta}>{t('dayBook.closing')}</Text>
      </View>

      <View style={styles.accountFigures}>
        <View style={styles.accountFigure}>
          <Text style={styles.accountMeta}>{t('dayBook.opening')}</Text>
          <Text style={styles.accountFigureValue}>{formatCurrency(account.opening)}</Text>
        </View>
        <View style={styles.accountFigure}>
          <Text style={styles.accountMeta}>{t('dayBook.moneyIn')}</Text>
          <Text style={[styles.accountFigureValue, { color: colors.success }]}>{formatCurrency(account.in)}</Text>
        </View>
        <View style={styles.accountFigure}>
          <Text style={styles.accountMeta}>{t('dayBook.moneyOut')}</Text>
          <Text style={[styles.accountFigureValue, { color: colors.danger }]}>{formatCurrency(account.out)}</Text>
        </View>
      </View>

      {hasGap ? (
        <View style={[styles.gapNote, { backgroundColor: colors.warningSoft }]}>
          <MaterialCommunityIcons name="alert-outline" size={14} color={colors.warning} />
          <Text style={[styles.gapText, { color: colors.warning }]}>
            {t('dayBook.reconcileGap')} {t('dayBook.appBalance')}: {formatCurrency(account.recordedBalance ?? 0)}
          </Text>
        </View>
      ) : null}
    </SurfaceCard>
  );
}

interface EntryRowProps {
  entry: DayBookEntry;
  accounts: DayBookAccount[];
  isLast: boolean;
  styles: ReturnType<typeof createStyles>;
  colors: AppPalette;
  t: (key: string, params?: Record<string, string | number>) => string;
}

function EntryRow({ accounts, colors, entry, isLast, styles, t }: EntryRowProps) {
  const isIn = entry.kind === 'in';
  const accountName = entry.accountType === 'cash' ? t('dayBook.cashInHand') : accounts.find((account) => account.id === entry.accountId)?.name
    ?? entry.paymentMethod;
  const detail = [entry.partyName, entry.invoiceNo || entry.note].filter(Boolean).join(' · ');

  return (
    <View style={[styles.entryRow, !isLast && styles.entryRowDivided]}>
      <View style={styles.entryText}>
        <Text style={styles.entryTitle}>{entry.category}</Text>
        <Text style={styles.entryMeta} numberOfLines={1}>
          {detail ? `${accountName} · ${detail}` : accountName}
        </Text>
      </View>
      <Text style={[styles.entryAmount, { color: isIn ? colors.success : colors.danger }]}>
        {isIn ? '+' : '−'}
        {formatCurrency(entry.amount)}
      </Text>
    </View>
  );
}

const createStyles = (colors: AppPalette) => StyleSheet.create({
  scroll: {
    gap: spacing.md,
    paddingBottom: spacing.xxxl,
  },
  dateBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  dateStep: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  dateLabelWrap: {
    flex: 1,
    alignItems: 'center',
  },
  dateLabel: {
    fontSize: typography.subheading,
    fontWeight: '700',
    color: colors.text,
  },
  dateHint: {
    fontSize: typography.caption,
    color: colors.textMuted,
  },
  todayChip: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  todayChipText: {
    fontSize: typography.caption,
    fontWeight: '600',
    color: colors.primaryText,
  },
  loading: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  errorText: {
    fontSize: typography.body,
    color: colors.danger,
  },
  headlineCard: {
    gap: spacing.xs,
  },
  headlineLabel: {
    fontSize: typography.label,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  headlineValue: {
    fontSize: typography.hero,
    fontWeight: '800',
    color: colors.text,
  },
  splitRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  splitItem: {
    flex: 1,
    gap: spacing.xxs,
  },
  splitLabel: {
    fontSize: typography.caption,
    color: colors.textMuted,
  },
  splitValue: {
    fontSize: typography.subheading,
    fontWeight: '700',
    color: colors.text,
  },
  flowRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  flowCard: {
    flex: 1,
    gap: spacing.xxs,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  flowLabel: {
    fontSize: typography.caption,
    color: colors.textMuted,
  },
  flowValue: {
    fontSize: typography.subheading,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: typography.label,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.xs,
  },
  accountCard: {
    gap: spacing.sm,
  },
  accountHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  accountIcon: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  accountHeadText: {
    flex: 1,
    gap: spacing.xxs,
  },
  accountName: {
    fontSize: typography.body,
    fontWeight: '700',
    color: colors.text,
  },
  accountMeta: {
    fontSize: typography.caption,
    color: colors.textMuted,
  },
  inactiveTag: {
    fontSize: typography.caption,
    fontWeight: '600',
    color: colors.textMuted,
  },
  accountClosing: {
    fontSize: typography.heading,
    fontWeight: '800',
    color: colors.text,
  },
  accountFigures: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  accountFigure: {
    flex: 1,
    gap: spacing.xxs,
  },
  accountFigureValue: {
    fontSize: typography.label,
    fontWeight: '700',
    color: colors.text,
  },
  gapNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.sm,
  },
  gapText: {
    flex: 1,
    fontSize: typography.caption,
  },
  entriesCard: {
    gap: 0,
    paddingVertical: spacing.xs,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  entryRowDivided: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  entryText: {
    flex: 1,
    gap: spacing.xxs,
  },
  entryTitle: {
    fontSize: typography.body,
    fontWeight: '600',
    color: colors.text,
  },
  entryMeta: {
    fontSize: typography.caption,
    color: colors.textMuted,
  },
  entryAmount: {
    fontSize: typography.body,
    fontWeight: '700',
  },
  footnote: {
    fontSize: typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  loadMore: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
  },
});
