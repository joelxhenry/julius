import { QuotationTemplateData } from './types';
import {
  wrapTemplate,
  getHeader,
  getFooter,
  getLineItemsTable,
  getTotalsBlock,
  getClientBlock,
  formatDate,
  escapeHtml,
} from './baseStyles';

export function getQuotationTemplate(data: QuotationTemplateData): string {
  const { company, quotation, lineItems, salespersonName } = data;
  const sym = company.currencySymbol;

  const body = `
    ${getHeader(company)}

    <div class="doc-title">Quotation</div>

    <div class="info-grid">
      ${getClientBlock(quotation.clientName, quotation.clientAddress1, quotation.clientAddress2, quotation.clientPhone)}

      <div class="info-block right">
        <div class="info-label">Quote Number</div>
        <div class="info-value">${escapeHtml(quotation.quoteNum)}</div>

        <div class="info-label">Date</div>
        <div class="info-value">${formatDate(quotation.quoteDate)}</div>

        ${quotation.reference ? `
          <div class="info-label">Reference</div>
          <div class="info-value">${escapeHtml(quotation.reference)}</div>
        ` : ''}

        <div class="info-label">Pricing</div>
        <div class="info-value">${quotation.pricing === 'R' ? 'Retail' : 'Wholesale'}</div>

        ${salespersonName ? `
          <div class="info-label">Salesperson</div>
          <div class="info-value">${escapeHtml(salespersonName)}</div>
        ` : ''}
      </div>
    </div>

    ${getLineItemsTable(lineItems, sym)}

    ${getTotalsBlock(quotation.subTotal, quotation.tax, quotation.total, sym)}

    ${quotation.notes ? `
      <div class="notes">
        <div class="notes-label">Notes</div>
        <div>${escapeHtml(quotation.notes)}</div>
      </div>
    ` : ''}

    ${getFooter(company)}
  `;

  return wrapTemplate('', body);
}
