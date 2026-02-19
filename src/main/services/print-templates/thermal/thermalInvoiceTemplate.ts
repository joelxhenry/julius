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

  const balance = parseFloat(invoice.total) - parseFloat(invoice.totalPaid);
  const statusText = invoice.status === 'paid' ? 'PAID'
    : balance > 0 ? `BAL: ${formatCurrency(balance.toString(), sym)}`
    : invoice.status.toUpperCase();

  const body = `
    ${getThermalHeader(company)}

    <div class="thermal-title">Invoice</div>

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
