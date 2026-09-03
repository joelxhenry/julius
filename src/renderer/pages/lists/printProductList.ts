import type { ProductListWithItems, ProductListStatus } from '../../../shared/types/productList';

const STATUS_LABEL: Record<ProductListStatus, string> = {
  open: 'Open',
  ordered: 'Ordered',
  archived: 'Archived',
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(value: string | Date): string {
  return new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * Print a product list via a hidden iframe. Self-contained (no main-process
 * print template) so it works regardless of printer configuration; the OS
 * print dialog handles destination.
 */
export function printProductList(list: ProductListWithItems): void {
  const rows = list.items
    .map(
      (it, i) => `
        <tr>
          <td class="num">${i + 1}</td>
          <td class="sku">${escapeHtml(it.sku)}</td>
          <td>${escapeHtml(it.description ?? '')}</td>
          <td>${escapeHtml(it.note ?? '')}</td>
        </tr>`
    )
    .join('');

  const meta = [
    `Status: ${STATUS_LABEL[list.status] ?? list.status}`,
    list.createdByName ? `Created by: ${escapeHtml(list.createdByName)}` : null,
    `Created: ${formatDate(list.createdAt)}`,
    list.orderedAt ? `Ordered: ${formatDate(list.orderedAt)}` : null,
  ]
    .filter(Boolean)
    .join(' &nbsp;•&nbsp; ');

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(list.title)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 24px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .note { font-size: 13px; color: #333; margin: 0 0 8px; white-space: pre-wrap; }
  .meta { font-size: 11px; color: #555; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #ddd; vertical-align: top; }
  th { border-bottom: 2px solid #333; font-size: 11px; text-transform: uppercase; letter-spacing: .03em; }
  td.num { width: 32px; color: #777; }
  td.sku { font-weight: 600; white-space: nowrap; }
  tfoot td { border: 0; padding-top: 12px; font-size: 11px; color: #777; }
  @media print { body { margin: 12mm; } }
</style>
</head>
<body>
  <h1>${escapeHtml(list.title)}</h1>
  ${list.note ? `<p class="note">${escapeHtml(list.note)}</p>` : ''}
  <div class="meta">${meta}</div>
  <table>
    <thead>
      <tr><th>#</th><th>Part Number</th><th>Description</th><th>Note</th></tr>
    </thead>
    <tbody>
      ${rows || '<tr><td colspan="4" style="color:#777;padding:16px 8px;">No items.</td></tr>'}
    </tbody>
    <tfoot>
      <tr><td colspan="4">${list.items.length} item${list.items.length === 1 ? '' : 's'}</td></tr>
    </tfoot>
  </table>
</body>
</html>`;

  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();

  const win = iframe.contentWindow;
  if (!win) {
    document.body.removeChild(iframe);
    return;
  }
  // Give the iframe a tick to lay out before printing.
  win.onafterprint = () => {
    if (iframe.parentNode) document.body.removeChild(iframe);
  };
  setTimeout(() => {
    win.focus();
    win.print();
    // Fallback cleanup in case onafterprint never fires.
    setTimeout(() => {
      if (iframe.parentNode) document.body.removeChild(iframe);
    }, 60000);
  }, 150);
}
