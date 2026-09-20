import { router } from 'expo-router';

import { purchasesApi, salesApi, servicesApi } from '@/src/api';
import { normalizePurchase, normalizeSale, normalizeService } from '@/src/api/normalize';
import {
  buildExpenseReceipt,
  buildPartyTransactionReceipt,
  buildSaleReceipt,
  buildServiceReceipt,
  openReceiptPreview,
} from '@/src/shared/lib/receipt';
import type { BusinessProfile, MoneyFeedItem, Party, PartyTransaction } from '@/src/types/models';

/**
 * Opens the receipt for one money-feed row. Bills are fetched in full on tap,
 * because feed rows carry no line items; a party payment is complete as it is.
 */
export async function openFeedReceipt(item: MoneyFeedItem, profile?: BusinessProfile | null, bankName?: string) {
  if (item.source === 'party') {
    const tx: PartyTransaction = {
      id: item.sourceId,
      partyId: item.partyId ?? '',
      direction: item.kind === 'in' ? 'receive' : 'give',
      amount: item.billAmount,
      txDate: item.date,
      paymentMethod: (item.paymentMethod || 'cash') as PartyTransaction['paymentMethod'],
      bankId: item.bankId ?? undefined,
      note: item.note,
    };
    const party = item.partyId ? ({ id: item.partyId, name: item.partyName ?? '' } as Party) : null;
    const { input, html } = buildPartyTransactionReceipt(tx, party, profile, bankName);
    openReceiptPreview(router, input, html);
    return;
  }
  if (item.source === 'service') {
    const service = normalizeService(await servicesApi.get(item.sourceId));
    const { input, html } = buildServiceReceipt(service, profile, { name: item.partyName ?? undefined }, bankName);
    openReceiptPreview(router, input, html);
    return;
  }
  if (item.source === 'sale') {
    const sale = normalizeSale(await salesApi.get(item.sourceId));
    const { input, html } = buildSaleReceipt(sale, profile, bankName);
    openReceiptPreview(router, input, html);
    return;
  }
  const purchase = normalizePurchase(await purchasesApi.get(item.sourceId));
  const { input, html } = buildExpenseReceipt(purchase, profile, bankName);
  openReceiptPreview(router, input, html);
}
