import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PartyPickerSheet } from '@/src/components/forms/PartyPickerSheet';
import { Screen } from '@/src/components/layout/Screen';
import { PageHeading } from '@/src/components/ui/PageHeading';
import { SurfaceCard } from '@/src/components/ui/SurfaceCard';
import { formatCurrency, prettyDate } from '@/src/lib/format';
import { useDebouncedValue } from '@/src/hooks/useDebouncedValue';
import { useLedger, useParties } from '@/src/hooks/useAppQueries';
import { palette, radius, spacing, typography } from '@/src/theme';
import type { Party } from '@/src/types/models';

export default function LedgerScreen() {
  const [partySearch, setPartySearch] = useState('');
  const [pickerVisible, setPickerVisible] = useState(false);
  const [selectedParty, setSelectedParty] = useState<Party | null>(null);
  const debouncedPartySearch = useDebouncedValue(partySearch);
  const { data: parties } = useParties(debouncedPartySearch, 'both');
  const { data } = useLedger(selectedParty?.id);

  return (
    <Screen>
      <PageHeading
        title="Ledger"
        subtitle="Running balance is easier to read as cards than dense desktop tables."
      />

      <SurfaceCard
        title={selectedParty?.name ?? 'All parties'}
        subtitle={selectedParty ? 'Tap below to change filter' : 'Filter by party statement when needed.'}
        right={
          <Pressable onPress={() => setPickerVisible(true)}>
            <Text style={styles.filterLink}>Change</Text>
          </Pressable>
        }>
        <Text style={styles.helper}>Receive and give amounts stay visible on each transaction.</Text>
      </SurfaceCard>

      <View style={styles.list}>
        {(data ?? []).map((entry) => (
          <SurfaceCard key={entry.id}>
            <View style={styles.row}>
              <View style={styles.copy}>
                <Text style={styles.title}>{entry.refNo ?? entry.description ?? 'Ledger entry'}</Text>
                <Text style={styles.meta}>{prettyDate(entry.entryDate)}</Text>
              </View>
              <View style={styles.side}>
                <Text style={styles.value}>{formatCurrency((entry.credit ?? 0) - (entry.debit ?? 0))}</Text>
                <Text style={styles.runningBalance}>
                  Balance {formatCurrency(entry.runningBalance ?? 0)} {entry.balanceDirection ?? ''}
                </Text>
              </View>
            </View>
          </SurfaceCard>
        ))}
      </View>

      <PartyPickerSheet
        visible={pickerVisible}
        search={partySearch}
        onSearchChange={setPartySearch}
        parties={parties ?? []}
        onPick={(party) => {
          setSelectedParty(party);
          setPickerVisible(false);
        }}
        onClose={() => setPickerVisible(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  filterLink: {
    color: palette.primary,
    fontWeight: '700',
  },
  helper: {
    fontSize: typography.body,
    color: palette.textMuted,
  },
  list: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  copy: {
    flex: 1,
    gap: spacing.xxs,
  },
  title: {
    fontSize: typography.body,
    fontWeight: '700',
    color: palette.text,
  },
  meta: {
    fontSize: typography.label,
    color: palette.textMuted,
  },
  side: {
    alignItems: 'flex-end',
    gap: spacing.xxs,
  },
  value: {
    fontSize: typography.body,
    fontWeight: '800',
    color: palette.text,
  },
  runningBalance: {
    fontSize: typography.caption,
    color: palette.textSoft,
    textAlign: 'right',
  },
});
