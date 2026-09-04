import { CreditNoteTemplateData } from '../types';
import { ThermalPaperWidth } from '../../../../shared/types/print';
import {
  wrapThermalTemplate,
  getThermalHeader,
  getThermalFooter,
  getThermalInfoRow,
  formatCurrency,
  formatDate,
} from './thermalBaseStyles';

// Local escape (thermalBaseStyles keeps escapeHtml private); mirrors its rules.
function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function getThermalCreditNoteTemplate(data: CreditNoteTemplateData, paperWidth: ThermalPaperWidth): string {
  const { company, creditNote, usage, salespersonName } = data;
  const sym = company.currencySymbol;

  const total = parseFloat(creditNote.total || '0');
  const used = parseFloat(creditNote.totalUsed || '0');
  const remaining = total - used;

  const statusText = creditNote.status === 'U' ? 'FULLY USED'
    : creditNote.status === 'A' ? 'ACTIVE'
    : creditNote.status.toUpperCase();

  // Usage activity: each draw-down (applied/refunded) or reversal, newest first.
  const usageList = usage.length === 0
    ? '<div style="text-align:center; color:#666; margin: 4px 0;">No usage yet</div>'
    : usage.map((u) => {
        const amt = parseFloat(u.amount || '0');
        const amountText = amt < 0
          ? `(${formatCurrency(Math.abs(amt).toString(), sym)})`
          : formatCurrency(u.amount, sym);
        const left = [formatDate(u.date), u.invoiceNumber].filter(Boolean).join(' · ');
        return `
          <div class="item">
            <div class="item-name">${esc(u.description || 'Applied to invoice')}</div>
            <div class="item-detail">
              <span>${esc(left || '-')}</span>
              <span>${amountText}</span>
            </div>
          </div>
        `;
      }).join('');

  const summary = `
    <div class="totals">
      <div class="row"><span>Issued</span><span>${formatCurrency(creditNote.total, sym)}</span></div>
      <div class="row"><span>Used</span><span>${formatCurrency(creditNote.totalUsed, sym)}</span></div>
      <div class="row grand"><span>REMAINING</span><span>${formatCurrency(remaining.toString(), sym)}</span></div>
    </div>
  `;

  const body = `
    ${getThermalHeader(company)}

    <div class="thermal-title">Credit Note</div>

    <hr class="sep">

    ${getThermalInfoRow('CN #', creditNote.crNumber)}
    ${getThermalInfoRow('Date', formatDate(creditNote.crDate))}
    ${creditNote.invNumber ? getThermalInfoRow('Invoice', creditNote.invNumber) : ''}
    ${creditNote.clientName ? getThermalInfoRow('Client', creditNote.clientName) : ''}
    ${creditNote.reference ? getThermalInfoRow('Ref', creditNote.reference) : ''}
    ${salespersonName ? getThermalInfoRow('Sales', salespersonName) : ''}

    <hr class="sep">

    <div style="font-weight:600; margin: 2px 0 4px;">Usage Activity</div>
    ${usageList}

    <hr class="sep">

    ${summary}

    ${getThermalInfoRow('Status', statusText)}

    ${getThermalFooter()}
  `;

  return wrapThermalTemplate(paperWidth, body);
}
