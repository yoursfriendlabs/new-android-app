import { ApiError } from '@/src/api/client';
import { coinsApi } from '@/src/api';
import { submitWithOfflineQueue } from '@/src/data/sync';
import {
  COIN_MERCH,
  serverReason,
  withMerchIcon,
  type CoinEvent,
  type CoinMerch,
  type CoinReason,
  type CoinRedemption,
} from '@/src/features/habits/lib/coins';
import type { CoinAwardReason, CoinImportPayload, CoinSnapshotResponse } from '@/src/types/contracts';

export function isCoinsUnavailable(error: unknown) {
  if (error instanceof ApiError) {
    return error.status === 404 || error.status === 403;
  }
  return false;
}

function asReason(value: string | undefined): CoinReason {
  switch (value) {
    case 'money':
    case 'note':
    case 'reminder':
    case 'complete':
    case 'checkin':
    case 'redeem':
      return value;
    default:
      return 'other';
  }
}

export function mapCoinSnapshot(snapshot: CoinSnapshotResponse) {
  const history: CoinEvent[] = (snapshot.history ?? []).map((item) => ({
    id: item.id,
    claimId: item.claimId,
    reason: asReason(item.reason),
    amount: Math.round(Number(item.amount) || 0),
    label: item.label || 'Coins',
    at: item.at || item.createdAt || new Date().toISOString(),
  }));
  const redemptions: CoinRedemption[] = (snapshot.redemptions ?? []).map((item) => ({
    id: item.id,
    itemId: item.itemId,
    title: item.title,
    cost: Math.round(Number(item.cost) || 0),
    status: item.status || 'requested',
    at: item.at || item.createdAt || new Date().toISOString(),
  }));
  const merch: CoinMerch[] = (snapshot.merch?.length ? snapshot.merch : COIN_MERCH).map((item) =>
    withMerchIcon(item),
  );
  const claimedRewardIds = history
    .map((item) => item.claimId)
    .filter((value): value is string => Boolean(value))
    .slice(0, 80);

  return {
    coins: Math.max(0, Math.round(Number(snapshot.balance) || 0)),
    history,
    redemptions,
    merch,
    claimedRewardIds,
    importedAt: snapshot.importedAt ?? null,
  };
}

export function localImportClaims(input: {
  history: CoinEvent[];
  claimedRewardIds: string[];
}): CoinImportPayload['claims'] {
  const claims: CoinImportPayload['claims'] = [];
  const seen = new Set<string>();

  for (const event of input.history) {
    if (event.amount <= 0) continue;
    const reason = serverReason(event.reason);
    if (!reason) continue;
    const claimId = event.claimId || `import:${event.id}`;
    if (seen.has(claimId)) continue;
    seen.add(claimId);
    claims.push({
      claimId,
      reason,
      label: event.label,
      at: event.at,
    });
  }

  for (const claimId of input.claimedRewardIds) {
    if (seen.has(claimId)) continue;
    const reason = reasonFromClaimId(claimId);
    if (!reason) continue;
    seen.add(claimId);
    claims.push({ claimId, reason, label: 'Coins earned' });
  }

  return claims.slice(0, 80);
}

function reasonFromClaimId(claimId: string): CoinAwardReason | null {
  if (claimId.startsWith('money:')) return 'money';
  if (claimId.startsWith('create:')) return 'note';
  if (claimId.startsWith('complete:')) return 'complete';
  if (claimId.startsWith('checkin:')) return 'checkin';
  return null;
}

export async function fetchCoinSnapshot() {
  return coinsApi.snapshot();
}

export async function importLocalCoinClaims(claims: CoinImportPayload['claims']) {
  return coinsApi.importLocal({ claims });
}

export async function pushCoinAward(input: { claimId?: string; reason?: CoinReason; label?: string }) {
  const reason = serverReason(input.reason);
  const claimId = input.claimId?.trim();
  if (!claimId || !reason) return;
  try {
    await submitWithOfflineQueue({
      entityType: 'coins',
      method: 'POST',
      path: '/api/coins/award',
      body: {
        claimId,
        reason,
        label: input.label || 'Coins earned',
      } satisfies Record<string, unknown>,
    });
  } catch (error) {
    if (isCoinsUnavailable(error)) return;
    throw error;
  }
}

export async function pushCoinRedeem(itemId: string) {
  try {
    return await submitWithOfflineQueue({
      entityType: 'coins',
      method: 'POST',
      path: '/api/coins/redeem',
      body: { itemId } satisfies Record<string, unknown>,
    });
  } catch (error) {
    if (isCoinsUnavailable(error)) return { queued: false };
    throw error;
  }
}
