import type { Party, PaymentMethod, Purchase } from '@/src/types/models';

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

export function moneyCategoryFromPurchase(item: Purchase) {
  const fromLine = String(item.items?.[0]?.description ?? '').trim();
  if (fromLine) return fromLine.split(' · ')[0]?.trim() || fromLine;
  const fromNotes = moneyCategoryFromNote(item.notes);
  if (fromNotes && fromNotes !== 'Income') return fromNotes;
  const fromParty = String(item.partyName ?? '').trim();
  if (fromParty && !CATEGORY_PARTY_NAMES.has(fromParty.toLowerCase()) && fromParty.toLowerCase() !== WALK_IN_LABEL.toLowerCase()) {
    return fromParty;
  }
  return moneyCategoryFromNote(item.notes);
}

export function buildMoneyPurchasePayload(input: {
  kind: 'income' | 'expense';
  category: string;
  amount: number;
  amountPaid: number;
  date: string;
  notes?: string;
  party?: Party | null;
  paymentMethod: PaymentMethod;
  bankId?: string;
  attachment?: string | null;
}) {
  const isIncome = input.kind === 'income';
  const note = moneyNote(input.category, input.notes);
  const amountPaid = isIncome ? input.amount : input.amountPaid;
  return {
    entryType: input.kind,
    ...(input.party?.id
      ? { partyId: input.party.id, partyName: moneyPersonLabel(input.party) }
      : {}),
    invoiceNo: `${isIncome ? 'INC' : 'EXP'}-${Date.now().toString().slice(-6)}`,
    purchaseDate: input.date,
    status: amountPaid >= input.amount ? 'received' : 'pending',
    notes: note,
    attachment: input.attachment || undefined,
    amountReceived: amountPaid,
    paymentMethod: input.paymentMethod,
    bankId: input.paymentMethod === 'bank' ? input.bankId : undefined,
    paymentNote: '',
    subTotal: input.amount,
    taxTotal: 0,
    grandTotal: input.amount,
    items: [
      {
        description: input.category,
        quantity: 1,
        unitType: 'primary',
        unitPrice: input.amount,
        taxRate: 0,
        lineTotal: input.amount,
        itemType: input.kind,
        categoryName: input.category,
        categoryType: input.kind,
        expenseCategoryName: input.category,
        expenseCategoryType: input.kind,
      },
    ],
  };
}
