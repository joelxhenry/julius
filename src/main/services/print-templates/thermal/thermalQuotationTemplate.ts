import { QuotationTemplateData } from '../types';
import { ThermalPaperWidth } from '../../../../shared/types/print';
import {
  wrapThermalTemplate,
  getThermalHeader,
  getThermalFooter,
  getThermalInfoRow,
  getThermalLineItems,
  getThermalTotals,
  formatDate,
} from './thermalBaseStyles';

export function getThermalQuotationTemplate(data: QuotationTemplateData, paperWidth: ThermalPaperWidth): string {
  const { company, quotation, lineItems, salespersonName } = data;
  const sym = company.currencySymbol;

  const body = `
    ${getThermalHeader(company)}

    <div class="thermal-title">Quotation</div>

    <hr class="sep">

    ${getThermalInfoRow('Quote #', quotation.quoteNum)}
    ${getThermalInfoRow('Date', formatDate(quotation.quoteDate))}
    ${quotation.clientName ? getThermalInfoRow('Client', quotation.clientName) : ''}
    ${quotation.reference ? getThermalInfoRow('Ref', quotation.reference) : ''}
    ${salespersonName ? getThermalInfoRow('Sales', salespersonName) : ''}

    <hr class="sep">

    ${getThermalLineItems(lineItems, sym)}

    <hr class="sep">

    ${getThermalTotals(quotation.subTotal, quotation.tax, quotation.total, sym)}

    ${getThermalFooter()}
  `;

  return wrapThermalTemplate(paperWidth, body);
}
