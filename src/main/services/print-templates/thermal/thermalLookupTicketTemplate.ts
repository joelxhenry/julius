import { getThermalBaseStyles, escapeHtml } from './thermalBaseStyles';
import { ThermalPaperWidth } from '../../../../shared/types/print';
import { LookupTicketData } from '../../../../shared/types/lookupTicket';

export function getThermalLookupTicketTemplate(
  data: LookupTicketData,
  paperWidth: ThermalPaperWidth,
): string {
  const items = data.items;

  const itemRows = items.map((item) => `
    <tr>
      <td class="lt-check">&#9744;</td>
      <td class="lt-item">
        <div class="lt-desc">${escapeHtml(item.description || item.sku)}</div>
        <div class="lt-sku">${escapeHtml(item.sku)}</div>
      </td>
      <td class="lt-loc"><b>${escapeHtml(item.location || '—')}</b></td>
      <td class="lt-qty">${item.quantity}</td>
    </tr>
  `).join('');

  const body = `
    <style>
      ${getThermalBaseStyles(paperWidth)}

      .lt-title { text-align: center; font-size: 10pt; font-weight: 700; margin: 4px 0; letter-spacing: 1px; }
      .lt-info { font-size: 8pt; line-height: 1.5; }
      .lt-info .label { color: #333; }
      .lt-info .value { font-weight: 600; }

      .lt-table { width: 100%; border-collapse: collapse; margin: 4px 0; font-size: 8pt; }
      .lt-table th { text-align: left; font-size: 7pt; color: #333; border-bottom: 1px dashed #000; padding: 2px 2px 3px; }
      .lt-table th.lt-qty-h { text-align: right; }
      .lt-table td { vertical-align: top; padding: 3px 2px; border-bottom: 1px dotted #ccc; }
      .lt-check { width: 14px; font-size: 10pt; line-height: 1; }
      .lt-desc { font-weight: 600; font-size: 8pt; }
      .lt-sku { font-size: 7pt; color: #555; }
      .lt-loc { white-space: nowrap; }
      .lt-qty { text-align: right; white-space: nowrap; }

      .lt-footer { text-align: center; margin-top: 6px; font-size: 7pt; color: #333; }
    </style>

    <div class="thermal-header">
      <div class="company-name">${escapeHtml(data.companyName || 'Company')}</div>
    </div>
    <hr class="sep">

    <div class="lt-title">LOOKUP TICKET</div>
    <hr class="sep">

    <div class="lt-info">
      <div><span class="label">Printed:</span> <span class="value">${escapeHtml(data.printedAt)}</span></div>
      ${data.sourceReference ? `<div><span class="label">Source:</span> <span class="value">${escapeHtml(data.sourceReference)}</span></div>` : ''}
    </div>
    <hr class="sep">

    <table class="lt-table">
      <thead>
        <tr>
          <th></th>
          <th>Item</th>
          <th>Loc</th>
          <th class="lt-qty-h">Qty</th>
        </tr>
      </thead>
      <tbody>
        ${items.length > 0 ? itemRows : '<tr><td colspan="4" style="text-align:center; color:#666; padding:8px 0;">No items</td></tr>'}
      </tbody>
    </table>

    <hr class="sep">
    <div class="lt-footer">${items.length} item${items.length !== 1 ? 's' : ''} on ticket</div>
  `;

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"></head>
<body>${body}</body>
</html>`;
}
