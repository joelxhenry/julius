import { PurchaseReportTemplateData } from './types';
import { wrapTemplate, getHeader, getFooter, escapeHtml } from './baseStyles';

export function getPurchaseReportTemplate(data: PurchaseReportTemplateData): string {
  const { company, year, printedAt, months, totals } = data;

  const monthRows = months
    .map(
      (m) => `
    <tr>
      <td class="month">${escapeHtml(m.month)}</td>
      <td class="right">${escapeHtml(m.total)}</td>
      <td class="right">${escapeHtml(m.paidOut)}</td>
      <td class="right">${escapeHtml(m.payable)}</td>
    </tr>
  `,
    )
    .join('');

  const styles = `
    .purchase-table td.month {
      font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px;
      font-size: 8.5pt; color: #444;
    }
    .purchase-table tbody td { font-variant-numeric: tabular-nums; }
    .purchase-table tfoot tr.total td.month { text-transform: uppercase; }
  `;

  const body = `
    ${getHeader(company)}

    <div class="doc-title">Purchase Report</div>

    <div class="info-grid">
      <div class="info-block">
        <div class="info-label">Year</div>
        <div class="info-value" style="font-weight:600;">${escapeHtml(year)}</div>
      </div>
      <div class="info-block right">
        <div class="info-label">Printed</div>
        <div class="info-value">${escapeHtml(printedAt)}</div>
      </div>
    </div>

    <table class="purchase-table">
      <thead>
        <tr>
          <th>Month</th>
          <th class="right">Total</th>
          <th class="right">Paid Out</th>
          <th class="right">Payable</th>
        </tr>
      </thead>
      <tbody>
        ${monthRows}
      </tbody>
      <tfoot>
        <tr class="total">
          <td class="month">Totals</td>
          <td class="right">${escapeHtml(totals.total)}</td>
          <td class="right">${escapeHtml(totals.paidOut)}</td>
          <td class="right">${escapeHtml(totals.payable)}</td>
        </tr>
      </tfoot>
    </table>

    ${getFooter(company)}
  `;

  return wrapTemplate(styles, body);
}
