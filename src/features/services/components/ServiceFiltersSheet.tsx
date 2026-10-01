import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/src/shared/feedback/BottomSheet';
import { SearchField } from '@/src/shared/ui/SearchField';
import { FilterChip } from '@/src/shared/ui/FilterChip';
import { partyInitials } from '@/src/features/parties/lib/party';
import {
  countServiceFilters,
  EMPTY_SERVICE_FILTERS,
  type ServiceFilters,
} from '@/src/features/services/lib/service-view';
import { usePalette } from '@/src/stores/theme-store';
import { radius, spacing, typography } from '@/src/theme';
import type { AppPalette } from '@/src/theme/app-palette';
import { useThemedStyles } from '@/src/theme/use-themed-styles';
import type { Party } from '@/src/types/models';

/** Everyone who could have opened a job, to pick from by name. */
export interface ServiceCreatorOption {
  id: string;
  name: string;
}

interface ServiceFiltersSheetProps {
  visible: boolean;
  value: ServiceFilters;
  parties: Party[];
  creators: ServiceCreatorOption[];
  isGym?: boolean;
  onApply: (filters: ServiceFilters) => void;
  onClose: () => void;
}

/** How many customers to list before asking the shopkeeper to search. */
const PARTY_PREVIEW = 6;

/**
 * Customer, who opened the job, and physical or online — the three narrowings
 * kept off the list screen so they cost it a single row.
 */
export function ServiceFiltersSheet({
  creators,
  isGym,
  onApply,
  onClose,
  parties,
  value,
  visible,
}: ServiceFiltersSheetProps) {
  const colors = usePalette();
  const styles = useThemedStyles(createStyles);
  const [draft, setDraft] = useState<ServiceFilters>(value);
  const [partySearch, setPartySearch] = useState('');

  // Open on what the list is showing now, not on whatever was last tinkered with.
  useEffect(() => {
    if (!visible) return;
    setDraft(value);
    setPartySearch('');
  }, [value, visible]);

  const matchingParties = useMemo(() => {
    const query = partySearch.trim().toLowerCase();
    const matches = query
      ? parties.filter(
          (party) =>
            party.name?.toLowerCase().includes(query) || String(party.phone || '').includes(query),
        )
      : parties;
    // Whoever is picked stays in view even when the search would hide them.
    const picked = draft.partyId ? parties.find((party) => party.id === draft.partyId) : undefined;
    const shown = matches.slice(0, PARTY_PREVIEW);
    return picked && !shown.some((party) => party.id === picked.id) ? [picked, ...shown] : shown;
  }, [draft.partyId, parties, partySearch]);

  const chosenCount = countServiceFilters(draft);
  const customerLabel = isGym ? 'Member' : 'Customer';

  return (
    <BottomSheet
      visible={visible}
      title="Filter jobs"
      subtitle="Type, who opened it, and who it is for."
      onClose={onClose}
      heightRatio={0.78}
      footer={
        <View style={styles.footer}>
          <Pressable
            onPress={() => setDraft(EMPTY_SERVICE_FILTERS)}
            disabled={!chosenCount}
            style={[
              styles.clear,
              { borderColor: colors.border },
              !chosenCount && styles.dimmed,
            ]}>
            <Text style={[styles.clearLabel, { color: colors.textMuted }]}>Clear all</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              onApply(draft);
              onClose();
            }}
            style={[styles.apply, { backgroundColor: colors.primary }]}>
            <Text style={[styles.applyLabel, { color: colors.onPrimary }]}>
              {chosenCount ? `Show results · ${chosenCount}` : 'Show all jobs'}
            </Text>
          </Pressable>

        </View>
      }>
      <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Type</Text>
      <View style={styles.chipRow}>
        {[
          { label: 'Any', value: '' },
          { label: 'Physical', value: 'physical' },
          { label: 'Online', value: 'online' },
        ].map((option) => (
          <FilterChip
            key={option.value || 'any'}
            label={option.label}
            selected={draft.storeType === option.value}
            onPress={() => setDraft((current) => ({ ...current, storeType: option.value }))}
          />
        ))}
      </View>

      <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Opened by</Text>
      {creators.length ? (
        <View style={styles.chipRow}>
          <FilterChip
            label="Anyone"
            selected={!draft.createdBy}
            onPress={() => setDraft((current) => ({ ...current, createdBy: '' }))}
          />
          {creators.map((creator) => (
            <FilterChip
              key={creator.id}
              label={creator.name}
              selected={draft.createdBy === creator.id}
              onPress={() =>
                setDraft((current) => ({
                  ...current,
                  createdBy: current.createdBy === creator.id ? '' : creator.id,
                }))
              }
            />
          ))}
        </View>
      ) : (
        <Text style={[styles.empty, { color: colors.textSoft }]}>
          No one else has opened a job yet.
        </Text>
      )}

      <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{customerLabel}</Text>
      <SearchField
        placeholder={`Search ${customerLabel.toLowerCase()} by name or phone`}
        value={partySearch}
        onChangeText={setPartySearch}
      />
      <View style={styles.partyList}>
        <Pressable
          onPress={() => setDraft((current) => ({ ...current, partyId: '' }))}
          style={[
            styles.partyRow,
            !draft.partyId && { backgroundColor: colors.accentSoft },
          ]}>
          <View style={[styles.avatar, { backgroundColor: colors.backgroundAlt }]}>
            <MaterialCommunityIcons name="account-group-outline" size={16} color={colors.textMuted} />
          </View>
          <Text style={[styles.partyName, { color: colors.text }]}>Everyone</Text>
          {!draft.partyId ? (
            <MaterialCommunityIcons name="check" size={18} color={colors.primary} />
          ) : null}
        </Pressable>

        {matchingParties.map((party) => {
          const active = draft.partyId === party.id;
          return (
            <Pressable
              key={party.id}
              onPress={() =>
                setDraft((current) => ({ ...current, partyId: active ? '' : party.id }))
              }
              style={[styles.partyRow, active && { backgroundColor: colors.accentSoft }]}>
              <View style={[styles.avatar, { backgroundColor: colors.backgroundAlt }]}>
                <Text style={[styles.avatarText, { color: colors.textMuted }]}>
                  {partyInitials(party.name)}
                </Text>
              </View>
              <View style={styles.partyCopy}>
                <Text style={[styles.partyName, { color: colors.text }]} numberOfLines={1}>
                  {party.name}
                </Text>
                {party.phone ? (
                  <Text style={[styles.partyPhone, { color: colors.textMuted }]} numberOfLines={1}>
                    {party.phone}
                  </Text>
                ) : null}
              </View>
              {active ? <MaterialCommunityIcons name="check" size={18} color={colors.primary} /> : null}
            </Pressable>
          );
        })}

        {!matchingParties.length ? (
          <Text style={[styles.empty, { color: colors.textSoft }]}>
            {partySearch.trim() ? `No one matches “${partySearch.trim()}”.` : 'No customers saved yet.'}
          </Text>
        ) : null}
      </View>
    </BottomSheet>
  );
}

const createStyles = (colors: AppPalette) =>
  StyleSheet.create({
    sectionLabel: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      marginTop: spacing.xs,
      marginBottom: spacing.xxs,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xxs,
    },
    partyList: {
      marginTop: spacing.xxs,
      gap: 2,
    },
    // Rows are told apart by their own tint and spacing. Dividers between them
    // sat against the text with nothing to breathe through.
    partyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      minHeight: 46,
      paddingHorizontal: spacing.xs,
      paddingVertical: spacing.xxs,
      borderRadius: radius.sm,
    },
    avatar: {
      width: 28,
      height: 28,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      fontSize: 10,
      fontWeight: '800',
    },
    partyCopy: {
      flex: 1,
    },
    partyName: {
      flex: 1,
      fontSize: typography.label,
      fontWeight: '600',
    },
    partyPhone: {
      fontSize: 11,
    },
    empty: {
      fontSize: typography.caption,
      paddingVertical: spacing.xs,
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    clear: {
      minHeight: 48,
      paddingHorizontal: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    clearLabel: {
      fontSize: typography.label,
      fontWeight: '700',
    },
    dimmed: {
      opacity: 0.5,
    },
    apply: {
      flex: 1,
      minHeight: 48,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    applyLabel: {
      fontSize: typography.body,
      fontWeight: '800',
    },
  });
