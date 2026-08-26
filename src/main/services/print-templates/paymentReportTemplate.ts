import { PaymentReportTemplateData } from './types';
import {
  wrapTemplate,
  getHeader,
  getFooter,
  formatDate,
  escapeHtml,
} from './baseStyles';

export function getPaymentReportTemplate(data: PaymentReportTemplateData): string {
  const {
    company,
    clientName,
    periodLabel,
    methodLabel,
    printedAt,
    rows,
    count,
    totalReceipts,
    totalRefunds,
    netTotal,
  } = data;

  const bodyRows = rows
    .map(
      (r, i) => `
    <tr>
      <td style="width: 34px; color: #999;">${i + 1}</td>
      <td>${formatDate(r.date)}</td>
      <td>${escapeHtml(r.type)}</td>
      <td>${escapeHtml(r.document)}</td>
      <td class="right"${r.isNegative ? ' style="color:#c92a2a;"' : ''}>${escapeHtml(r.amount)}</td>
      <td>${escapeHtml(r.method)}</td>
      <td>${escapeHtml(r.reference)}</td>
      <td>${escapeHtml(r.notes)}</td>
    </tr>
  `,
    )
    .join('');

  const styles = `
    .summary-grid {
      display: flex;
      gap: 12px;
      margin: 12px 0 16px;
    }
    .summary-card {
      flex: 1;
      border: 1px solid #e0e0e0;
      border-radius: 6px;
      padding: 8px 12px;
    }
    .summary-card .label { font-size: 8pt; color: #888; text-transform: uppercase; letter-spacing: 0.03em; }
    .summary-card .value { font-size: 12pt; font-weight: 700; margin-top: 2px; }
    .summary-card .value.refund { color: #c92a2a; }
  `;

  const body = `
    ${getHeader(company)}

    <div class="doc-title">Payment Report</div>

    <div class="info-grid">
      <div class="info-block">
        <div class="info-label">Client</div>
        <div class="info-value" style="font-weight:600;">${escapeHtml(clientName)}</div>
      </div>
      <div class="info-block right">
        <div class="info-label">Period</div>
        <div class="info-value">${escapeHtml(periodLabel)}</div>

        <div class="info-label">Method</div>
        <div class="info-value">${escapeHtml(methodLabel)}</div>
      </div>
    </div>

    <div class="summary-grid">
      <div class="summary-card">
        <div class="label">Payments</div>
        <div class="value">${count}</div>
      </div>
      <div class="summary-card">
        <div class="label">Receipts</div>
        <div class="value">${escapeHtml(totalReceipts)}</div>
      </div>
      <div class="summary-card">
        <div class="label">Refunds</div>
        <div class="value refund">${escapeHtml(totalRefunds)}</div>
      </div>
      <div class="summary-card">
        <div class="label">Net Total</div>
        <div class="value">${escapeHtml(netTotal)}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width: 34px;">#</th>
          <th>Date</th>
          <th>Type</th>
          <th>Document</th>
          <th class="right">Amount</th>
          <th>Method</th>
          <th>Reference</th>
          <th>Notes</th>
        </tr>
      </thead>
      <tbody>
        ${bodyRows || '<tr><td colspan="8" style="text-align:center; color:#999; padding:16px;">No payments for the selected filters</td></tr>'}
      </tbody>
      <tfoot>
        <tr class="total">
          <td colspan="4" class="right">Net Total</td>
          <td class="right">${escapeHtml(netTotal)}</td>
          <td colspan="3"></td>
        </tr>
      </tfoot>
    </table>

    <div style="font-size: 8pt; color: #888; margin-top: 8px;">Printed ${escapeHtml(printedAt)}</div>

    ${getFooter(company)}
  `;

  return wrapTemplate(styles, body);
}
