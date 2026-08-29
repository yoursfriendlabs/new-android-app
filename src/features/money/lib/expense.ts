import type { ComponentProps } from 'react';
import type MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { parseISO } from 'date-fns';

import type { Purchase } from '@/src/types/models';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export function expenseDue(item: Purchase) {
  return Math.max(0, Number(item.grandTotal || 0) - Number(item.amountReceived || 0));
}

export function isExpensePaid(item: Purchase) {
  return expenseDue(item) < 0.5;
}

export function expenseCategory(item: Purchase) {
  const fromLine = String(item.items?.[0]?.description ?? '').trim();
  if (fromLine) return fromLine;
  const fromNotes = String(item.notes ?? '').trim();
  if (fromNotes) return fromNotes;
  const fromParty = String(item.partyName ?? '').trim();
  if (fromParty) return fromParty;
  return 'Uncategorized';
}

export function expenseTitle(item: Purchase) {
  const category = expenseCategory(item);
  const party = String(item.partyName ?? '').trim();
  if (party && party.toLowerCase() !== category.toLowerCase()) return party;
  return category;
}

export function isInCurrentMonth(isoDate?: string) {
  if (!isoDate) return true;
  try {
    const date = parseISO(isoDate);
    if (!Number.isFinite(date.getTime())) return true;
    const now = new Date();
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  } catch {
    return true;
  }
}

export function expenseCategoryIcon(name?: string | null): IconName {
  const key = String(name || '').toLowerCase();
  if (key.includes('rent') || key.includes('room')) return 'home-city-outline';
  if (key.includes('electric') || key.includes('utilit') || key.includes('power')) return 'flash-outline';
  if (key.includes('water')) return 'water-outline';
  if (key.includes('internet') || key.includes('wifi') || key.includes('phone')) return 'wifi';
  if (key.includes('tea') || key.includes('food') || key.includes('snack') || key.includes('lunch')) return 'food-outline';
  if (key.includes('fuel') || key.includes('petrol') || key.includes('diesel')) return 'gas-station-outline';
  if (key.includes('salary') || key.includes('wage') || key.includes('staff')) return 'account-cash-outline';
  if (key.includes('transport') || key.includes('travel') || key.includes('taxi')) return 'car-outline';
  if (key.includes('repair') || key.includes('maintain')) return 'wrench-outline';
  if (key.includes('stock') || key.includes('inventory') || key.includes('goods')) return 'package-variant-closed';
  if (key.includes('tax') || key.includes('vat')) return 'file-percent-outline';
  return 'cash-minus';
}
