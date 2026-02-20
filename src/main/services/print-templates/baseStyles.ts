import { CompanyInfo, PrintLineItem } from './types';

export function getBaseStyles(): string {
  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page { size: letter; margin: 0.5in; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 10pt;
      color: #1a1a1a;
      line-height: 1.4;
    }
    .page { max-width: 7.5in; margin: 0 auto; }

    /* Header */
    .header { margin-bottom: 20px; padding-bottom: 12px; border-bottom: 2px solid #333; }
    .header .company-name { font-size: 18pt; font-weight: 700; color: #111; margin-bottom: 2px; }
    .header .company-details { font-size: 8pt; color: #555; line-height: 1.5; }

    /* Document title */
    .doc-title {
      font-size: 16pt; font-weight: 700; text-transform: uppercase;
      color: #333; margin: 16px 0 12px; text-align: right;
    }

    /* Info grid */
    .info-grid { display: flex; justify-content: space-between; margin-bottom: 16px; }
    .info-block { flex: 1; }
    .info-block.right { text-align: right; }
    .info-label { font-size: 8pt; color: #777; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px; }
    .info-value { font-size: 10pt; font-weight: 500; margin-bottom: 8px; }

    /* Tables */
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    thead th {
      background: #f5f5f5; border-bottom: 2px solid #ccc;
      padding: 6px 8px; font-size: 8pt; text-transform: uppercase;
      letter-spacing: 0.3px; color: #555; text-align: left;
    }
    thead th.right, tbody td.right, tfoot td.right { text-align: right; }
    tbody td { padding: 5px 8px; border-bottom: 1px solid #eee; font-size: 9pt; }
    tbody tr:nth-child(even) { background: #fafafa; }
    tfoot td { padding: 5px 8px; font-weight: 600; font-size: 9pt; }
    tfoot tr.total td { border-top: 2px solid #333; font-size: 11pt; font-weight: 700; }

    /* Summary */
    .summary-table { width: auto; margin-left: auto; min-width: 250px; }
    .summary-table td { padding: 3px 8px; }
    .summary-table .label { color: #555; text-align: right; padding-right: 16px; }
    .summary-table .value { text-align: right; font-weight: 500; }
    .summary-table .total-row td { border-top: 2px solid #333; font-size: 11pt; font-weight: 700; padding-top: 6px; }

    /* Status badge */
    .badge {
      display: inline-block; padding: 2px 8px; border-radius: 3px;
      font-size: 8pt; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px;
    }
    .badge-green { background: #d4edda; color: #155724; }
    .badge-red { background: #f8d7da; color: #721c24; }
    .badge-blue { background: #cce5ff; color: #004085; }
    .badge-gray { background: #e9ecef; color: #495057; }
    .badge-yellow { background: #fff3cd; color: #856404; }

    /* Notes */
    .notes { margin-top: 16px; padding: 8px 12px; background: #f9f9f9; border-left: 3px solid #ddd; font-size: 9pt; }
    .notes-label { font-weight: 600; margin-bottom: 4px; }

    /* Footer */
    .footer {
      margin-top: 32px; padding-top: 12px; border-top: 1px solid #ddd;
      text-align: center; font-size: 8pt; color: #888;
    }

    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .page { max-width: none; }
      thead { display: table-header-group; }
      tbody tr { page-break-inside: avoid; }
    }
  `;
}

export function getHeader(company: CompanyInfo): string {
  const details = [
    company.companyAddress,
    company.companyPhone ? `Tel: ${company.companyPhone}` : null,
    company.companyEmail ? `Email: ${company.companyEmail}` : null,
    company.companyTrn ? `TRN: ${company.companyTrn}` : null,
  ].filter(Boolean).join(' &bull; ');

  const logo = company.companyLogo
    ? `<img src="${company.companyLogo}" style="height:40px;width:40px;margin-right:10px;border-radius:4px;" />`
    : '';

  return `
    <div class="header" style="display:flex;align-items:center;">
      ${logo}
      <div>
        <div class="company-name">${escapeHtml(company.companyName || 'Company')}</div>
        <div class="company-details">${details}</div>
      </div>
    </div>
  `;
}

export function getFooter(company: CompanyInfo): string {
  return `
    <div class="footer">
      <div>Thank you for your business</div>
      <div style="margin-top: 4px;">${escapeHtml(company.companyName || '')}${company.companyPhone ? ` &bull; ${escapeHtml(company.companyPhone)}` : ''}</div>
    </div>
  `;
}

export function formatCurrency(value: string | number, symbol: string): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return `${symbol}0.00`;
  return `${symbol}${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function getLineItemsTable(lineItems: PrintLineItem[], currencySymbol: string): string {
  const rows = lineItems.map((item, i) => `
    <tr>
      <td style="width: 40px; color: #999;">${i + 1}</td>
      <td>${escapeHtml(item.sku || '')}</td>
      <td>${escapeHtml(item.description || '')}</td>
      <td class="right">${parseFloat(item.quantity).toLocaleString('en-US', { maximumFractionDigits: 4 })}</td>
      <td class="right">${formatCurrency(item.unitPrice, currencySymbol)}</td>
      <td class="right">${parseFloat(item.discount) > 0 ? formatCurrency(item.discount, currencySymbol) : '—'}</td>
      <td class="right">${formatCurrency(item.amount, currencySymbol)}</td>
    </tr>
  `).join('');

  return `
    <table>
      <thead>
        <tr>
          <th style="width: 40px;">#</th>
          <th>SKU</th>
          <th>Description</th>
          <th class="right">Qty</th>
          <th class="right">Unit Price</th>
          <th class="right">Discount</th>
          <th class="right">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${rows || '<tr><td colspan="7" style="text-align:center; color:#999; padding:16px;">No items</td></tr>'}
      </tbody>
    </table>
  `;
}

export function getTotalsBlock(
  subTotal: string,
  tax: string,
  total: string,
  currencySymbol: string,
  extraRows?: Array<{ label: string; value: string; bold?: boolean }>,
): string {
  let rows = `
    <tr><td class="label">Subtotal</td><td class="value">${formatCurrency(subTotal, currencySymbol)}</td></tr>
    <tr><td class="label">Tax</td><td class="value">${formatCurrency(tax, currencySymbol)}</td></tr>
  `;

  if (extraRows) {
    for (const row of extraRows) {
      rows += `<tr${row.bold ? ' class="total-row"' : ''}><td class="label">${escapeHtml(row.label)}</td><td class="value">${escapeHtml(row.value)}</td></tr>`;
    }
  }

  rows += `<tr class="total-row"><td class="label">Total</td><td class="value">${formatCurrency(total, currencySymbol)}</td></tr>`;

  return `<table class="summary-table">${rows}</table>`;
}

export function getClientBlock(
  clientName: string | null,
  address1: string | null,
  address2: string | null,
  phone: string | null,
): string {
  const lines = [
    clientName ? `<div class="info-value" style="font-weight:600;">${escapeHtml(clientName)}</div>` : '',
    address1 ? `<div style="font-size:9pt;">${escapeHtml(address1)}</div>` : '',
    address2 ? `<div style="font-size:9pt;">${escapeHtml(address2)}</div>` : '',
    phone ? `<div style="font-size:9pt; color:#555;">Tel: ${escapeHtml(phone)}</div>` : '',
  ].filter(Boolean).join('');

  return `
    <div class="info-block">
      <div class="info-label">Bill To</div>
      ${lines || '<div class="info-value" style="color:#999;">—</div>'}
    </div>
  `;
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function wrapTemplate(styles: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <style>${getBaseStyles()}${styles}</style>
</head>
<body>
  <div class="page">
    ${body}
  </div>
</body>
</html>`;
}
