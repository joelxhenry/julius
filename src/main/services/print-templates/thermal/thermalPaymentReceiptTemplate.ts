import { PaymentReceiptTemplateData } from '../types';
import { ThermalPaperWidth } from '../../../../shared/types/print';
import {
  wrapThermalTemplate,
  getThermalHeader,
  getThermalFooter,
  getThermalInfoRow,
  formatCurrency,
  formatDate,
  escapeHtml,
} from './thermalBaseStyles';

export function getThermalPaymentReceiptTemplate(data: PaymentReceiptTemplateData, paperWidth: ThermalPaperWidth): string {
  const { company, payment, processedByName } = data;
  const sym = company.currencySymbol;
  const amount = parseFloat(payment.amount);

  const docLabel = payment.documentType === 'CREDIT' ? 'Credit Application'
    : payment.documentType === 'INVOICE' ? 'Invoice Payment'
    : 'Payment';

  const paymentMethod = payment.documentType === 'CREDIT' && payment.creditNoteNumber
    ? `Credit Note ${payment.creditNoteNumber}`
    : payment.paymentDesc2 || payment.paymentDesc || '-';

  const body = `
    ${getThermalHeader(company)}

    <div class="thermal-title">Payment Receipt</div>

    <hr class="sep">

    <div style="text-align: center; margin: 6px 0;">
      <div style="font-size: 14pt; font-weight: 700;">${formatCurrency(Math.abs(amount).toString(), sym)}</div>
      <div style="font-size: 7pt;">${escapeHtml(docLabel)}</div>
    </div>

    <hr class="sep">

    ${getThermalInfoRow('Receipt #', String(payment.id))}
    ${getThermalInfoRow('Date', formatDate(payment.paymentDate))}
    ${payment.payerName ? getThermalInfoRow('Payer', payment.payerName) : ''}
    ${getThermalInfoRow('Method', paymentMethod)}
    ${payment.invoiceNumber ? getThermalInfoRow('Invoice', payment.invoiceNumber) : ''}
    ${payment.creditNoteNumber ? getThermalInfoRow('Credit Note', payment.creditNoteNumber) : ''}
    ${getThermalInfoRow('Amount', formatCurrency(payment.amount, sym))}
    ${processedByName ? getThermalInfoRow('Processed By', processedByName) : ''}

    ${getThermalFooter()}
  `;

  return wrapThermalTemplate(paperWidth, body);
}
