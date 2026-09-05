import { router } from 'expo-router';
import { formatCurrency, prettyDate } from '@/src/shared/lib/format';
import { useReceiptStore } from '@/src/stores/receipt-store';
import { getStatementRowTitle, getStatementTypeLabel, toAmount } from '@/src/features/parties/lib/party';
import type {
  BusinessProfile,
  Party,
  PartyStatementRow,
  PartyStatementSummary,
  PartyTransaction,
  Purchase,
  Sale,
  Service,
} from '@/src/types/models';

export interface ReceiptLine {
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface ReceiptInput {
  heading: string;
  reference: string;
  date: string;
  dateLabel?: string;
  subtitle?: string;
  lines: ReceiptLine[];
  subTotal: number;
  taxTotal: number;
  discountTotal: number;
  grandTotal: number;
  amountReceived?: number;
  paymentMethod?: string;
  accountName?: string;
  notes?: string;
  partyName?: string;
  partyPhone?: string;
}

export function buildReceiptHtml(input: ReceiptInput, profile?: BusinessProfile | null) {
  const businessName = profile?.businessName || profile?.name || 'PM';
  const businessPhone = profile?.phone ? `Phone: ${profile.phone}` : '';
  const businessAddress = profile?.address ? `${profile.address}` : '';
  const panVat = profile?.panNumber || profile?.pan || profile?.vatNumber || profile?.vat || profile?.taxNumber;
  const panLine = panVat ? `PAN / VAT No: ${panVat}` : '';
  const emailLine = profile?.email ? `Email: ${profile.email}` : '';

  const lineRows = (input.lines || [])
    .map(
      (line) => `
      <tr>
        <td style="padding: 9px 0; border-bottom: 1px solid #e2e8f0;">
          <div style="font-weight:700; color:#0f172a; font-size:13px;">${line.name}</div>
          <div style="color:#64748b; font-size:12px; margin-top:2px;">${line.quantity} × ${formatCurrency(line.unitPrice)}</div>
        </td>
        <td style="text-align:right; padding: 9px 0; border-bottom: 1px solid #e2e8f0; font-weight:700; color:#0f172a; font-size:13px;">
          ${formatCurrency(line.lineTotal)}
        </td>
      </tr>`,
    )
    .join('');

  const dateLine = input.dateLabel
    ? `${input.dateLabel}: ${prettyDate(input.date)}`
    : prettyDate(input.date);

  const due =
    input.amountReceived !== undefined
      ? Math.max(input.grandTotal - input.amountReceived, 0)
      : 0;

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${input.heading} - ${input.reference}</title>
        <style>
          * { box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            padding: 24px;
            color: #0f172a;
            max-width: 480px;
            margin: 0 auto;
            background: #ffffff;
            line-height: 1.4;
          }
          .header {
            text-align: center;
            margin-bottom: 20px;
            padding-bottom: 14px;
            border-bottom: 2px solid #0A2E20;
          }
          .store-name {
            font-size: 22px;
            font-weight: 800;
            margin: 0 0 4px 0;
            color: #0A2E20;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .store-meta {
            font-size: 12px;
            color: #475569;
            margin: 2px 0;
          }
          .store-tax {
            font-weight: 700;
            color: #0A2E20;
            margin-top: 3px;
          }
          .receipt-title {
            display: inline-block;
            background: #f1f5f9;
            color: #0A2E20;
            padding: 5px 14px;
            border-radius: 999px;
            font-size: 12px;
            font-weight: 800;
            margin-top: 10px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            border: 1px solid #e2e8f0;
          }
          .meta-table {
            width: 100%;
            margin-bottom: 16px;
            font-size: 13px;
          }
          .meta-table td {
            padding: 4px 0;
          }
          .meta-label {
            color: #64748b;
            width: 38%;
          }
          .meta-value {
            font-weight: 700;
            text-align: right;
            color: #0f172a;
          }
          table.items {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 16px;
          }
          table.items th {
            border-bottom: 2px solid #cbd5e1;
            padding-bottom: 8px;
            font-size: 11px;
            font-weight: 800;
            text-transform: uppercase;
            color: #475569;
            letter-spacing: 0.5px;
          }
          .totals {
            border-top: 1.5px dashed #94a3b8;
            padding-top: 12px;
            font-size: 13px;
          }
          .total-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 5px;
          }
          .grand-total {
            font-size: 16px;
            font-weight: 800;
            border-top: 1.5px solid #0f172a;
            padding-top: 8px;
            margin-top: 8px;
            color: #0f172a;
          }
          .status-badge {
            margin-top: 10px;
            padding: 9px 14px;
            border-radius: 8px;
            display: flex;
            justify-content: space-between;
            font-weight: 800;
            font-size: 13px;
          }
          .status-paid {
            background: #e6f4ea;
            color: #0d6832;
            border: 1px solid #c2e7cc;
          }
          .status-due {
            background: #fde8e8;
            color: #b91c1c;
            border: 1px solid #f8b4b4;
          }
          .footer {
            margin-top: 24px;
            text-align: center;
            font-size: 11px;
            color: #94a3b8;
            border-top: 1px dashed #e2e8f0;
            padding-top: 12px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="store-name">${businessName}</div>
          ${businessAddress ? `<div class="store-meta">${businessAddress}</div>` : ''}
          ${businessPhone ? `<div class="store-meta">${businessPhone}</div>` : ''}
          ${panLine ? `<div class="store-meta store-tax">${panLine}</div>` : ''}
          ${emailLine ? `<div class="store-meta">${emailLine}</div>` : ''}
          <div class="receipt-title">${input.heading}</div>
        </div>

        <table class="meta-table">
          <tr>
            <td class="meta-label">Reference / Bill No:</td>
            <td class="meta-value">${input.reference}</td>
          </tr>
          <tr>
            <td class="meta-label">Date:</td>
            <td class="meta-value">${dateLine}</td>
          </tr>
          ${
            input.partyName
              ? `<tr>
                  <td class="meta-label">Customer / Party:</td>
                  <td class="meta-value">${input.partyName}</td>
                </tr>`
              : ''
          }
          ${
            input.partyPhone
              ? `<tr>
                  <td class="meta-label">Contact Phone:</td>
                  <td class="meta-value">${input.partyPhone}</td>
                </tr>`
              : ''
          }
          ${
            input.accountName || input.paymentMethod
              ? `<tr>
                  <td class="meta-label">Payment Mode:</td>
                  <td class="meta-value">${input.accountName || input.paymentMethod?.toUpperCase()}</td>
                </tr>`
              : ''
          }
        </table>

        ${
          input.lines && input.lines.length > 0
            ? `
            <table class="items">
              <thead>
                <tr>
                  <th style="text-align:left;">Item / Description</th>
                  <th style="text-align:right;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${lineRows}
              </tbody>
            </table>
            `
            : ''
        }

        <div class="totals">
          <div class="total-row">
            <span>Subtotal:</span>
            <span>${formatCurrency(input.subTotal)}</span>
          </div>
          ${
            input.taxTotal > 0
              ? `<div class="total-row">
                  <span>VAT / Tax:</span>
                  <span>${formatCurrency(input.taxTotal)}</span>
                </div>`
              : ''
          }
          ${
            input.discountTotal > 0
              ? `<div class="total-row" style="color:#d32f2f;">
                  <span>Discount:</span>
                  <span>-${formatCurrency(input.discountTotal)}</span>
                </div>`
              : ''
          }
          <div class="total-row grand-total">
            <span>Total Amount:</span>
            <span>${formatCurrency(input.grandTotal)}</span>
          </div>

          ${
            input.amountReceived !== undefined
              ? `
              <div class="total-row" style="margin-top:6px;">
                <span>Paid / Settled:</span>
                <span>${formatCurrency(input.amountReceived)}</span>
              </div>
              <div class="status-badge ${due > 0 ? 'status-due' : 'status-paid'}">
                <span>${due > 0 ? 'Balance Due:' : 'Status:'}</span>
                <span>${due > 0 ? formatCurrency(due) : 'Fully Settled / Paid'}</span>
              </div>
              `
              : ''
          }
        </div>

        ${
          input.notes
            ? `<div style="margin-top:12px; font-size:12px; color:#475569; background:#f8fafc; padding:8px; border-radius:6px;">
                <strong>Note:</strong> ${input.notes}
              </div>`
            : ''
        }

        <div class="footer">
          <p>Generated by PM Digital Bill & POS</p>
          <p>Thank you for your business!</p>
        </div>
      </body>
    </html>
  `;
}

/**
 * Generates Receipt for an individual Party Transaction (Money Received / Paid)
 */
export function buildPartyTransactionReceipt(
  tx: PartyTransaction,
  party?: Party | null,
  profile?: BusinessProfile | null,
  bankName?: string
) {
  const isReceive = tx.direction === 'receive';
  const heading = isReceive ? 'PAYMENT RECEIPT (INCOME)' : 'PAYMENT VOUCHER (EXPENSE)';
  const amount = Number(tx.amount || 0);

  const input: ReceiptInput = {
    heading,
    reference: `TX-${tx.id ? String(tx.id).slice(-6).toUpperCase() : Date.now().toString().slice(-6)}`,
    date: tx.txDate || new Date().toISOString(),
    dateLabel: 'Transaction Date',
    partyName: party?.name ? String(party.name) : (tx as any).partyName ? String((tx as any).partyName) : undefined,
    partyPhone: party?.phone ? String(party.phone) : (tx as any).partyPhone ? String((tx as any).partyPhone) : undefined,
    paymentMethod: tx.paymentMethod,
    accountName: bankName || (tx.paymentMethod === 'bank' ? 'Bank Account' : 'Cash in Hand'),
    notes: tx.note ? String(tx.note) : undefined,
    lines: [
      {
        name: tx.note ? String(tx.note) : isReceive ? 'Payment Received' : 'Payment Made',
        quantity: 1,
        unitPrice: amount,
        lineTotal: amount,
      },
    ],
    subTotal: amount,
    taxTotal: 0,
    discountTotal: 0,
    grandTotal: amount,
    amountReceived: amount,
  };

  const html = buildReceiptHtml(input, profile);
  return { input, html };
}

/**
 * Generates Receipt for an individual Purchase / Expense
 */
export function buildExpenseReceipt(
  purchase: Purchase,
  profile?: BusinessProfile | null,
  bankName?: string
) {
  const isExpense = purchase.entryType === 'expense';
  const heading = isExpense ? 'EXPENSE VOUCHER' : 'PURCHASE BILL';
  const grandTotal = Number(purchase.grandTotal || 0);
  const amountReceived = Number(purchase.amountReceived || 0);

  const lines: ReceiptLine[] =
    purchase.items && purchase.items.length > 0
      ? purchase.items.map((it: any) => ({
          name: String(it.description || it.productName || 'Item'),
          quantity: Number(it.quantity || 1),
          unitPrice: Number(it.unitPrice || it.rate || 0),
          lineTotal: Number(it.lineTotal || it.amount || 0),
        }))
      : [
          {
            name: purchase.notes ? String(purchase.notes) : isExpense ? 'Expense' : 'Purchase',
            quantity: 1,
            unitPrice: grandTotal,
            lineTotal: grandTotal,
          },
        ];

  const input: ReceiptInput = {
    heading,
    reference: purchase.invoiceNo ? String(purchase.invoiceNo) : `EXP-${purchase.id ? String(purchase.id).slice(-6) : '000'}`,
    date: purchase.purchaseDate || new Date().toISOString(),
    partyName: purchase.partyName ? String(purchase.partyName) : undefined,
    paymentMethod: purchase.paymentMethod,
    accountName: bankName,
    notes: purchase.notes ? String(purchase.notes) : undefined,
    lines,
    subTotal: Number(purchase.subTotal || grandTotal),
    taxTotal: Number(purchase.taxTotal || 0),
    discountTotal: Number(purchase.discountTotal || 0),
    grandTotal,
    amountReceived,
  };

  const html = buildReceiptHtml(input, profile);
  return { input, html };
}

/**
 * Generates Receipt for an individual Sale
 */
export function buildSaleReceipt(
  sale: Sale,
  profile?: BusinessProfile | null,
  bankName?: string
) {
  const grandTotal = Number(sale.grandTotal || 0);
  const amountReceived = Number(sale.amountReceived || 0);

  const lines: ReceiptLine[] =
    sale.items && sale.items.length > 0
      ? sale.items.map((it: any) => ({
          name: String(it.productName || it.description || 'Product'),
          quantity: Number(it.quantity || 1),
          unitPrice: Number(it.unitPrice || 0),
          lineTotal: Number(it.lineTotal || 0),
        }))
      : [
          {
            name: 'Sale Bill',
            quantity: 1,
            unitPrice: grandTotal,
            lineTotal: grandTotal,
          },
        ];

  const input: ReceiptInput = {
    heading: 'TAX INVOICE / SALE RECEIPT',
    reference: sale.invoiceNo ? String(sale.invoiceNo) : `INV-${sale.id ? String(sale.id).slice(-6) : '000'}`,
    date: sale.saleDate || new Date().toISOString(),
    partyName: (sale as any).party?.name ? String((sale as any).party.name) : sale.partyName ? String(sale.partyName) : 'Walk-in Customer',
    partyPhone: (sale as any).party?.phone ? String((sale as any).party.phone) : (sale as any).partyPhone ? String((sale as any).partyPhone) : undefined,
    paymentMethod: sale.paymentMethod,
    accountName: bankName,
    notes: sale.notes ? String(sale.notes) : undefined,
    lines,
    subTotal: Number(sale.subTotal || grandTotal),
    taxTotal: Number(sale.taxTotal || 0),
    discountTotal: Number(sale.discountTotal || 0),
    grandTotal,
    amountReceived,
  };

  const html = buildReceiptHtml(input, profile);
  return { input, html };
}

/**
 * Generates Receipt for an individual Service Job / Membership
 */
export function buildServiceReceipt(
  service: Service,
  profile?: BusinessProfile | null,
  customer?: { name?: string; phone?: string; address?: string } | null,
  bankName?: string
) {
  const isGym = profile?.businessType === 'gym' || profile?.type === 'gym';
  const heading = isGym ? 'MEMBERSHIP / SERVICE INVOICE' : 'SERVICE JOB INVOICE';
  const grandTotal = Number(service.grandTotal || 0);
  const receivedTotal = Number(service.receivedTotal || 0);

  const lines: ReceiptLine[] =
    service.items && service.items.length > 0
      ? service.items.map((it: any) => ({
          name: String(it.description || it.productName || it.productId || it.itemType || 'Service / Item'),
          quantity: Number(it.quantity || 1),
          unitPrice: Number(it.unitPrice || 0),
          lineTotal: Number(it.lineTotal || Number(it.quantity || 1) * Number(it.unitPrice || 0)),
        }))
      : [
          {
            name: service.notes ? String(service.notes) : isGym ? 'Membership / Subscription' : 'Service Charges',
            quantity: 1,
            unitPrice: grandTotal,
            lineTotal: grandTotal,
          },
        ];

  const candidateAttrs = service.attributes || {};
  const extraDetails = [
    candidateAttrs.device || candidateAttrs.deviceName ? `Device: ${candidateAttrs.device || candidateAttrs.deviceName}` : '',
    candidateAttrs.model ? `Model: ${candidateAttrs.model}` : '',
    candidateAttrs.brand ? `Brand: ${candidateAttrs.brand}` : '',
    candidateAttrs.vehicleNo ? `Vehicle: ${candidateAttrs.vehicleNo}` : '',
    candidateAttrs.problem || candidateAttrs.issue ? `Problem: ${candidateAttrs.problem || candidateAttrs.issue}` : '',
    service.deliveryDate ? `${isGym ? 'Expiry Date' : 'Target Delivery'}: ${prettyDate(service.deliveryDate)}` : '',
    service.notes ? `Note: ${service.notes}` : '',
  ]
    .filter(Boolean)
    .join('  ·  ');

  const input: ReceiptInput = {
    heading,
    reference: service.orderNo ? String(service.orderNo) : `SO-${service.id ? String(service.id).slice(-6) : '000'}`,
    date:
      typeof service.createdAt === 'string' && service.createdAt
        ? service.createdAt
        : typeof service.updatedAt === 'string' && service.updatedAt
          ? service.updatedAt
          : new Date().toISOString(),
    dateLabel: 'Order Date',
    partyName: customer?.name || service.partyName || (service as any).customerName || 'Customer',
    partyPhone: customer?.phone || (service as any).customerPhone || (service as any).phone || undefined,
    paymentMethod: service.paymentMethod,
    accountName: bankName,
    notes: extraDetails || undefined,
    lines,
    subTotal: Number(service.subTotal || grandTotal),
    taxTotal: Number(service.taxTotal || 0),
    discountTotal: Number(service.discount || (service as any).discountTotal || 0),
    grandTotal,
    amountReceived: receivedTotal,
  };

  const html = buildReceiptHtml(input, profile);
  return { input, html };
}

/**
 * Generates Receipt / Bill Preview for all transactions of an individual party / user
 */
export function buildPartyStatementReceipt(
  party: Party,
  rows: PartyStatementRow[],
  summaryOrCurrentAmount?: PartyStatementSummary | number | null,
  profile?: BusinessProfile | null,
  personal = false
): { input: ReceiptInput; html: string } {
  const currentAmount =
    typeof summaryOrCurrentAmount === 'number'
      ? summaryOrCurrentAmount
      : Number(summaryOrCurrentAmount?.currentAmount ?? party.currentAmount ?? 0);

  const lines: ReceiptLine[] =
    rows.length > 0
      ? rows.map((r) => ({
          name: `${prettyDate(r.date)} - ${r.notes || r.type || 'Tx'}`,
          quantity: 1,
          unitPrice: toAmount(r.totalAmount || r.amount),
          lineTotal: toAmount(r.totalAmount || r.amount),
        }))
      : [
          {
            name: 'No transaction history',
            quantity: 1,
            unitPrice: 0,
            lineTotal: 0,
          },
        ];

  const totalVolume = rows.reduce((acc, r) => acc + toAmount(r.totalAmount || r.amount), 0);
  const totalDue = rows.reduce((acc, r) => acc + toAmount(r.dueAmount), 0);
  const settled = Math.max(0, totalVolume - totalDue);

  const heading = personal ? 'CONTACT STATEMENT BILL' : 'PARTY STATEMENT BILL';
  const balanceLabel =
    currentAmount > 0
      ? `To Receive: ${formatCurrency(currentAmount)}`
      : currentAmount < 0
        ? `To Pay: ${formatCurrency(Math.abs(currentAmount))}`
        : 'Balance Settled (0)';

  const input: ReceiptInput = {
    heading,
    reference: `STMT-${party.id ? String(party.id).slice(-6).toUpperCase() : Date.now().toString().slice(-6)}`,
    date: new Date().toISOString(),
    dateLabel: 'Statement Date',
    partyName: party.name,
    partyPhone: party.phone ? String(party.phone) : undefined,
    notes: `Account Status: ${balanceLabel} · Total ${rows.length} transactions`,
    lines,
    subTotal: totalVolume,
    taxTotal: 0,
    discountTotal: 0,
    grandTotal: totalVolume,
    amountReceived: settled,
  };

  const html = buildReceiptHtml(input, profile);
  return { input, html };
}

/**
 * Quick helper to set receipt store and navigate to Print Preview screen
 */
export function openReceiptPreview(
  param1: ReceiptInput | { input: ReceiptInput; html: string } | { push: (route: any) => void },
  param2?: ReceiptInput | string | { push: (route: any) => void },
  param3?: string
) {
  let data: ReceiptInput;
  let html: string;

  if (typeof param1 === 'object' && 'input' in param1 && 'html' in param1) {
    data = param1.input;
    html = param1.html;
  } else if (typeof param1 === 'object' && 'heading' in param1 && typeof param2 === 'string') {
    data = param1 as ReceiptInput;
    html = param2;
  } else if (typeof param2 === 'object' && 'heading' in param2 && typeof param3 === 'string') {
    data = param2 as ReceiptInput;
    html = param3;
  } else if (typeof param1 === 'object' && 'heading' in param1) {
    data = param1 as ReceiptInput;
    html = buildReceiptHtml(data);
  } else {
    return;
  }

  useReceiptStore.getState().setReceipt({
    title: data.reference,
    subtitle: data.partyName || data.heading,
    html,
    data,
  });
  router.push('/(app)/print-preview' as any);
}
