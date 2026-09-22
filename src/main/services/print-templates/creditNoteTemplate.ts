import { CreditNoteTemplateData } from './types';
import {
  wrapTemplate,
  getHeader,
  getFooter,
  getClientBlock,
  formatCurrency,
  formatDate,
  escapeHtml,
} from './baseStyles';

export function getCreditNoteTemplate(data: CreditNoteTemplateData): string {
  const { company, creditNote, usage, salespersonName } = data;
  const sym = company.currencySymbol;

  const total = parseFloat(creditNote.total || '0');
  const used = parseFloat(creditNote.totalUsed || '0');
  const remaining = total - used;

  const statusBadge = creditNote.status === 'A'
    ? '<span class="badge badge-green">Active</span>'
    : '<span class="badge badge-gray">Used</span>';

  // Usage activity: how the note's funds were applied. Positive amounts are
  // draw-downs (applied to an invoice or refunded); negatives are void reversals
  // that restored balance, shown in accounting parentheses.
  const usageRows = usage.map((u) => {
    const amt = parseFloat(u.amount || '0');
    const amountCell = amt < 0
      ? `(${formatCurrency(Math.abs(amt).toString(), sym)})`
      : formatCurrency(u.amount, sym);
    return `
      <tr>
        <td>${formatDate(u.date)}</td>
        <td>${escapeHtml(u.invoiceNumber || '-')}</td>
        <td>${escapeHtml(u.description || '-')}</td>
        <td>${escapeHtml(u.reference || '-')}</td>
        <td class="right">${amountCell}</td>
      </tr>
    `;
  }).join('');

  const usageTable = `
    <table>
      <thead>
        <tr>
          <th style="width: 90px;">Date</th>
          <th style="width: 110px;">Applied To</th>
          <th>Description</th>
          <th>Reference</th>
          <th class="right" style="width: 110px;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${usageRows || '<tr><td colspan="5" style="text-align:center; color:#999; padding:16px;">This credit note has not been applied to any invoices yet.</td></tr>'}
      </tbody>
    </table>
  `;

  const summaryBlock = `
    <table class="summary-table">
      <tr><td class="label">Issued Amount</td><td class="value">${formatCurrency(creditNote.total, sym)}</td></tr>
      <tr><td class="label">Total Used</td><td class="value">${formatCurrency(creditNote.totalUsed, sym)}</td></tr>
      <tr class="total-row"><td class="label">Remaining Balance</td><td class="value">${formatCurrency(remaining.toString(), sym)}</td></tr>
    </table>
  `;

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

    <div class="info-label" style="margin: 8px 0 4px;">Usage Activity</div>
    ${usageTable}

    ${summaryBlock}

    <div style="margin-top: 12px;">
      <span style="font-size: 9pt; color: #555;">Status:</span>
      ${statusBadge}
    </div>

    ${getFooter(company)}
  `;

  return wrapTemplate('', body);
}
