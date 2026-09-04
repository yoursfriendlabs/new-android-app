import { formatCurrency, prettyDate } from '@/src/shared/lib/format';

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
}

export function buildReceiptHtml(input: ReceiptInput) {
  const lineRows = input.lines
    .map(
      (line) => `
      <tr>
        <td style="padding: 8px 0; border-bottom: 1px solid #ece2d8;">
          <strong>${line.name}</strong><br />
          <span style="color:#6d6257;">${line.quantity} x ${formatCurrency(line.unitPrice)}</span>
        </td>
        <td style="text-align:right; padding: 8px 0; border-bottom: 1px solid #ece2d8;">
          ${formatCurrency(line.lineTotal)}
        </td>
      </tr>`,
    )
    .join('');

  const dateLine = input.dateLabel 
    ? `${input.dateLabel}: ${prettyDate(input.date)}` 
    : prettyDate(input.date);

  const due = input.amountReceived !== undefined 
    ? Math.max(input.grandTotal - input.amountReceived, 0) 
    : 0;

  return `
    <html>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 24px; color: #201914; max-width: 480px; margin: 0 auto;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h1 style="margin:0 0 6px 0; color:#9b6835; font-size: 22px;">${input.heading}</h1>
          <p style="margin:0 0 4px 0; font-size:15px;"><strong>${input.reference}</strong></p>
          <p style="margin:0; font-size:13px; color:#6d6257;">${dateLine}${input.subtitle ? ` • ${input.subtitle}` : ''}</p>
        </div>
        <table style="width:100%; border-collapse: collapse; margin-bottom: 16px;">
          <thead>
            <tr style="border-bottom: 2px solid #9b6835; color: #6d6257; font-size: 13px;">
              <th style="text-align:left; padding-bottom: 6px;">Item</th>
              <th style="text-align:right; padding-bottom: 6px;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${lineRows}
          </tbody>
        </table>
        <div style="border-top: 1px dashed #c4b5a5; padding-top: 12px; font-size: 14px;">
          <div style="display:flex; justify-content:space-between; margin-bottom: 4px;">
            <span>Subtotal:</span>
            <span>${formatCurrency(input.subTotal)}</span>
          </div>
          ${input.taxTotal > 0 ? `
          <div style="display:flex; justify-content:space-between; margin-bottom: 4px;">
            <span>VAT / Tax:</span>
            <span>${formatCurrency(input.taxTotal)}</span>
          </div>` : ''}
          ${input.discountTotal > 0 ? `
          <div style="display:flex; justify-content:space-between; margin-bottom: 4px; color: #b3261e;">
            <span>Discount:</span>
            <span>-${formatCurrency(input.discountTotal)}</span>
          </div>` : ''}
          <div style="display:flex; justify-content:space-between; margin: 8px 0; font-size: 16px; font-weight: bold; border-top: 1px solid #ece2d8; padding-top: 8px;">
            <span>Grand Total:</span>
            <span>${formatCurrency(input.grandTotal)}</span>
          </div>
          ${
            input.amountReceived !== undefined
              ? `
              <div style="display:flex; justify-content:space-between; margin-bottom: 4px;">
                <span>Paid / Received:</span>
                <span>${formatCurrency(input.amountReceived)}</span>
              </div>
              <div style="display:flex; justify-content:space-between; margin-top: 6px; font-size: 15px; font-weight: bold; color: ${due > 0 ? '#b3261e' : '#1b6d2e'}; background: ${due > 0 ? '#fde8e8' : '#e8f5e9'}; padding: 6px 8px; borderRadius: 4px;">
                <span>${due > 0 ? 'Balance Due:' : 'Status:'}</span>
                <span>${due > 0 ? formatCurrency(due) : 'Fully Paid'}</span>
              </div>`
              : ''
          }
        </div>
        <div style="margin-top: 24px; text-align: center; color: #8c7e72; font-size: 12px;">
          <p>Thank you for your business!</p>
        </div>
      </body>
    </html>
  `;
}
