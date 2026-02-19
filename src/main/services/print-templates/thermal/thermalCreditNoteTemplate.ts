import { CreditNoteTemplateData } from '../types';
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

export function getThermalCreditNoteTemplate(data: CreditNoteTemplateData, paperWidth: ThermalPaperWidth): string {
  const { company, creditNote, lineItems, salespersonName } = data;
  const sym = company.currencySymbol;

  const statusText = creditNote.status === 'used' ? 'FULLY USED'
    : creditNote.status === 'partially_used' ? 'PARTIAL'
    : creditNote.status.toUpperCase();

  const body = `
    ${getThermalHeader(company)}

    <div class="thermal-title">Credit Note</div>

    <hr class="sep">

    ${getThermalInfoRow('CN #', creditNote.crNumber)}
    ${getThermalInfoRow('Date', formatDate(creditNote.crDate))}
    ${creditNote.invNumber ? getThermalInfoRow('Invoice', creditNote.invNumber) : ''}
    ${creditNote.clientName ? getThermalInfoRow('Client', creditNote.clientName) : ''}
    ${creditNote.reference ? getThermalInfoRow('Ref', creditNote.reference) : ''}
    ${salespersonName ? getThermalInfoRow('Sales', salespersonName) : ''}

    <hr class="sep">

    ${getThermalLineItems(lineItems, sym)}

    <hr class="sep">

    ${getThermalTotals(creditNote.subTotal, creditNote.tax, creditNote.total, sym,
      parseFloat(creditNote.totalUsed) > 0
        ? [{ label: 'Used', value: formatCurrency(creditNote.totalUsed, sym) }]
        : undefined
    )}

    ${getThermalInfoRow('Status', statusText)}

    ${getThermalFooter()}
  `;

  return wrapThermalTemplate(paperWidth, body);
}
