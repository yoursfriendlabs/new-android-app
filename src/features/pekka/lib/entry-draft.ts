import { partiesApi, productsApi } from '@/src/api';
import { normalizeParty, normalizeProduct } from '@/src/api/normalize';
import { matchPekkaNames } from '@/src/api/pekka';
import { formatCurrency } from '@/src/shared/lib/format';
import { isServiceProduct, toCartLine } from '@/src/features/pos/lib/cart-line';
import type { CartLineDraft } from '@/src/types/forms';
import type { Party } from '@/src/types/models';

import type { PekkaEntryGuess } from './entry-parser';
import { pickMatch } from './match';
import type { PekkaMoneyHandoff, PekkaSaleHandoff } from '../stores/pekka-handoff';

type Translate = (key: string, params?: Record<string, string | number>) => string;
type SaleGuess = Extract<PekkaEntryGuess, { type: 'sale' }>;
type MoneyGuess = Extract<PekkaEntryGuess, { type: 'money' }>;

export interface PreparedReply {
  text: string;
  /** Present when there is something to open; the chat shows it as a button. */
  handoff?: { type: 'sale'; draft: PekkaSaleHandoff; label: string } | { type: 'money'; draft: PekkaMoneyHandoff; label: string };
  /** A plain link instead, e.g. a customer's page to record a payment. */
  route?: { label: string; route: string };
}

async function findParty(name: string | null): Promise<Party | null> {
  if (!name) return null;
  try {
    const response = await matchPekkaNames('party', [name]);
    const match = pickMatch(response.results[0]?.matches);
    return match ? normalizeParty(await partiesApi.get(match.id)) : null;
  } catch {
    return null;
  }
}

export async function prepareSale(guess: SaleGuess, { t, currency }: { t: Translate; currency: string }): Promise<PreparedReply> {
  const money = (value: number) => formatCurrency(value, currency);
  const [productMatches, party] = await Promise.all([
    matchPekkaNames('product', guess.items.map((item) => item.name)),
    findParty(guess.partyName),
  ]);

  const lines: CartLineDraft[] = [];
  const missing: string[] = [];
  const warnings: string[] = [];
  await Promise.all(guess.items.map(async (item, index) => {
    const match = pickMatch(productMatches.results[index]?.matches);
    if (!match) { missing.push(item.name); return; }
    const product = normalizeProduct(await productsApi.get(match.id));
    const line = toCartLine(product, item.quantity);
    if (!isServiceProduct(product) && item.quantity > Number(line.stockOnHand ?? 0)) {
      warnings.push(t('pekka.entry.lowStock', { name: product.name, count: Number(line.stockOnHand ?? 0) }));
    }
    lines[index] = line;
  }));
  const items = lines.filter(Boolean);

  if (!items.length) {
    return { text: t('pekka.entry.noItems', { names: missing.join(', ') }) };
  }

  const total = items.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
  const credit = guess.payment === 'credit';
  const amountReceived = credit
    ? Math.max(0, guess.dueAmount != null ? total - guess.dueAmount : 0)
    : total;

  const summary = items.map((line) => `${line.quantity} × ${line.name}`).join(', ');
  const parts = [t('pekka.entry.saleReady', { items: summary, total: money(total) })];
  if (party) parts.push(t('pekka.entry.forCustomer', { name: party.name }));
  else if (guess.partyName) parts.push(t('pekka.entry.customerNotFound', { name: guess.partyName }));
  if (credit) {
    parts.push(t('pekka.entry.onCredit', { value: money(total - amountReceived) }));
    if (!party) parts.push(t('pekka.entry.pickCustomer'));
  }
  if (guess.total != null && Math.abs(guess.total - total) >= 1) {
    parts.push(t('pekka.entry.priceDiffers', { said: money(guess.total), listed: money(total) }));
  }
  if (missing.length) parts.push(t('pekka.entry.someMissing', { names: missing.join(', ') }));
  parts.push(...warnings);

  return {
    text: parts.join(' '),
    handoff: {
      type: 'sale',
      label: t('pekka.entry.openSale'),
      draft: { items, party, fullyPaid: !credit, amountReceived },
    },
  };
}

export async function prepareMoney(guess: MoneyGuess, { t, currency }: { t: Translate; currency: string }): Promise<PreparedReply> {
  const value = formatCurrency(guess.amount, currency);

  // Money in from a person settles their balance, so it belongs on their page.
  if (guess.kind === 'income' && guess.fromName) {
    const party = await findParty(guess.fromName);
    return party
      ? {
          text: t('pekka.entry.paymentFromParty', { name: party.name, value }),
          route: { label: t('pekka.tips.openParty', { name: party.name }), route: `/(app)/parties/${party.id}` },
        }
      : { text: t('pekka.entry.paymentFromUnknown', { name: guess.fromName, value }) };
  }

  const label = guess.label ? guess.label.charAt(0).toUpperCase() + guess.label.slice(1) : null;
  return {
    text: t(guess.kind === 'income' ? 'pekka.entry.incomeReady' : 'pekka.entry.expenseReady', {
      value,
      label: label ?? t('pekka.entry.noLabel'),
    }),
    handoff: {
      type: 'money',
      label: t('pekka.entry.openMoney'),
      draft: { kind: guess.kind, amount: guess.amount, category: label },
    },
  };
}
