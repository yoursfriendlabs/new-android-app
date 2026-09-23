import { formatCurrency } from '@/src/shared/lib/format';

/**
 * Collecting overdue money. Pekka writes the message; the shopkeeper sends it
 * from WhatsApp, SMS or anywhere else the phone offers. Nothing is sent
 * automatically — a reminder is a personal thing in a small shop.
 */

type Translate = (key: string, params?: Record<string, string | number>) => string;

export interface CollectTarget {
  id: string;
  name: string;
  amount: number;
  days: number;
  phone?: string;
}

/** Pekka nags about the same person at most once every few days. */
export const COLLECT_COOLDOWN_DAYS = 3;
export const COLLECT_ID_PREFIX = 'pekka-collect-';
/** When the day-close is off, late morning is a polite hour to ask for money. */
export const COLLECT_DEFAULT_HOUR = 11;

export function buildCollectMessage(
  target: Pick<CollectTarget, 'name' | 'amount'>,
  { t, currency = 'NPR' }: { t: Translate; currency?: string },
): string {
  return t('pekka.collect.message', { name: target.name, value: formatCurrency(target.amount, currency) });
}

/**
 * Digits only, with Nepal's country code added to a plain 10-digit mobile.
 * WhatsApp needs the country code; SMS is happy either way.
 */
export function phoneForLinks(phone?: string | null, countryCode = '977'): string {
  const digits = String(phone ?? '').replace(/[^\d+]/g, '');
  if (!digits) return '';
  const plain = digits.replace(/^\+/, '');
  if (digits.startsWith('+')) return plain;
  if (plain.length === 10 && plain.startsWith('9')) return `${countryCode}${plain}`;
  return plain;
}

export function whatsappUrl(phone: string, message: string): string {
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

/** iOS wants `&body=`, Android `?body=`; both accept this form in practice. */
export function smsUrl(phone: string, message: string): string {
  return `sms:${phone}?body=${encodeURIComponent(message)}`;
}

/** True when enough days have passed since the last reminder about anyone. */
export function canRemindAgain(lastIso?: string | null, now = new Date(), cooldownDays = COLLECT_COOLDOWN_DAYS): boolean {
  if (!lastIso) return true;
  const last = new Date(lastIso).getTime();
  if (!Number.isFinite(last)) return true;
  return now.getTime() - last >= cooldownDays * 24 * 60 * 60_000;
}

/** The most useful person to chase: longest overdue first, then the largest amount. */
export function topOverdue(list: CollectTarget[] = []): CollectTarget | null {
  const ranked = [...list]
    .filter((item) => Number(item.amount) > 0)
    .sort((a, b) => b.days - a.days || b.amount - a.amount);
  return ranked[0] ?? null;
}

/** Tomorrow at `hour`, or later today if that hour is still ahead. */
export function collectFireTime(hour: number, from = new Date()): Date {
  const at = new Date(from);
  at.setHours(hour, 0, 0, 0);
  if (at.getTime() <= from.getTime() + 60_000) at.setDate(at.getDate() + 1);
  return at;
}
