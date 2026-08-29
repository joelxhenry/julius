import { InvoiceTemplateData } from './types';
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

export function getInvoiceTemplate(data: InvoiceTemplateData): string {
  const { company, invoice, lineItems, salespersonName } = data;
  const sym = company.currencySymbol;

  const isCancelled = invoice.status === 'cancelled';
  const balance = parseFloat(invoice.total) - parseFloat(invoice.totalPaid);
  const statusBadge = isCancelled
    ? '<span class="badge badge-red">Cancelled</span>'
    : invoice.status === 'paid'
      ? '<span class="badge badge-green">Paid</span>'
      : balance > 0
        ? `<span class="badge badge-yellow">Balance: ${formatCurrency(balance.toString(), sym)}</span>`
        : '<span class="badge badge-gray">-</span>';

  const body = `
    ${isCancelled ? '<div class="cancelled-watermark">Cancelled</div>' : ''}
    ${getHeader(company)}

    <div class="doc-title">Invoice</div>
    ${isCancelled ? '<div class="cancelled-banner">Cancelled &mdash; No Line Items</div>' : ''}

    <div class="info-grid">
      ${getClientBlock(invoice.clientName, invoice.clientAddress1, invoice.clientAddress2, invoice.clientPhone)}

      <div class="info-block right">
        <div class="info-label">Invoice Number</div>
        <div class="info-value">${escapeHtml(invoice.invNumber)}</div>

        <div class="info-label">Date</div>
        <div class="info-value">${formatDate(invoice.invDate)}</div>

        ${invoice.reference ? `
          <div class="info-label">Reference</div>
          <div class="info-value">${escapeHtml(invoice.reference)}</div>
        ` : ''}

        ${invoice.creditTerms ? `
          <div class="info-label">Credit Terms</div>
          <div class="info-value">${escapeHtml(invoice.creditTerms)}</div>
        ` : ''}

        ${salespersonName ? `
          <div class="info-label">Salesperson</div>
          <div class="info-value">${escapeHtml(salespersonName)}</div>
        ` : ''}
      </div>
    </div>

    ${getLineItemsTable(lineItems, sym)}

    ${getTotalsBlock(invoice.subTotal, invoice.tax, invoice.total, sym)}

    <div style="margin-top: 12px; display: flex; justify-content: space-between; align-items: center;">
      <div>
        <span style="font-size: 9pt; color: #555;">Payment Status:</span>
        ${statusBadge}
      </div>
      ${parseFloat(invoice.totalPaid) > 0 ? `
        <div style="font-size: 9pt; color: #555;">
          Paid: ${formatCurrency(invoice.totalPaid, sym)} &bull;
          Balance: ${formatCurrency(balance.toString(), sym)}
        </div>
      ` : ''}
    </div>

    ${invoice.notes ? `
      <div class="notes">
        <div class="notes-label">Notes</div>
        <div>${escapeHtml(invoice.notes)}</div>
      </div>
    ` : ''}

    ${getFooter(company)}
  `;

  return wrapTemplate('', body);
}
