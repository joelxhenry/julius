import { ClientStatementTemplateData } from './types';
import {
  wrapTemplate,
  getHeader,
  getFooter,
  formatDate,
  escapeHtml,
} from './baseStyles';

export function getClientStatementTemplate(data: ClientStatementTemplateData): string {
  const { company, client, periodLabel, printedAt, openingBalance, entries, totals } = data;

  const clientLines = [
    client.clientName ? `<div class="info-value" style="font-weight:600;">${escapeHtml(client.clientName)}</div>` : '',
    client.clNumber ? `<div style="font-size:9pt; color:#555;">${escapeHtml(client.clNumber)}</div>` : '',
    client.address1 ? `<div style="font-size:9pt;">${escapeHtml(client.address1)}</div>` : '',
    client.address2 ? `<div style="font-size:9pt;">${escapeHtml(client.address2)}</div>` : '',
    client.phone ? `<div style="font-size:9pt; color:#555;">Tel: ${escapeHtml(client.phone)}</div>` : '',
  ].filter(Boolean).join('');

  const typeClass = (type: string): string => {
    const t = type.toLowerCase();
    if (t.includes('invoice')) return 'badge-blue';
    if (t.includes('credit')) return 'badge-green';
    if (t.includes('payment')) return 'badge-gray';
    return 'badge-gray';
  };

  const openingRow = openingBalance !== null
    ? `
      <tr class="opening">
        <td></td>
        <td colspan="5" style="font-weight:600; color:#555;">Opening Balance</td>
        <td class="right" style="font-weight:600;">${escapeHtml(openingBalance)}</td>
      </tr>
    `
    : '';

  const entryRows = entries.map((e) => `
    <tr>
      <td>${formatDate(e.date)}</td>
      <td><span class="badge ${typeClass(e.type)}">${escapeHtml(e.type)}</span></td>
      <td>${escapeHtml(e.reference)}</td>
      <td>${escapeHtml(e.description)}</td>
      <td class="right">${escapeHtml(e.debit)}</td>
      <td class="right">${escapeHtml(e.credit)}</td>
      <td class="right">${escapeHtml(e.balance)}</td>
    </tr>
  `).join('');

  const styles = `
    .summary-grid { display: flex; flex-wrap: wrap; gap: 12px; margin: 8px 0 12px; }
    .summary-card {
      flex: 1; min-width: 130px; border: 1px solid #e5e5e5; border-radius: 4px;
      padding: 8px 12px; background: #fafafa;
    }
    .summary-card .label { font-size: 8pt; color: #777; text-transform: uppercase; letter-spacing: 0.3px; }
    .summary-card .value { font-size: 13pt; font-weight: 700; color: #111; margin-top: 2px; }
    .summary-card.highlight { background: #fff3cd; border-color: #ffe69c; }
    .summary-card.credit { background: #d4edda; border-color: #b7dfc1; }
    tbody tr.opening td { background: #f5f5f5; border-bottom: 1px solid #ddd; }
    tfoot tr.closing td { border-top: 2px solid #333; font-size: 11pt; font-weight: 700; }
    tfoot tr.subtotal td { font-weight: 600; color: #555; }
  `;

  const body = `
    ${getHeader(company)}

    <div class="doc-title">Statement of Account</div>

    <div class="info-grid">
      <div class="info-block">
        <div class="info-label">Statement For</div>
        ${clientLines || '<div class="info-value" style="color:#999;">—</div>'}
      </div>

      <div class="info-block right">
        <div class="info-label">Period</div>
        <div class="info-value">${escapeHtml(periodLabel)}</div>

        <div class="info-label">Printed</div>
        <div class="info-value">${escapeHtml(printedAt)}</div>
      </div>
    </div>

    <div class="summary-grid">
      <div class="summary-card">
        <div class="label">Total Debits</div>
        <div class="value">${escapeHtml(totals.totalDebits)}</div>
      </div>
      <div class="summary-card">
        <div class="label">Total Credits</div>
        <div class="value">${escapeHtml(totals.totalCredits)}</div>
      </div>
      <div class="summary-card highlight">
        <div class="label">Closing Balance</div>
        <div class="value">${escapeHtml(totals.closingBalance)}</div>
      </div>
      <div class="summary-card credit">
        <div class="label">Available Credit</div>
        <div class="value">${escapeHtml(totals.availableCredit)}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width: 80px;">Date</th>
          <th style="width: 90px;">Type</th>
          <th>Reference</th>
          <th>Description</th>
          <th class="right">Debit</th>
          <th class="right">Credit</th>
          <th class="right">Balance</th>
        </tr>
      </thead>
      <tbody>
        ${openingRow}
        ${entryRows || '<tr><td colspan="7" style="text-align:center; color:#999; padding:16px;">No transactions in this period</td></tr>'}
      </tbody>
      <tfoot>
        <tr class="subtotal">
          <td colspan="4" class="right">Period Totals</td>
          <td class="right">${escapeHtml(totals.totalDebits)}</td>
          <td class="right">${escapeHtml(totals.totalCredits)}</td>
          <td></td>
        </tr>
        <tr class="closing">
          <td colspan="6" class="right">Closing Balance</td>
          <td class="right">${escapeHtml(totals.closingBalance)}</td>
        </tr>
      </tfoot>
    </table>

    <div style="font-size: 8pt; color: #888; margin-top: 8px;">
      A positive balance is owed by the client. Amounts in parentheses indicate a credit balance in the client's favour.
    </div>

    ${getFooter(company)}
  `;

  return wrapTemplate(styles, body);
}
