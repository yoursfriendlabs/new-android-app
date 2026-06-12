import { formatCurrency, prettyDate } from '@/src/lib/format';

interface ReceiptLine {
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

interface ReceiptInput {
  heading: string;
  reference: string;
  date: string;
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

  return `
    <html>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 24px; color: #201914;">
        <h1 style="margin:0 0 8px 0; color:#9b6835;">${input.heading}</h1>
        <p style="margin:0 0 2px 0; font-size:14px;"><strong>${input.reference}</strong></p>
        <p style="margin:0 0 24px 0; font-size:14px; color:#6d6257;">${prettyDate(input.date)}${input.subtitle ? ` • ${input.subtitle}` : ''}</p>
        <table style="width:100%; border-collapse: collapse;">
          ${lineRows}
        </table>
        <div style="margin-top: 24px; font-size: 14px;">
          <p><strong>Subtotal:</strong> ${formatCurrency(input.subTotal)}</p>
          <p><strong>Tax:</strong> ${formatCurrency(input.taxTotal)}</p>
          <p><strong>Discount:</strong> ${formatCurrency(input.discountTotal)}</p>
          <p style="font-size:18px;"><strong>Total:</strong> ${formatCurrency(input.grandTotal)}</p>
          ${
            input.amountReceived
              ? `<p><strong>Received:</strong> ${formatCurrency(input.amountReceived)}</p>
                 <p><strong>Due:</strong> ${formatCurrency(Math.max(input.grandTotal - input.amountReceived, 0))}</p>`
              : ''
          }
        </div>
      </body>
    </html>
  `;
}
