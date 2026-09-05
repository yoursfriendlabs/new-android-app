import type { ComponentProps } from 'react';
import type MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export const COIN_REWARDS = {
  moneyLog: 1,
  money: 1,
  note: 1,
  reminder: 2,
  complete: 3,
  intervalCheckIn: 2,
  checkin: 2,
} as const;

export function coinLabel(amount: number) {
  const value = Math.max(0, Math.round(amount));
  return `${value} ${value === 1 ? 'coin' : 'coins'}`;
}

export function plusCoins(amount: number) {
  return `+${coinLabel(amount)}`;
}

export function minusCoins(amount: number) {
  return `−${coinLabel(amount)}`;
}

export type CoinReason =
  | 'money'
  | 'note'
  | 'reminder'
  | 'complete'
  | 'checkin'
  | 'redeem'
  | 'other';

export interface CoinEvent {
  id: string;
  at: string;
  amount: number;
  reason: CoinReason;
  label: string;
  claimId?: string;
}

export interface CoinRedemption {
  id: string;
  itemId: string;
  title: string;
  cost: number;
  at: string;
  status: 'requested' | 'fulfilled' | 'rejected' | string;
}

export interface CoinMerch {
  id: string;
  title: string;
  hint: string;
  cost: number;
  icon: IconName;
}

export const COIN_MERCH: CoinMerch[] = [
  { id: 'sticker', title: 'Sticker pack', hint: 'Laptop and bottle stickers', cost: 15, icon: 'sticker-emoji' },
  { id: 'pen', title: 'Pen', hint: 'A clean everyday pen', cost: 25, icon: 'pen' },
  { id: 'notebook', title: 'Notebook', hint: 'Pocket notebook for lists', cost: 40, icon: 'notebook-outline' },
  { id: 'cup', title: 'Cup', hint: 'Ceramic mug for slow mornings', cost: 60, icon: 'cup' },
  { id: 'tote', title: 'Tote bag', hint: 'Canvas bag for errands', cost: 80, icon: 'bag-personal-outline' },
  { id: 'tshirt', title: 'T-shirt', hint: 'Soft cotton merch tee', cost: 100, icon: 'tshirt-crew' },
];

export function coinReasonLabel(reason: CoinReason) {
  switch (reason) {
    case 'money':
      return 'Money log';
    case 'note':
      return 'Note';
    case 'reminder':
      return 'Reminder';
    case 'complete':
      return 'Completed';
    case 'checkin':
      return 'Check-in';
    case 'redeem':
      return 'Redeemed';
    default:
      return 'Coins';
  }
}

export function newCoinEvent(input: {
  amount: number;
  reason: CoinReason;
  label: string;
  claimId?: string;
}): CoinEvent {
  return {
    id: `ce_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    at: new Date().toISOString(),
    amount: Math.round(input.amount),
    reason: input.reason,
    label: input.label,
    claimId: input.claimId,
  };
}

export function moneyClaimId(sourceId?: string | null) {
  if (sourceId && String(sourceId).trim()) return `money:${String(sourceId).trim()}`;
  return `money:${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function serverReason(reason: CoinReason | undefined) {
  if (reason === 'money') return 'money';
  if (reason === 'note') return 'note';
  if (reason === 'reminder') return 'reminder';
  if (reason === 'complete') return 'complete';
  if (reason === 'checkin') return 'checkin';
  return null;
}

export const MERCH_ICONS: Record<string, IconName> = {
  sticker: 'sticker-emoji',
  pen: 'pen',
  notebook: 'notebook-outline',
  cup: 'cup',
  tote: 'bag-personal-outline',
  tshirt: 'tshirt-crew',
};

export function withMerchIcon(item: Omit<CoinMerch, 'icon'> & { icon?: IconName }): CoinMerch {
  return {
    ...item,
    icon: item.icon ?? MERCH_ICONS[item.id] ?? 'gift-outline',
  };
}
