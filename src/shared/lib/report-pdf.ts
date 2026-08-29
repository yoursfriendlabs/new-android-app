import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';

import { formatCurrency, prettyDate } from '@/src/shared/lib/format';
import { getStatementRowTitle, getStatementTypeLabel, toAmount } from '@/src/features/parties/lib/party';
import type { LedgerEntry, Party, PartyStatementRow, Purchase } from '@/src/types/models';

export function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function documentShell(title: string, body: string, subtitle?: string) {
  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(title)}</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 28px; color: #1f1a16; font-size: 13px;">
        <h1 style="margin: 0 0 4px 0; font-size: 22px; color: #9b6835;">${escapeHtml(title)}</h1>
        ${subtitle ? `<p style="margin: 0 0 18px 0; color: #6d6257;">${escapeHtml(subtitle)}</p>` : '<div style="height: 14px;"></div>'}
        ${body}
        <p style="margin-top: 24px; font-size: 11px; color: #8a7f75;">Generated ${escapeHtml(prettyDate(new Date().toISOString()))}</p>
      </body>
    </html>
  `;
}

function money(value: number, currency: string) {
  return escapeHtml(formatCurrency(value, currency));
}

export async function printHtmlDocument(html: string) {
  await Print.printAsync({ html });
}

export async function shareHtmlAsPdf(html: string, dialogTitle = 'Share PDF') {
  const result = await Print.printToFileAsync({ html });
  if (!(await Sharing.isAvailableAsync())) {
    Alert.alert('Sharing unavailable', 'A PDF was created, but this device cannot share files.');
    return;
  }
  await Sharing.shareAsync(result.uri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle,
  });
}

export function buildLedgerReportHtml(input: {
  businessName: string;
  partyName?: string;
  from?: string;
  to?: string;
  currency: string;
  entries: LedgerEntry[];
  totalDebit: number;
  totalCredit: number;
}) {
  const period =
    input.from && input.to
      ? `${prettyDate(input.from)} – ${prettyDate(input.to)}`
      : 'All dates';
  const rows = input.entries
    .map(
      (entry) => `
        <tr>
          <td style="padding: 8px 6px; border-bottom: 1px solid #ece2d8;">${escapeHtml(prettyDate(entry.entryDate))}</td>
          <td style="padding: 8px 6px; border-bottom: 1px solid #ece2d8;">
            <strong>${escapeHtml(entry.refNo || entry.description || 'Entry')}</strong><br />
            <span style="color:#6d6257;">${escapeHtml(entry.partyName || entry.description || entry.refType || '')}</span>
          </td>
          <td style="padding: 8px 6px; border-bottom: 1px solid #ece2d8; text-align: right;">${money(Number(entry.debit || 0), input.currency)}</td>
          <td style="padding: 8px 6px; border-bottom: 1px solid #ece2d8; text-align: right;">${money(Number(entry.credit || 0), input.currency)}</td>
          <td style="padding: 8px 6px; border-bottom: 1px solid #ece2d8; text-align: right;">${money(Number(entry.runningBalance || 0), input.currency)} ${escapeHtml(entry.balanceDirection || '')}</td>
        </tr>`,
    )
    .join('');

  const body = `
    <p style="margin: 0 0 12px 0;"><strong>${escapeHtml(input.businessName)}</strong></p>
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
      <tr>
        <td style="padding: 8px; background: #f7efe7;">Debit<br /><strong>${money(input.totalDebit, input.currency)}</strong></td>
        <td style="padding: 8px; background: #f7efe7;">Credit<br /><strong>${money(input.totalCredit, input.currency)}</strong></td>
        <td style="padding: 8px; background: #f7efe7;">Net<br /><strong>${money(input.totalCredit - input.totalDebit, input.currency)}</strong></td>
      </tr>
    </table>
    <table style="width: 100%; border-collapse: collapse;">
      <thead>
        <tr>
          <th style="text-align: left; padding: 8px 6px; border-bottom: 2px solid #d8c4b0;">Date</th>
          <th style="text-align: left; padding: 8px 6px; border-bottom: 2px solid #d8c4b0;">Particulars</th>
          <th style="text-align: right; padding: 8px 6px; border-bottom: 2px solid #d8c4b0;">Debit</th>
          <th style="text-align: right; padding: 8px 6px; border-bottom: 2px solid #d8c4b0;">Credit</th>
          <th style="text-align: right; padding: 8px 6px; border-bottom: 2px solid #d8c4b0;">Balance</th>
        </tr>
      </thead>
      <tbody>
        ${rows || `<tr><td colspan="5" style="padding: 16px; color: #6d6257;">No ledger entries in this period.</td></tr>`}
      </tbody>
    </table>
  `;

  return documentShell(
    input.partyName ? `Ledger · ${input.partyName}` : 'Party ledger',
    body,
    period,
  );
}

export function buildPartyStatementHtml(input: {
  businessName: string;
  party: Party;
  currency: string;
  rows: PartyStatementRow[];
  currentAmount?: number;
}) {
  const rows = input.rows
    .map(
      (row) => `
        <tr>
          <td style="padding: 8px 6px; border-bottom: 1px solid #ece2d8;">${escapeHtml(prettyDate(row.date))}</td>
          <td style="padding: 8px 6px; border-bottom: 1px solid #ece2d8;">
            ${escapeHtml(getStatementTypeLabel(row.type))}<br />
            <span style="color:#6d6257;">${escapeHtml(getStatementRowTitle(row))}</span>
          </td>
          <td style="padding: 8px 6px; border-bottom: 1px solid #ece2d8; text-align: right;">${money(toAmount(row.totalAmount || row.amount), input.currency)}</td>
          <td style="padding: 8px 6px; border-bottom: 1px solid #ece2d8; text-align: right;">${money(toAmount(row.dueAmount), input.currency)}</td>
        </tr>`,
    )
    .join('');

  const body = `
    <p style="margin: 0 0 4px 0;"><strong>${escapeHtml(input.businessName)}</strong></p>
    <p style="margin: 0 0 12px 0; color: #6d6257;">${escapeHtml([input.party.phone, input.party.address].filter(Boolean).join(' · '))}</p>
    <p style="margin: 0 0 16px 0;">Current balance: <strong>${money(Number(input.currentAmount || 0), input.currency)}</strong></p>
    <table style="width: 100%; border-collapse: collapse;">
      <thead>
        <tr>
          <th style="text-align: left; padding: 8px 6px; border-bottom: 2px solid #d8c4b0;">Date</th>
          <th style="text-align: left; padding: 8px 6px; border-bottom: 2px solid #d8c4b0;">Entry</th>
          <th style="text-align: right; padding: 8px 6px; border-bottom: 2px solid #d8c4b0;">Amount</th>
          <th style="text-align: right; padding: 8px 6px; border-bottom: 2px solid #d8c4b0;">Due</th>
        </tr>
      </thead>
      <tbody>
        ${rows || `<tr><td colspan="4" style="padding: 16px; color: #6d6257;">No transactions yet.</td></tr>`}
      </tbody>
    </table>
  `;

  return documentShell(`Statement · ${input.party.name}`, body);
}

export function buildPartyBalancesHtml(input: {
  businessName: string;
  currency: string;
  parties: Array<{ name: string; type?: string; receive: number; give: number }>;
  toReceive: number;
  toGive: number;
}) {
  const rows = input.parties
    .map(
      (party) => `
        <tr>
          <td style="padding: 8px 6px; border-bottom: 1px solid #ece2d8;">${escapeHtml(party.name)}</td>
          <td style="padding: 8px 6px; border-bottom: 1px solid #ece2d8;">${escapeHtml(party.type || '')}</td>
          <td style="padding: 8px 6px; border-bottom: 1px solid #ece2d8; text-align: right;">${money(party.receive, input.currency)}</td>
          <td style="padding: 8px 6px; border-bottom: 1px solid #ece2d8; text-align: right;">${money(party.give, input.currency)}</td>
        </tr>`,
    )
    .join('');

  const body = `
    <p style="margin: 0 0 12px 0;"><strong>${escapeHtml(input.businessName)}</strong></p>
    <p style="margin: 0 0 16px 0;">To receive ${money(input.toReceive, input.currency)} · To give ${money(input.toGive, input.currency)}</p>
    <table style="width: 100%; border-collapse: collapse;">
      <thead>
        <tr>
          <th style="text-align: left; padding: 8px 6px; border-bottom: 2px solid #d8c4b0;">Party</th>
          <th style="text-align: left; padding: 8px 6px; border-bottom: 2px solid #d8c4b0;">Type</th>
          <th style="text-align: right; padding: 8px 6px; border-bottom: 2px solid #d8c4b0;">To receive</th>
          <th style="text-align: right; padding: 8px 6px; border-bottom: 2px solid #d8c4b0;">To give</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;

  return documentShell('Party balances', body);
}

export function buildExpenseReportHtml(input: {
  businessName: string;
  currency: string;
  periodLabel: string;
  items: Purchase[];
  total: number;
  due: number;
  title?: string;
  itemLabel?: (item: Purchase) => string;
}) {
  const rows = input.items
    .map(
      (item) => `
        <tr>
          <td style="padding: 8px 6px; border-bottom: 1px solid #ece2d8;">${escapeHtml(prettyDate(item.purchaseDate))}</td>
          <td style="padding: 8px 6px; border-bottom: 1px solid #ece2d8;">
            ${escapeHtml((input.itemLabel ? input.itemLabel(item) : item.partyName) || item.invoiceNo || 'Entry')}<br />
            <span style="color:#6d6257;">${escapeHtml(item.invoiceNo || item.notes || '')}</span>
          </td>
          <td style="padding: 8px 6px; border-bottom: 1px solid #ece2d8; text-align: right;">${money(Number(item.grandTotal || 0), input.currency)}</td>
          <td style="padding: 8px 6px; border-bottom: 1px solid #ece2d8; text-align: right;">${money(Math.max(0, Number(item.grandTotal || 0) - Number(item.amountReceived || 0)), input.currency)}</td>
        </tr>`,
    )
    .join('');

  const body = `
    <p style="margin: 0 0 12px 0;"><strong>${escapeHtml(input.businessName)}</strong></p>
    <p style="margin: 0 0 16px 0;">Total ${money(input.total, input.currency)} · Due ${money(input.due, input.currency)}</p>
    <table style="width: 100%; border-collapse: collapse;">
      <thead>
        <tr>
          <th style="text-align: left; padding: 8px 6px; border-bottom: 2px solid #d8c4b0;">Date</th>
          <th style="text-align: left; padding: 8px 6px; border-bottom: 2px solid #d8c4b0;">Details</th>
          <th style="text-align: right; padding: 8px 6px; border-bottom: 2px solid #d8c4b0;">Amount</th>
          <th style="text-align: right; padding: 8px 6px; border-bottom: 2px solid #d8c4b0;">Due</th>
        </tr>
      </thead>
      <tbody>
        ${rows || `<tr><td colspan="4" style="padding: 16px; color: #6d6257;">No records in this period.</td></tr>`}
      </tbody>
    </table>
  `;

  return documentShell(input.title || 'Expense report', body, input.periodLabel);
}
