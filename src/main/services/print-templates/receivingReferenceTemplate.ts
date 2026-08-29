import { ReceivingReferenceTemplateData } from './types';
import {
  wrapTemplate,
  getHeader,
  getFooter,
  formatDate,
  escapeHtml,
} from './baseStyles';

export function getReceivingReferenceTemplate(data: ReceivingReferenceTemplateData): string {
  const { company, reference, supplier, receivingDate, printedAt, items, totalQuantity, totalCost } = data;

  const rows = items.map((item, i) => `
    <tr>
      <td style="width: 40px; color: #999;">${i + 1}</td>
      <td>${escapeHtml(item.sku || '')}</td>
      <td>${escapeHtml(item.description || '')}</td>
      <td class="right">${escapeHtml(item.quantity)}</td>
      <td class="right">${escapeHtml(item.unitCost)}</td>
      <td class="right">${escapeHtml(item.amount)}</td>
    </tr>
  `).join('');

  const body = `
    ${getHeader(company)}

    <div class="doc-title">Receiving Report</div>

    <div class="info-grid">
      <div class="info-block">
        <div class="info-label">Received From</div>
        ${supplier
          ? `<div class="info-value" style="font-weight:600;">${escapeHtml(supplier)}</div>`
          : '<div class="info-value" style="color:#999;">-</div>'}
      </div>

      <div class="info-block right">
        <div class="info-label">Reference</div>
        <div class="info-value">${escapeHtml(reference)}</div>

        <div class="info-label">Receiving Date</div>
        <div class="info-value">${formatDate(receivingDate)}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width: 40px;">#</th>
          <th>Part No.</th>
          <th>Description</th>
          <th class="right">Qty</th>
          <th class="right">Unit Cost</th>
          <th class="right">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${rows || '<tr><td colspan="6" style="text-align:center; color:#999; padding:16px;">No items</td></tr>'}
      </tbody>
      <tfoot>
        <tr class="total">
          <td colspan="3" class="right">Total</td>
          <td class="right">${escapeHtml(totalQuantity)}</td>
          <td></td>
          <td class="right">${escapeHtml(totalCost)}</td>
        </tr>
      </tfoot>
    </table>

    <div style="font-size: 8pt; color: #888; margin-top: 8px;">Printed ${escapeHtml(printedAt)}</div>

    ${getFooter(company)}
  `;

  return wrapTemplate('', body);
}
