import { PaymentReceiptTemplateData } from './types';
import {
  wrapTemplate,
  getHeader,
  getFooter,
  formatCurrency,
  formatDate,
  escapeHtml,
} from './baseStyles';

export function getPaymentReceiptTemplate(data: PaymentReceiptTemplateData): string {
  const { company, payment, processedByName } = data;
  const sym = company.currencySymbol;
  const amount = parseFloat(payment.amount);

  const docLabel = payment.documentType === 'CREDIT' ? 'Credit Application'
    : payment.documentType === 'INVOICE' ? 'Invoice Payment'
    : 'Payment';

  const body = `
    ${getHeader(company)}

    <div class="doc-title">Payment Receipt</div>

    <div style="text-align: center; margin: 24px 0;">
      <div style="font-size: 24pt; font-weight: 700; color: ${amount >= 0 ? '#155724' : '#721c24'};">
        ${formatCurrency(Math.abs(amount).toString(), sym)}
      </div>
      <div style="margin-top: 4px;">
        <span class="badge ${amount >= 0 ? 'badge-green' : 'badge-red'}">${docLabel}</span>
      </div>
    </div>

    <table style="max-width: 400px; margin: 0 auto 24px;">
      <tbody>
        <tr>
          <td style="padding: 6px 16px 6px 0; color: #555; font-weight: 500;">Receipt #</td>
          <td style="padding: 6px 0; font-weight: 600;">${payment.id}</td>
        </tr>
        <tr>
          <td style="padding: 6px 16px 6px 0; color: #555; font-weight: 500;">Date</td>
          <td style="padding: 6px 0;">${formatDate(payment.paymentDate)}</td>
        </tr>
        ${payment.payerName ? `
          <tr>
            <td style="padding: 6px 16px 6px 0; color: #555; font-weight: 500;">Payer</td>
            <td style="padding: 6px 0;">${escapeHtml(payment.payerName)}</td>
          </tr>
        ` : ''}
        <tr>
          <td style="padding: 6px 16px 6px 0; color: #555; font-weight: 500;">Payment Method</td>
          <td style="padding: 6px 0;">${escapeHtml(
            payment.documentType === 'CREDIT' && payment.creditNoteNumber
              ? `Credit Note ${payment.creditNoteNumber}`
              : payment.paymentDesc2 || payment.paymentDesc || '—'
          )}</td>
        </tr>
        ${payment.invoiceNumber ? `
          <tr>
            <td style="padding: 6px 16px 6px 0; color: #555; font-weight: 500;">Invoice</td>
            <td style="padding: 6px 0; font-weight: 600;">${escapeHtml(payment.invoiceNumber)}</td>
          </tr>
        ` : ''}
        ${payment.creditNoteNumber ? `
          <tr>
            <td style="padding: 6px 16px 6px 0; color: #555; font-weight: 500;">Credit Note</td>
            <td style="padding: 6px 0; font-weight: 600;">${escapeHtml(payment.creditNoteNumber)}</td>
          </tr>
        ` : ''}
        <tr>
          <td style="padding: 6px 16px 6px 0; color: #555; font-weight: 500;">Amount</td>
          <td style="padding: 6px 0; font-weight: 700; font-size: 12pt;">${formatCurrency(payment.amount, sym)}</td>
        </tr>
        ${processedByName ? `
          <tr>
            <td style="padding: 6px 16px 6px 0; color: #555; font-weight: 500;">Processed By</td>
            <td style="padding: 6px 0;">${escapeHtml(processedByName)}</td>
          </tr>
        ` : ''}
      </tbody>
    </table>

    ${getFooter(company)}
  `;

  return wrapTemplate(`
    @page { size: letter; margin: 1in; }
  `, body);
}
