import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PartyFormSheet } from '@/src/features/parties/components/PartyFormSheet';
import { DeviceContactSheet } from '@/src/features/parties/components/DeviceContactSheet';
import { Screen } from '@/src/shared/layout/Screen';
import { SearchField } from '@/src/shared/ui/SearchField';
import { SegmentedTabs } from '@/src/shared/ui/SegmentedTabs';
import { StickyActionBar } from '@/src/shared/ui/StickyActionBar';
import { useDebouncedValue } from '@/src/shared/hooks/useDebouncedValue';
import { useParties } from '@/src/shared/hooks/useAppQueries';
import { pickNativeDeviceContact, type DeviceContactDraft } from '@/src/features/parties/lib/device-contacts';
import { isPersonalWorkspace } from '@/src/shared/lib/business';
import { visibleMoneyParties } from '@/src/features/money/lib/money';
import {
  getBalanceColor,
  getBalanceSoftColor,
  getPartyBalanceMeta,
  partyInitials,
  partyTypeLabel,
} from '@/src/features/parties/lib/party';
import { formatCurrency } from '@/src/shared/lib/format';
import { buildPartyBalancesHtml, shareHtmlAsPdf } from '@/src/shared/lib/report-pdf';
import { useAuthStore } from '@/src/stores/auth-store';
import { usePalette } from '@/src/stores/theme-store';
import { radius, shadows, spacing, typography } from '@/src/theme';
import type { Party } from '@/src/types/models';

type PartyFilter = 'both' | 'customer' | 'supplier';
type BalanceFilter = 'all' | 'receive' | 'give';

export default function PartiesScreen() {
  const colors = usePalette();
  const currency = useAuthStore((state) => state.businessProfile?.currencyCode) || 'NPR';
  const businessName = useAuthStore((state) => state.businessProfile?.businessName) || 'PasalManager';
  const businessProfile = useAuthStore((state) => state.businessProfile);
  const personal = isPersonalWorkspace({
    businessType: String(businessProfile?.businessType ?? businessProfile?.type ?? ''),
  });
  const [search, setSearch] = useState('');
  const [type, setType] = useState<PartyFilter>('both');
  const [balanceFilter, setBalanceFilter] = useState<BalanceFilter>('all');
  const [createVisible, setCreateVisible] = useState(false);
  const [contactSeed, setContactSeed] = useState<DeviceContactDraft | null>(null);
  const [phoneSheetVisible, setPhoneSheetVisible] = useState(false);
  const [exporting, setExporting] = useState(false);
  const debouncedSearch = useDebouncedValue(search);
  const partiesQuery = useParties(debouncedSearch, personal ? 'both' : type);
  const parties = useMemo(
    () => (personal ? visibleMoneyParties(partiesQuery.data) : partiesQuery.data ?? []),
    [partiesQuery.data, personal],
  );

  const visibleParties = useMemo(() => {
    if (!personal || balanceFilter === 'all') return parties;
    return parties.filter((party) => {
      const meta = getPartyBalanceMeta(party, undefined, true);
      return balanceFilter === 'receive' ? meta.tone === 'receive' : meta.tone === 'pay';
    });
  }, [balanceFilter, parties, personal]);

  const totals = useMemo(() => {
    return parties.reduce(
      (acc, party) => {
        const meta = getPartyBalanceMeta(party, undefined, personal);
        if (meta.tone === 'receive') acc.receive += meta.absoluteAmount;
        if (meta.tone === 'pay') acc.give += meta.absoluteAmount;
        return acc;
      },
      { receive: 0, give: 0 },
    );
  }, [parties, personal]);

  async function handleRefresh() {
    await partiesQuery.refetch();
  }

  async function handleShareBalances() {
    try {
      setExporting(true);
      await shareHtmlAsPdf(
        buildPartyBalancesHtml({
          businessName,
          currency,
          toReceive: totals.receive,
          toGive: totals.give,
          parties: parties.map((party) => {
            const meta = getPartyBalanceMeta(party);
            return {
              name: party.name,
              type: partyTypeLabel(party.type, personal),
              receive: meta.tone === 'receive' ? meta.absoluteAmount : 0,
              give: meta.tone === 'pay' ? meta.absoluteAmount : 0,
            };
          }),
        }),
        'Share party balances',
      );
    } catch (error) {
      Alert.alert('Unable to share', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setExporting(false);
    }
  }

  async function importFromPhone() {
    const native = await pickNativeDeviceContact();
    if (native) {
      setContactSeed(native);
      setCreateVisible(true);
      return;
    }
    if (native === undefined) setPhoneSheetVisible(true);
  }

  return (
    <Screen
      scrollable={false}
      padded={false}
      topBarTitle={personal ? 'Contacts' : 'Parties'}
      topBarRight={
        <Pressable onPress={() => void handleShareBalances()} hitSlop={8} disabled={exporting}>
          {exporting ? (
            <ActivityIndicator color={colors.primary} size="small" />
          ) : (
            <MaterialCommunityIcons color={colors.text} name="share-variant-outline" size={22} />
          )}
        </Pressable>
      }
      footer={
        <StickyActionBar
          secondary={
            personal
              ? { label: 'From phone', onPress: () => void importFromPhone() }
              : undefined
          }
          primary={{
            label: personal ? 'New contact' : 'New party',
            onPress: () => {
              setContactSeed(null);
              setCreateVisible(true);
            },
          }}
        />
      }>
        <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={partiesQuery.isRefetching} onRefresh={() => void handleRefresh()} />}
        contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {personal
              ? 'People you pay, get paid by, or just want on record. Add one quickly or pick from your phone.'
              : 'Customers and suppliers, with live dues and a full statement on each profile.'}
          </Text>
        </View>

        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { backgroundColor: colors.dangerSoft, borderColor: colors.border }]}>
            <Text style={[styles.summaryLabel, { color: colors.danger }]}>
              {personal ? 'They owe me' : 'To receive'}
            </Text>
            <Text style={[styles.summaryValue, { color: colors.danger }]}>{formatCurrency(totals.receive, currency)}</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: colors.infoSoft, borderColor: colors.border }]}>
            <Text style={[styles.summaryLabel, { color: colors.info }]}>
              {personal ? 'I owe them' : 'To give'}
            </Text>
            <Text style={[styles.summaryValue, { color: colors.info }]}>{formatCurrency(totals.give, currency)}</Text>
          </View>
        </View>

        <SearchField placeholder="Search name or phone" value={search} onChangeText={setSearch} />
        {personal ? (
          <SegmentedTabs
            value={balanceFilter}
            onChange={setBalanceFilter}
            options={[
              { label: 'All', value: 'all' },
              { label: 'Owed to me', value: 'receive' },
              { label: 'I owe', value: 'give' },
            ]}
          />
        ) : (
          <SegmentedTabs
            value={type}
            onChange={setType}
            options={[
              { label: 'All', value: 'both' },
              { label: 'Customers', value: 'customer' },
              { label: 'Suppliers', value: 'supplier' },
            ]}
          />
        )}

        {partiesQuery.isLoading && !visibleParties.length ? (
          <View style={styles.empty}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : null}

        {!partiesQuery.isLoading && !visibleParties.length ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.accentSoft }]}>
              <MaterialCommunityIcons name="account-plus-outline" size={28} color={colors.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {personal ? 'No contacts yet' : 'No parties yet'}
            </Text>
            <Text style={[styles.emptyCopy, { color: colors.textMuted }]}>
              {personal
                ? 'Add someone you pay or get paid by, or import them from your phone contacts.'
                : 'Add a customer or supplier to track sales, purchases, and outstanding dues.'}
            </Text>
          </View>
        ) : null}

        <View style={styles.list}>
          {visibleParties.map((party) => (
            <PartyRow
              key={party.id}
              party={party}
              currency={currency}
              personal={personal}
              onPress={() => router.push({ pathname: '/(app)/parties/[id]', params: { id: party.id } })}
            />
          ))}
        </View>
      </ScrollView>

      <PartyFormSheet
        visible={createVisible}
        seed={contactSeed}
        onClose={() => {
          setCreateVisible(false);
          setContactSeed(null);
        }}
      />
      <DeviceContactSheet
        visible={phoneSheetVisible}
        onClose={() => setPhoneSheetVisible(false)}
        onPick={(draft) => {
          setContactSeed(draft);
          setCreateVisible(true);
        }}
      />
    </Screen>
  );
}

function PartyRow({
  currency,
  onPress,
  party,
  personal,
}: {
  party: Party;
  currency: string;
  personal?: boolean;
  onPress: () => void;
}) {
  const colors = usePalette();
  const meta = getPartyBalanceMeta(party, undefined, personal);
  const toneColor = getBalanceColor(meta.tone, colors);
  const toneSoft = getBalanceSoftColor(meta.tone, colors);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: colors.surface, borderColor: colors.border },
        pressed && styles.rowPressed,
      ]}>
      <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
        <Text style={[styles.avatarText, { color: colors.white }]}>{partyInitials(party.name)}</Text>
      </View>
      <View style={styles.rowCopy}>
        <View style={styles.nameRow}>
          <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
            {party.name}
          </Text>
          {meta.tone !== 'settled' ? (
            <View style={[styles.badge, { backgroundColor: toneSoft }]}>
              <Text style={[styles.badgeText, { color: toneColor }]}>{meta.label}</Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.rowMeta, { color: colors.textMuted }]} numberOfLines={1}>
          {[party.phone || 'No phone', partyTypeLabel(party.type, personal)].join('  ·  ')}
        </Text>
      </View>
      <View style={styles.amountWrap}>
        <Text style={[styles.amount, { color: toneColor }]}>
          {meta.tone === 'settled' ? formatCurrency(0, currency) : formatCurrency(meta.absoluteAmount, currency)}
        </Text>
        <Text style={[styles.rowMeta, { color: colors.textSoft }]}>{meta.label}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  hero: {
    gap: spacing.xs,
  },
  title: {
    fontSize: typography.hero,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: typography.body,
    lineHeight: 22,
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
  rowPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.995 }],
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '800',
  },
  rowCopy: {
    flex: 1,
    gap: 3,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rowTitle: {
    flexShrink: 1,
    fontSize: typography.body,
    fontWeight: '700',
  },
  badge: {
    borderRadius: radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  rowMeta: {
    fontSize: typography.caption,
  },
  amountWrap: {
    alignItems: 'flex-end',
    gap: 2,
  },
  amount: {
    fontSize: typography.body,
    fontWeight: '800',
  },
  empty: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
  },
  emptyCard: {
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.xl,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: typography.subheading,
    fontWeight: '700',
  },
  emptyCopy: {
    fontSize: typography.body,
    lineHeight: 22,
    textAlign: 'center',
  },
});
