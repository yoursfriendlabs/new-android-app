import { router } from 'expo-router';
import { billDue, billPaid, billState, billStateLabel } from '@/src/shared/lib/bill-status';
import { formatCurrency, prettyDate } from '@/src/shared/lib/format';
import {
  isInvoiceIdentity,
  resolveInvoiceIdentity,
  type InvoiceIdentity,
} from '@/src/shared/lib/invoice-identity';
import { useReceiptStore } from '@/src/stores/receipt-store';
import {
  getStatementAmount,
  getStatementRowTitle,
  getStatementTypeLabel,
  summarizePartyStatement,
  type PartyBalanceTone,
} from '@/src/features/parties/lib/party';
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

/** Where a party stands once every bill and payment is counted. */
export interface ReceiptStanding {
  tone: PartyBalanceTone;
  /** 'To Receive' / 'To Pay' / 'Settled' — the party screen's own words. */
  label: string;
  /** What is still owed, one way or the other. Always positive. */
  amount: number;
  paidIn: number;
  paidOut: number;
  personal?: boolean;
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
  /** Defaults to 'Total Amount'. A statement calls it something else. */
  totalLabel?: string;
  amountReceived?: number;
  /** What the server says is still owed. Beats any arithmetic done here. */
  dueAmount?: number;
  /**
   * Set on a party / contact statement instead of the paid-unpaid amounts.
   * A statement closes on a direction, not on a 'Paid' stamp.
   */
  standing?: ReceiptStanding;
  paymentMethod?: string;
  accountName?: string;
  notes?: string;
  partyName?: string;
  partyPhone?: string;
}

export function buildReceiptHtml(
  input: ReceiptInput,
  identity?: InvoiceIdentity | BusinessProfile | null,
) {
  // Callers may hand over a ready identity, a business profile, or nothing at
  // all; either way the bill gets a proper letterhead.
  const biz = isInvoiceIdentity(identity)
    ? identity
    : resolveInvoiceIdentity((identity as BusinessProfile | null | undefined) ?? null);
  const businessName = biz.name;
  const businessPhone = biz.phone ? `Phone: ${biz.phone}` : '';
  const businessAddress = biz.address;
  const panLine = biz.panVat ? `PAN / VAT No: ${biz.panVat}` : '';
  const emailLine = biz.email ? `Email: ${biz.email}` : '';
  const logoTag = biz.logoUrl
    ? `<img class="store-logo" src="${biz.logoUrl}" alt="" />`
    : '';

  // A statement lists whole entries, so the "1 × Rs x" line under each one is noise.
  const isStatement = Boolean(input.standing);

  const lineRows = (input.lines || [])
    .map(
      (line) => `
      <tr>
        <td style="padding: 9px 0; border-bottom: 1px solid #e2e8f0;">
          <div style="font-weight:700; color:#0f172a; font-size:13px;">${line.name}</div>
          ${isStatement ? '' : `<div style="color:#64748b; font-size:12px; margin-top:2px;">${line.quantity} × ${formatCurrency(line.unitPrice)}</div>`}
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

  // Paid / part-paid / unpaid comes from one shared rule, so a bill can never
  // print as settled while money is still owed on it.
  const settled = Number(input.amountReceived ?? 0);
  const due = billDue({
    grandTotal: input.grandTotal,
    amountReceived: input.amountReceived,
    dueAmount: input.dueAmount,
  });
  const state = billState({
    grandTotal: input.grandTotal,
    amountReceived: input.amountReceived,
    dueAmount: input.dueAmount,
  });
  // A statement closes on a balance, a bill on a paid / unpaid stamp. Never both.
  const standing = input.standing;
  const showPaymentBand =
    !standing && (input.amountReceived !== undefined || input.dueAmount !== undefined);

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
          .store-logo {
            display: block;
            margin: 0 auto 6px auto;
            max-height: 64px;
            max-width: 160px;
            object-fit: contain;
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
          .status-partial {
            background: #fef3c7;
            color: #92400e;
            border: 1px solid #fcd34d;
          }
          .status-pay {
            background: #e6effd;
            color: #1d4ed8;
            border: 1px solid #bfd6fb;
          }
          .status-cancelled {
            background: #f1f5f9;
            color: #475569;
            border: 1px solid #cbd5e1;
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
          ${logoTag}
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
                  <th style="text-align:left;">${isStatement ? 'Entry' : 'Item / Description'}</th>
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
          ${
            isStatement
              ? ''
              : `<div class="total-row">
                  <span>Subtotal:</span>
                  <span>${formatCurrency(input.subTotal)}</span>
                </div>`
          }
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
            <span>${input.totalLabel || 'Total Amount'}:</span>
            <span>${formatCurrency(input.grandTotal)}</span>
          </div>

          ${
            standing
              ? `
              ${
                standing.paidIn > 0
                  ? `<div class="total-row" style="margin-top:6px;">
                      <span>${standing.personal ? 'Money in:' : 'Received from them:'}</span>
                      <span>${formatCurrency(standing.paidIn)}</span>
                    </div>`
                  : ''
              }
              ${
                standing.paidOut > 0
                  ? `<div class="total-row">
                      <span>${standing.personal ? 'Money out:' : 'Paid to them:'}</span>
                      <span>${formatCurrency(standing.paidOut)}</span>
                    </div>`
                  : ''
              }
              <div class="status-badge status-${standing.tone === 'settled' ? 'paid' : standing.tone === 'pay' ? 'pay' : 'due'}">
                <span>${standing.label}</span>
                <span>${standing.tone === 'settled' ? 'Nothing outstanding' : formatCurrency(standing.amount)}</span>
              </div>
              `
              : ''
          }

          ${
            showPaymentBand
              ? `
              <div class="total-row" style="margin-top:6px;">
                <span>Paid / Settled:</span>
                <span>${formatCurrency(settled)}</span>
              </div>
              <div class="status-badge status-${state === 'paid' ? 'paid' : state === 'partial' ? 'partial' : state === 'cancelled' ? 'cancelled' : 'due'}">
                <span>${billStateLabel(state)}</span>
                <span>${due > 0 ? `Balance due ${formatCurrency(due)}` : state === 'cancelled' ? '—' : 'Nothing outstanding'}</span>
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
  const heading = purchase.entryType === 'income'
    ? 'INCOME VOUCHER'
    : isExpense ? 'EXPENSE VOUCHER' : 'PURCHASE BILL';
  const grandTotal = Number(purchase.grandTotal || 0);
  const amountReceived = billPaid(purchase);

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
            name: purchase.notes ? String(purchase.notes) : purchase.entryType === 'income' ? 'Income' : isExpense ? 'Expense' : 'Purchase',
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
    dueAmount: billDue(purchase),
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
  const amountReceived = billPaid(sale);

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
    dueAmount: billDue(sale),
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
  const receivedTotal = billPaid(service);

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
    service.serviceType || candidateAttrs.serviceType
      ? `Service Type: ${String(service.serviceType || candidateAttrs.serviceType) === 'online' ? 'Online' : 'Physical'}`
      : '',
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
    dueAmount: billDue(service),
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
  const balanceSource =
    summaryOrCurrentAmount === undefined || summaryOrCurrentAmount === null
      ? party.currentAmount ?? 0
      : summaryOrCurrentAmount;
  const standing = summarizePartyStatement(party, rows, balanceSource);

  const lines: ReceiptLine[] =
    rows.length > 0
      ? rows.map((r) => {
          const amount = getStatementAmount(r);
          return {
            name: `${prettyDate(r.date)} · ${getStatementTypeLabel(r.type, personal)} — ${getStatementRowTitle(r)}`,
            quantity: 1,
            unitPrice: amount,
            lineTotal: amount,
          };
        })
      : [
          {
            name: 'No transaction history',
            quantity: 1,
            unitPrice: 0,
            lineTotal: 0,
          },
        ];

  const heading = personal ? 'CONTACT STATEMENT' : 'PARTY STATEMENT';

  const input: ReceiptInput = {
    heading,
    reference: `STMT-${party.id ? String(party.id).slice(-6).toUpperCase() : Date.now().toString().slice(-6)}`,
    date: new Date().toISOString(),
    dateLabel: 'Statement Date',
    partyName: party.name,
    partyPhone: party.phone ? String(party.phone) : undefined,
    notes: `${rows.length} ${rows.length === 1 ? 'entry' : 'entries'} listed above. The balance below is what is still open after every bill and payment.`,
    lines,
    subTotal: standing.billedTotal,
    taxTotal: 0,
    discountTotal: 0,
    grandTotal: standing.billedTotal,
    totalLabel: personal ? 'Total recorded' : 'Total billed',
    standing: {
      tone: standing.tone,
      label: standing.label,
      amount: standing.amount,
      paidIn: standing.paidIn,
      paidOut: standing.paidOut,
      personal,
    },
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
