import { SalesReportTemplateData } from './types';
import {
  wrapTemplate,
  getHeader,
  getFooter,
  formatDate,
  escapeHtml,
} from './baseStyles';

export function getSalesReportTemplate(data: SalesReportTemplateData): string {
  const {
    company,
    periodLabel,
    printedAt,
    netSales,
    taxCollected,
    grossSales,
    numCustomers,
    averageSale,
    numPayments,
    valuePayments,
    numRefunds,
    valueRefunds,
    numDiscounts,
    valueDiscounts,
    paymentTypes,
    paymentTypesTotalCount,
    paymentTypesTotal,
    detailGroups,
    detailTotalCount,
    detailFilterNote,
  } = data;

  const typeRows = paymentTypes
    .map(
      (r) => `
    <tr>
      <td>${escapeHtml(r.method)}</td>
      <td class="right">${escapeHtml(r.count)}</td>
      <td class="right">${escapeHtml(r.total)}</td>
    </tr>
  `,
    )
    .join('');

  const detailGroupsHtml = detailGroups
    .map((g) => {
      const rows = g.rows
        .map((r) => {
          const detailParts: string[] = [];
          if (r.reference) detailParts.push(escapeHtml(r.reference));
          if (r.notes) detailParts.push(`<span class="note">${escapeHtml(r.notes)}</span>`);
          const detailCell = detailParts.length ? detailParts.join('<br>') : '';
          return `
      <tr>
        <td>${escapeHtml(r.invoiceNumber)}</td>
        <td>${escapeHtml(r.clientName)}</td>
        <td class="detail">${detailCell}</td>
        <td>${formatDate(r.date)}</td>
        <td class="right"${r.isNegative ? ' style="color:#c92a2a;"' : ''}>${escapeHtml(r.amount)}</td>
      </tr>
    `;
        })
        .join('');
      return `
    <table class="listing-group">
      <thead>
        <tr class="group-head">
          <th colspan="4">${escapeHtml(g.type)} <span class="group-count">(${escapeHtml(g.count)})</span></th>
          <th class="right group-subtotal"${g.subtotalNegative ? ' style="color:#c92a2a;"' : ''}>${escapeHtml(g.subtotal)}</th>
        </tr>
        <tr class="group-cols">
          <th>Invoice</th>
          <th>Customer</th>
          <th>Description / Notes</th>
          <th>Date</th>
          <th class="right">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
      <tfoot>
        <tr class="group-total">
          <td colspan="4" class="right">Subtotal</td>
          <td class="right"${g.subtotalNegative ? ' style="color:#c92a2a;"' : ''}>${escapeHtml(g.subtotal)}</td>
        </tr>
      </tfoot>
    </table>
  `;
    })
    .join('');

  const styles = `
    .sales-summary { width: auto; margin: 4px 0 16px; min-width: 320px; }
    .sales-summary td { padding: 3px 8px; font-size: 11pt; }
    .sales-summary .label { color: #333; font-weight: 600; }
    .sales-summary .value { text-align: right; font-weight: 700; font-variant-numeric: tabular-nums; }
    .sales-summary .gross td { border-top: 2px solid #333; }

    .stats { width: 100%; border: 1px solid #e0e0e0; border-radius: 6px; margin-bottom: 18px; }
    .stats td { padding: 6px 12px; font-size: 9.5pt; border-bottom: 1px solid #f0f0f0; }
    .stats tr:last-child td { border-bottom: none; }
    .stats .k { color: #555; }
    .stats .n { text-align: right; font-weight: 700; font-variant-numeric: tabular-nums; width: 70px; }
    .stats .v { text-align: right; font-weight: 700; font-variant-numeric: tabular-nums; }
    .stats .refund .n, .stats .refund .v { color: #c92a2a; }

    .section-title {
      font-size: 11pt; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.5px; color: #333; margin: 18px 0 6px;
      border-bottom: 1px solid #ccc; padding-bottom: 4px;
    }

    .filter-note {
      font-size: 9pt; font-style: italic; color: #555; margin: -2px 0 8px;
    }

    .listing-group { margin: 0 0 12px; page-break-inside: avoid; }
    .listing-group .group-head th {
      background: #f0f4ff; border-top: 2px solid #b7c7ef; border-bottom: 1px solid #d4ddf5;
      font-size: 10.5pt; font-weight: 700; color: #1f3d7a; text-align: left; padding: 5px 8px;
    }
    .listing-group .group-head .group-count { font-weight: 600; color: #5670aa; font-size: 9pt; }
    .listing-group .group-head .group-subtotal { text-align: right; font-variant-numeric: tabular-nums; }
    .listing-group .group-cols th {
      font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.3px;
      color: #666; border-bottom: 1px solid #ccc; padding: 3px 8px;
    }
    .listing-group tbody td { font-size: 9.5pt; padding: 3px 8px; }
    .listing-group tbody td.detail { font-size: 9pt; }
    .listing-group tbody td.detail .note { color: #666; font-size: 8.5pt; }
    .listing-group .group-total td {
      border-top: 1px solid #ccc; font-weight: 700; font-size: 9.5pt;
      padding: 4px 8px; font-variant-numeric: tabular-nums;
    }
  `;

  const body = `
    ${getHeader(company)}

    <div class="doc-title">Sales Report</div>

    <div class="info-grid">
      <div class="info-block">
        <div class="info-label">Report Sales Dates</div>
        <div class="info-value" style="font-weight:600;">${escapeHtml(periodLabel)}</div>
      </div>
      <div class="info-block right">
        <div class="info-label">Printed</div>
        <div class="info-value">${escapeHtml(printedAt)}</div>
      </div>
    </div>

    <table class="sales-summary">
      <tr><td class="label">Net Sales</td><td class="value">${escapeHtml(netSales)}</td></tr>
      <tr><td class="label">Tax Collected</td><td class="value">${escapeHtml(taxCollected)}</td></tr>
      <tr class="gross"><td class="label">Gross Sales</td><td class="value">${escapeHtml(grossSales)}</td></tr>
    </table>

    <table class="stats">
      <tr>
        <td class="k">No. of Customers</td><td class="n">${escapeHtml(numCustomers)}</td>
        <td class="k">Average Sale</td><td class="v">${escapeHtml(averageSale)}</td>
      </tr>
      <tr>
        <td class="k">No. of Payments</td><td class="n">${escapeHtml(numPayments)}</td>
        <td class="k">Value of Payments</td><td class="v">${escapeHtml(valuePayments)}</td>
      </tr>
      <tr class="refund">
        <td class="k">No. of Refunds</td><td class="n">${escapeHtml(numRefunds)}</td>
        <td class="k">Value of Refunds</td><td class="v">${escapeHtml(valueRefunds)}</td>
      </tr>
      <tr>
        <td class="k">No. of Discounts</td><td class="n">${escapeHtml(numDiscounts)}</td>
        <td class="k">Value of Discounts</td><td class="v">${escapeHtml(valueDiscounts)}</td>
      </tr>
    </table>

    <div class="section-title">Payment Report</div>
    <table>
      <thead>
        <tr>
          <th>Payment Type</th>
          <th class="right">No. of Payments</th>
          <th class="right">Total</th>
        </tr>
      </thead>
      <tbody>
        ${typeRows || '<tr><td colspan="3" style="text-align:center; color:#999; padding:16px;">No payments in this period</td></tr>'}
      </tbody>
      <tfoot>
        <tr class="total">
          <td class="right">Total</td>
          <td class="right">${escapeHtml(paymentTypesTotalCount)}</td>
          <td class="right">${escapeHtml(paymentTypesTotal)}</td>
        </tr>
      </tfoot>
    </table>

    <div class="section-title">Sales Listing &mdash; by Payment Type (${escapeHtml(detailTotalCount)})</div>
    ${detailFilterNote ? `<div class="filter-note">Filtered to: ${escapeHtml(detailFilterNote)}</div>` : ''}
    ${
      detailGroupsHtml ||
      '<table><tbody><tr><td style="text-align:center; color:#999; padding:16px;">No payments in this period</td></tr></tbody></table>'
    }

    ${getFooter(company)}
  `;

  return wrapTemplate(styles, body);
}
