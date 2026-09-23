import { formatCurrency } from '@/src/shared/lib/format';
import type { DashboardSummary } from '@/src/types/models';

/**
 * The day's numbers as a message a shopkeeper can send on WhatsApp or Viber.
 * Plain text on purpose: it arrives readable in every app, needs no image
 * permissions, and the last line quietly says where it came from.
 */

type Translate = (key: string, params?: Record<string, string | number>) => string;

export interface ShareSummaryInput {
  isPersonal: boolean;
  t: Translate;
  currency?: string;
  /** Shop name for the heading; the app name is used when there is none. */
  title?: string;
  /** Human date for the heading, e.g. "23 Sep 2026". */
  dateLabel: string;
}

export function buildShareSummary(
  summary: DashboardSummary,
  { isPersonal, t, currency = 'NPR', title, dateLabel }: ShareSummaryInput,
): string {
  const money = (value: number) => formatCurrency(value, currency);
  const income = Number(summary.revenueTotal ?? summary.incomeTotal ?? 0);
  const expense = Number(summary.expenseTotal ?? 0);
  const sales = Number(summary.salesTotal ?? 0);
  const toReceive = Number(summary.toReceive ?? summary.pendingReceivable ?? 0);

  const lines = [`${title?.trim() || t('pekka.share.appName')} · ${dateLabel}`, ''];
  if (!isPersonal && sales > 0) lines.push(t('pekka.share.sales', { value: money(sales) }));
  if (income > 0) lines.push(t('pekka.share.income', { value: money(income) }));
  if (expense > 0) lines.push(t('pekka.share.expense', { value: money(expense) }));
  if (income > 0 || expense > 0) lines.push(t('pekka.share.left', { value: money(income - expense) }));
  if (!isPersonal && toReceive > 0) lines.push(t('pekka.share.toReceive', { value: money(toReceive) }));
  if (lines.length === 2) lines.push(t('pekka.share.quiet'));
  lines.push('', t('pekka.share.footer'));
  return lines.join('\n');
}
