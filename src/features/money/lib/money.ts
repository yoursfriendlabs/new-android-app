import type { Party } from '@/src/types/models';

export const WALK_IN_LABEL = 'Walk-in';

const CATEGORY_PARTY_NAMES = new Set(
  [
    'salary',
    'freelance',
    'family',
    'gift',
    'refund',
    'other',
    'food',
    'rent',
    'transport',
    'shopping',
    'bills',
    'health',
  ].map((name) => name.toLowerCase()),
);

export function isWalkInParty(party?: Party | null) {
  if (!party) return true;
  return party.name.trim().toLowerCase() === WALK_IN_LABEL.toLowerCase();
}

export function isHiddenMoneyParty(party?: Party | null) {
  if (!party) return false;
  if (isWalkInParty(party)) return true;
  const name = party.name.trim().toLowerCase();
  const hasPhone = Boolean(String(party.phone ?? '').trim());
  return CATEGORY_PARTY_NAMES.has(name) && !hasPhone;
}

export function visibleMoneyParties(parties: Party[] | undefined) {
  return (parties ?? []).filter((party) => !isHiddenMoneyParty(party));
}

export function moneyNote(category: string, notes?: string) {
  const extra = String(notes ?? '').trim();
  const label = category.trim() || 'Other';
  if (!extra || extra.toLowerCase() === label.toLowerCase()) return label;
  return `${label} · ${extra}`;
}

export function moneyCategoryFromNote(note?: string | null) {
  const value = String(note ?? '').trim();
  if (!value) return 'Income';
  return value.split(' · ')[0]?.trim() || 'Income';
}

export function moneyPersonLabel(party?: Party | null, fallbackName?: string | null) {
  if (party && !isHiddenMoneyParty(party)) return party.name;
  const name = String(fallbackName ?? '').trim();
  if (!name || CATEGORY_PARTY_NAMES.has(name.toLowerCase()) || name.toLowerCase() === WALK_IN_LABEL.toLowerCase()) {
    return WALK_IN_LABEL;
  }
  return name;
}
