import type { AppPalette } from '@/src/theme/app-palette';
import type { Party, PartyStatementRow, PartyStatementType } from '@/src/types/models';

export type PartyBalanceTone = 'receive' | 'pay' | 'settled';

export interface PartyBalanceMeta {
  amount: number;
  absoluteAmount: number;
  tone: PartyBalanceTone;
  label: string;
}

export function toAmount(value: unknown) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount : 0;
}

export function partyInitials(name?: string | null) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return 'P';
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function partyTypeLabel(type?: string | null, personal = false) {
  if (personal) return 'Contact';
  const value = String(type || 'customer').toLowerCase();
  if (value === 'supplier') return 'Supplier';
  if (value === 'both') return 'Customer & supplier';
  return 'Customer';
}

export function getSignedPartyAmount(party?: Party | null) {
  if (!party) return 0;
  if (party.currentAmount != null && Number.isFinite(Number(party.currentAmount))) {
    return Number(party.currentAmount);
  }
  const receive = toAmount(party.receiveBalance);
  const give = toAmount(party.giveBalance);
  if (receive > 0) return -receive;
  if (give > 0) return give;
  return toAmount(party.balance);
}

export function getPartyBalanceMeta(party?: Party | null, signedAmount?: number, personal = false): PartyBalanceMeta {
  const amount = signedAmount ?? getSignedPartyAmount(party);

  if (amount < 0) {
    return {
      amount,
      absoluteAmount: Math.abs(amount),
      tone: 'receive',
      label: personal ? 'They owe me' : 'To receive',
    };
  }

  if (amount > 0) {
    return {
      amount,
      absoluteAmount: amount,
      tone: 'pay',
      label: personal ? 'I owe them' : 'To give',
    };
  }

  return {
    amount: 0,
    absoluteAmount: 0,
    tone: 'settled',
    label: 'Settled',
  };
}

export function getBalanceColor(tone: PartyBalanceTone, colors: AppPalette) {
  if (tone === 'receive') return colors.danger;
  if (tone === 'pay') return colors.info;
  return colors.textSoft;
}

export function getBalanceSoftColor(tone: PartyBalanceTone, colors: AppPalette) {
  if (tone === 'receive') return colors.dangerSoft;
  if (tone === 'pay') return colors.infoSoft;
  return colors.backgroundAlt;
}

export function getStatementTypeLabel(type?: PartyStatementType | null, personal = false) {
  switch (type) {
    case 'sale':
      return 'Sale';
    case 'service':
      return 'Service';
    case 'purchase':
      return 'Purchase';
    case 'expense':
      return 'Expense';
    case 'payment_in':
      return personal ? 'Received' : 'Payment in';
    case 'payment_out':
      return personal ? 'Paid' : 'Payment out';
    default:
      return type ? String(type).replace(/_/g, ' ') : 'Entry';
  }
}

export function getStatementRowTitle(row: PartyStatementRow) {
  if (row.note === 'Opening Balance') return 'Opening balance';
  switch (row.type) {
    case 'sale':
      return row.referenceNo ? `Invoice ${row.referenceNo}` : 'Sale';
    case 'service':
      return row.referenceNo ? `Order ${row.referenceNo}` : 'Service';
    case 'purchase':
      return row.referenceNo ? `Bill ${row.referenceNo}` : 'Purchase';
    case 'expense':
      return row.note || 'Expense';
    case 'payment_in':
      return row.note && row.note !== 'Opening Balance' ? row.note : 'Received';
    case 'payment_out':
      return row.note && row.note !== 'Opening Balance' ? row.note : 'Paid out';
    default:
      return row.referenceNo || row.note || 'Entry';
  }
}

export function getStatementAmount(row: PartyStatementRow) {
  if (row.type === 'payment_in' || row.type === 'payment_out') {
    return toAmount(row.amount);
  }
  return toAmount(row.totalAmount || row.amount);
}

export function isEditableStatementRow(row: PartyStatementRow) {
  if (row.note === 'Opening Balance') return false;
  return row.type === 'payment_in' || row.type === 'payment_out';
}

export function toWhatsAppDigits(phone?: string | null) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('977')) return digits;
  if (digits.length === 10) return `977${digits}`;
  return digits;
}

export function getPartyWhatsAppUrl(party?: Party | null, dueAmount?: number) {
  const digits = toWhatsAppDigits(party?.phone);
  if (!digits) return '';
  const name = String(party?.name || 'there').trim();
  const message =
    dueAmount && dueAmount > 0
      ? `Dear ${name},\nYour due amount is ${dueAmount}.\nThank you.`
      : `Hello ${name},`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
