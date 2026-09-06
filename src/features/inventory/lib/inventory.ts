import type { QueryClient } from '@tanstack/react-query';

import type { AppPalette } from '@/src/theme/app-palette';
import type { Product } from '@/src/types/models';

export const METAL_TYPE_OPTIONS = [
  { value: 'gold', label: 'Gold' },
  { value: 'silver', label: 'Silver' },
  { value: 'platinum', label: 'Platinum' },
  { value: 'other', label: 'Other' },
] as const;

const PURITY_BY_METAL: Record<string, string[]> = {
  gold: ['24K', '22K', '21K', '18K', '14K'],
  silver: ['999', '975', '925', '900'],
  platinum: ['950', '900'],
};

export function productInitials(name?: string | null) {
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

export function productBrand(product?: Product | null) {
  return String(product?.companyName || '').trim();
}

export function isRestockableProduct(product?: Product | null) {
  return String(product?.itemType || 'goods').toLowerCase() !== 'service';
}

export function getCurrentStock(product?: Product | null) {
  return Number(product?.stockOnHand ?? product?.openingStock ?? 0);
}

const NEAR_EXPIRY_DAYS = 20;

export function daysUntilExpiry(expiryDate?: string | null) {
  const value = String(expiryDate || '').trim();
  if (!value) return null;
  const expiry = new Date(value);
  if (Number.isNaN(expiry.getTime())) return null;
  expiry.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function expiryRemainingLabel(expiryDate?: string | null) {
  const days = daysUntilExpiry(expiryDate);
  if (days == null) return '';
  if (days < 0) return 'Expired';
  if (days === 0) return 'Expires today';
  return `${days} days left`;
}

export function isNearExpiryProduct(product?: Product | null) {
  if (!product || product.hasExpiredStock) return false;
  const fromProduct = daysUntilExpiry(product.expiryDate);
  if (fromProduct != null && fromProduct >= 0 && fromProduct <= NEAR_EXPIRY_DAYS) return true;
  return (product.batches ?? []).some((batch) => {
    if (batch.isExpired) return false;
    const days = daysUntilExpiry(batch.expiryDate);
    return days != null && days >= 0 && days <= NEAR_EXPIRY_DAYS;
  });
}

export type StockStatus = 'ok' | 'low' | 'out' | 'expired' | 'expiring';

export function getStockStatus(product?: Product | null): StockStatus {
  const stock = getCurrentStock(product);
  if (stock <= 0) return 'out';
  if (product?.hasExpiredStock) return 'expired';
  const min = Number(product?.minStockLevel ?? 0);
  if (min > 0 ? stock <= min : stock <= 5) return 'low';
  if (isNearExpiryProduct(product)) return 'expiring';
  return 'ok';
}

export function getStockStatusMeta(status: StockStatus, colors: AppPalette) {
  if (status === 'out') return { label: 'Out of stock', color: colors.danger, backgroundColor: colors.dangerSoft };
  if (status === 'expired') return { label: 'Expired stock', color: colors.danger, backgroundColor: colors.dangerSoft };
  if (status === 'expiring') return { label: 'Near expiry', color: colors.info, backgroundColor: colors.infoSoft };
  if (status === 'low') return { label: 'Low stock', color: colors.warning, backgroundColor: colors.warningSoft };
  return { label: 'In stock', color: colors.success, backgroundColor: colors.successSoft };
}

export function itemTypeLabel(itemType?: string | null) {
  const value = String(itemType || 'goods').toLowerCase();
  if (value === 'service') return 'Service';
  if (value === 'part') return 'Part';
  return 'Goods';
}

export function getPurityOptions(metalType?: string | null) {
  return PURITY_BY_METAL[String(metalType || '').trim().toLowerCase()] ?? [];
}

export function unitLabel(unit: { name?: string; symbol?: string } | string | null | undefined) {
  if (!unit) return '';
  if (typeof unit === 'string') return unit;
  const name = String(unit.name || '').trim();
  const symbol = String(unit.symbol || '').trim();
  if (name && symbol && name.toLowerCase() !== symbol.toLowerCase()) return `${name} (${symbol})`;
  return name || symbol;
}

export function invalidateInventoryQueries(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ['products'] }),
    queryClient.invalidateQueries({ queryKey: ['product'] }),
    queryClient.invalidateQueries({ queryKey: ['product-stats'] }),
    queryClient.invalidateQueries({ queryKey: ['inventory-summary'] }),
    queryClient.invalidateQueries({ queryKey: ['low-stock-products'] }),
    queryClient.invalidateQueries({ queryKey: ['stock-ledger'] }),
  ]);
}
