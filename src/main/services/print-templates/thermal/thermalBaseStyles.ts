import { CompanyInfo, PrintLineItem } from '../types';
import { formatCurrency, formatDate, escapeHtml } from '../baseStyles';
import { ThermalPaperWidth } from '../../../../shared/types/print';

// Re-export utilities so thermal templates can import from one place
export { formatCurrency, formatDate, escapeHtml };

const PAPER_CONFIG: Record<ThermalPaperWidth, { maxWidth: number; pageSize: string }> = {
  '80mm': { maxWidth: 302, pageSize: '80mm' },
  '58mm': { maxWidth: 219, pageSize: '58mm' },
};

export function getThermalBaseStyles(paperWidth: ThermalPaperWidth): string {
  const config = PAPER_CONFIG[paperWidth];

  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page { size: ${config.pageSize} auto; margin: 2mm 3mm; }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 8pt;
      color: #000;
      line-height: 1.3;
      max-width: ${config.maxWidth}px;
      margin: 0 auto;
    }

    /* Header */
    .thermal-header { text-align: center; margin-bottom: 6px; }
    .thermal-header .company-name { font-size: 11pt; font-weight: 700; }
    .thermal-header .company-detail { font-size: 7pt; color: #333; }

    /* Dashed separator */
    .sep { border: none; border-top: 1px dashed #000; margin: 4px 0; }

    /* Document title */
    .thermal-title { text-align: center; font-size: 10pt; font-weight: 700; margin: 4px 0; text-transform: uppercase; }

    /* Info rows */
    .info-row { display: flex; justify-content: space-between; font-size: 8pt; line-height: 1.5; }
    .info-row .label { color: #333; }
    .info-row .value { font-weight: 600; text-align: right; }

    /* Line items */
    .item { margin: 3px 0; }
    .item-name { font-size: 8pt; font-weight: 600; }
    .item-detail { font-size: 7pt; display: flex; justify-content: space-between; color: #333; }

    /* Totals */
    .totals { margin-top: 4px; }
    .totals .row { display: flex; justify-content: space-between; font-size: 8pt; }
    .totals .row.grand { font-size: 10pt; font-weight: 700; border-top: 2px dashed #000; padding-top: 3px; margin-top: 3px; }

    /* Footer */
    .thermal-footer { text-align: center; margin-top: 8px; font-size: 7pt; color: #333; }

    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  `;
}

export function getThermalHeader(company: CompanyInfo): string {
  const details = [
    company.companyAddress,
    company.companyPhone ? `Tel: ${company.companyPhone}` : null,
    company.companyEmail,
    company.companyTrn ? `TRN: ${company.companyTrn}` : null,
  ].filter(Boolean);

  const logo = company.companyLogo
    ? `<img src="${company.companyLogo}" style="height:30px;width:30px;margin-bottom:4px;" />`
    : '';

  return `
    <div class="thermal-header">
      ${logo}
      <div class="company-name">${escapeHtml(company.companyName || 'Company')}</div>
      ${details.map(d => `<div class="company-detail">${escapeHtml(d!)}</div>`).join('')}
    </div>
    <hr class="sep">
  `;
}

export function getThermalFooter(): string {
  return `
    <hr class="sep">
    <div class="thermal-footer">
      <div>Thank you for your business!</div>
    </div>
  `;
}

export function getThermalInfoRow(label: string, value: string): string {
  return `<div class="info-row"><span class="label">${escapeHtml(label)}</span><span class="value">${escapeHtml(value)}</span></div>`;
}

export function getThermalLineItems(items: PrintLineItem[], currencySymbol: string): string {
  if (items.length === 0) {
    return '<div style="text-align:center; color:#666; margin: 4px 0;">No items</div>';
  }

  return items.map((item) => {
    const qty = parseFloat(item.quantity);
    const price = formatCurrency(item.unitPrice, currencySymbol);
    const amount = formatCurrency(item.amount, currencySymbol);
    const discount = parseFloat(item.discount);

    return `
      <div class="item">
        <div class="item-name">${escapeHtml(item.description || item.sku || '-')}</div>
        <div class="item-detail">
          <span>${qty} x ${price}${discount > 0 ? ` (-${formatCurrency(item.discount, currencySymbol)})` : ''}</span>
          <span>${amount}</span>
        </div>
      </div>
    `;
  }).join('');
}

export function getThermalTotals(
  subTotal: string,
  tax: string,
  total: string,
  currencySymbol: string,
  extraRows?: Array<{ label: string; value: string; grand?: boolean }>,
): string {
  let rows = `
    <div class="row"><span>Subtotal</span><span>${formatCurrency(subTotal, currencySymbol)}</span></div>
    <div class="row"><span>Tax</span><span>${formatCurrency(tax, currencySymbol)}</span></div>
  `;

  if (extraRows) {
    for (const row of extraRows) {
      rows += `<div class="row${row.grand ? ' grand' : ''}"><span>${escapeHtml(row.label)}</span><span>${escapeHtml(row.value)}</span></div>`;
    }
  }

  rows += `<div class="row grand"><span>TOTAL</span><span>${formatCurrency(total, currencySymbol)}</span></div>`;

  return `<div class="totals">${rows}</div>`;
}

export function wrapThermalTemplate(paperWidth: ThermalPaperWidth, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <style>${getThermalBaseStyles(paperWidth)}</style>
</head>
<body>
  ${body}
</body>
</html>`;
}
