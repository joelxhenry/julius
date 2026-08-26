import { InvoiceTemplateData } from '../types';
import { ThermalPaperWidth } from '../../../../shared/types/print';
import {
  wrapThermalTemplate,
  getThermalHeader,
  getThermalFooter,
  getThermalInfoRow,
  getThermalLineItems,
  getThermalTotals,
  formatCurrency,
  formatDate,
} from './thermalBaseStyles';

export function getThermalInvoiceTemplate(data: InvoiceTemplateData, paperWidth: ThermalPaperWidth): string {
  const { company, invoice, lineItems, salespersonName } = data;
  const sym = company.currencySymbol;

  const isCancelled = invoice.status === 'cancelled';
  const balance = parseFloat(invoice.total) - parseFloat(invoice.totalPaid);
  const statusText = isCancelled ? 'CANCELLED'
    : invoice.status === 'paid' ? 'PAID'
    : balance > 0 ? `BAL: ${formatCurrency(balance.toString(), sym)}`
    : invoice.status.toUpperCase();

  const body = `
    ${getThermalHeader(company)}

    <div class="thermal-title">Invoice</div>
    ${isCancelled ? '<div style="text-align: center; font-weight: 800; font-size: 13pt; background: #000; color: #fff; padding: 5px 2px; margin: 5px 0; letter-spacing: 5px; -webkit-print-color-adjust: exact; print-color-adjust: exact;">CANCELLED</div>' : ''}

    <hr class="sep">

    ${getThermalInfoRow('Invoice #', invoice.invNumber)}
    ${getThermalInfoRow('Date', formatDate(invoice.invDate))}
    ${invoice.clientName ? getThermalInfoRow('Client', invoice.clientName) : ''}
    ${invoice.reference ? getThermalInfoRow('Ref', invoice.reference) : ''}
    ${invoice.creditTerms ? getThermalInfoRow('Terms', invoice.creditTerms) : ''}
    ${salespersonName ? getThermalInfoRow('Sales', salespersonName) : ''}

    <hr class="sep">

    ${getThermalLineItems(lineItems, sym)}

    <hr class="sep">

    ${getThermalTotals(invoice.subTotal, invoice.tax, invoice.total, sym,
      parseFloat(invoice.totalPaid) > 0
        ? [
            { label: 'Paid', value: formatCurrency(invoice.totalPaid, sym) },
            { label: 'Balance', value: formatCurrency(balance.toString(), sym) },
          ]
        : undefined
    )}

    ${getThermalInfoRow('Status', statusText)}

    ${getThermalFooter()}
  `;

  return wrapThermalTemplate(paperWidth, body);
}
