import { CreditNoteTemplateData } from './types';
import {
  wrapTemplate,
  getHeader,
  getFooter,
  getLineItemsTable,
  getTotalsBlock,
  getClientBlock,
  formatCurrency,
  formatDate,
  escapeHtml,
} from './baseStyles';

export function getCreditNoteTemplate(data: CreditNoteTemplateData): string {
  const { company, creditNote, lineItems, salespersonName } = data;
  const sym = company.currencySymbol;

  const remaining = parseFloat(creditNote.total) - parseFloat(creditNote.totalUsed);
  const statusBadge = creditNote.status === 'A'
    ? '<span class="badge badge-green">Active</span>'
    : '<span class="badge badge-gray">Used</span>';

  const body = `
    ${getHeader(company)}

    <div class="doc-title">Credit Note</div>

    <div class="info-grid">
      ${getClientBlock(creditNote.clientName, creditNote.clientAddress1, creditNote.clientAddress2, creditNote.clientPhone)}

      <div class="info-block right">
        <div class="info-label">Credit Note Number</div>
        <div class="info-value">${escapeHtml(creditNote.crNumber)}</div>

        <div class="info-label">Date</div>
        <div class="info-value">${formatDate(creditNote.crDate)}</div>

        ${creditNote.invNumber ? `
          <div class="info-label">Source Invoice</div>
          <div class="info-value">${escapeHtml(creditNote.invNumber)}</div>
        ` : ''}

        ${creditNote.reference ? `
          <div class="info-label">Reference</div>
          <div class="info-value">${escapeHtml(creditNote.reference)}</div>
        ` : ''}

        ${salespersonName ? `
          <div class="info-label">Salesperson</div>
          <div class="info-value">${escapeHtml(salespersonName)}</div>
        ` : ''}
      </div>
    </div>

    ${getLineItemsTable(lineItems, sym)}

    ${getTotalsBlock(creditNote.subTotal, creditNote.tax, creditNote.total, sym)}

    <div style="margin-top: 12px; display: flex; justify-content: space-between; align-items: center;">
      <div>
        <span style="font-size: 9pt; color: #555;">Status:</span>
        ${statusBadge}
      </div>
      <div style="font-size: 9pt; color: #555;">
        Used: ${formatCurrency(creditNote.totalUsed, sym)} &bull;
        Remaining: ${formatCurrency(remaining.toString(), sym)}
      </div>
    </div>

    ${getFooter(company)}
  `;

  return wrapTemplate('', body);
}
