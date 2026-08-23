import { formatTTD } from "@/lib/money";

type Line = { description: string; quantity: number; unitPrice: number; lineTotal: number };

function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function linesHtml(lines: Line[]) {
  return lines
    .map(
      (l) =>
        `<tr>
          <td style="padding:6px 0;border-bottom:1px solid #e5e7eb">
            ${esc(l.description)}
            <div style="color:#6b7280;font-size:12px">${esc(formatTTD(l.unitPrice))} each</div>
          </td>
          <td style="padding:6px 0;border-bottom:1px solid #e5e7eb;text-align:right">${l.quantity}</td>
          <td style="padding:6px 0;border-bottom:1px solid #e5e7eb;text-align:right">${esc(formatTTD(l.lineTotal))}</td>
        </tr>`,
    )
    .join("");
}

function wrapDocument(opts: {
  header: string;
  title: string;
  metaRows: { label: string; value: string }[];
  bodyHtml: string;
  footer: string;
}) {
  const meta = opts.metaRows
    .map(
      (r) =>
        `<tr><td style="padding:4px 0;color:#6b7280">${esc(r.label)}</td><td style="padding:4px 0;text-align:right"><strong>${esc(r.value)}</strong></td></tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html><body style="margin:0;padding:24px;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:24px;border:1px solid #e5e7eb">
    <div style="text-align:center;margin-bottom:16px">
      <div style="font-size:22px;font-weight:700;color:#0a6b6e">${esc(opts.header)}</div>
      <div style="color:#6b7280;font-size:13px;margin-top:4px">${esc(opts.title)}</div>
    </div>
    <table style="width:100%;font-size:14px;border-collapse:collapse">${meta}</table>
    <hr style="border:none;border-top:1px dashed #d1d5db;margin:16px 0" />
    ${opts.bodyHtml}
    <p style="text-align:center;color:#6b7280;font-size:12px;margin-top:24px">${esc(opts.footer)}</p>
  </div>
</body></html>`;
}

export function buildSaleReceiptEmail(opts: {
  header: string;
  footer: string;
  number: string;
  dateLabel: string;
  customerName: string;
  method: string;
  lines: Line[];
  subtotal: number;
  discountAmount?: number;
  discountPercent?: number;
  taxAmount?: number;
  total: number;
  honeyPersons?: string | null;
  apiaryNumber?: string | null;
  oprNumber?: string | null;
  isRefund?: boolean;
}) {
  const metaRows = [
    { label: "Receipt #", value: opts.number },
    { label: "Date", value: opts.dateLabel },
    { label: "Customer", value: opts.customerName },
    { label: "Payment", value: opts.method },
  ];
  if (opts.honeyPersons?.trim()) {
    metaRows.push({ label: "Persons involved", value: opts.honeyPersons.trim() });
  }
  if (opts.apiaryNumber?.trim()) {
    metaRows.push({ label: "Apiary Number", value: opts.apiaryNumber.trim() });
  }
  if (opts.oprNumber?.trim()) {
    metaRows.push({ label: "OPR #", value: opts.oprNumber.trim() });
  }

  const totals = [
    `<div style="display:flex;justify-content:space-between;margin-top:12px"><span>Subtotal</span><span>${esc(formatTTD(opts.subtotal))}</span></div>`,
  ];
  if (opts.discountAmount) {
    totals.push(
      `<div style="display:flex;justify-content:space-between"><span>Discount${opts.discountPercent ? ` (${opts.discountPercent}%)` : ""}</span><span>−${esc(formatTTD(Math.abs(opts.discountAmount)))}</span></div>`,
    );
  }
  if (opts.taxAmount) {
    totals.push(
      `<div style="display:flex;justify-content:space-between"><span>Tax</span><span>${esc(formatTTD(opts.taxAmount))}</span></div>`,
    );
  }
  totals.push(
    `<div style="display:flex;justify-content:space-between;margin-top:8px;font-size:18px"><strong>Total</strong><strong>${esc(formatTTD(opts.total))}</strong></div>`,
  );

  const bodyHtml = `
    <table style="width:100%;font-size:13px;border-collapse:collapse">
      <thead><tr>
        <th style="text-align:left;padding-bottom:6px">Item</th>
        <th style="text-align:right;padding-bottom:6px">Qty</th>
        <th style="text-align:right;padding-bottom:6px">Total</th>
      </tr></thead>
      <tbody>${linesHtml(opts.lines)}</tbody>
    </table>
    ${totals.join("")}
  `;

  const title = opts.isRefund ? "Refund receipt" : "Sales receipt";
  const html = wrapDocument({
    header: opts.header,
    title,
    metaRows,
    bodyHtml,
    footer: opts.footer,
  });

  const text = [
    opts.header,
    title,
    `Receipt #: ${opts.number}`,
    `Date: ${opts.dateLabel}`,
    `Customer: ${opts.customerName}`,
    `Payment: ${opts.method}`,
    "",
    ...opts.lines.map(
      (l) => `${l.quantity}× ${l.description} — ${formatTTD(l.lineTotal)}`,
    ),
    "",
    `Total: ${formatTTD(opts.total)}`,
    opts.footer,
  ].join("\n");

  return {
    subject: `${title} ${opts.number} — ${opts.header}`,
    text,
    html,
  };
}

export function buildQuotationEmail(opts: {
  header: string;
  footer: string;
  number: string;
  dateLabel: string;
  customerName: string;
  title?: string | null;
  lines: { label: string; amount: number }[];
  total: number;
  notes?: string | null;
}) {
  const rows = opts.lines;

  const bodyHtml = `
    <table style="width:100%;font-size:13px;border-collapse:collapse">
      ${rows
        .map(
          (r) =>
            `<tr><td style="padding:6px 0;border-bottom:1px solid #e5e7eb">${esc(r.label)}</td><td style="padding:6px 0;border-bottom:1px solid #e5e7eb;text-align:right">${esc(formatTTD(r.amount))}</td></tr>`,
        )
        .join("")}
    </table>
    <div style="display:flex;justify-content:space-between;margin-top:12px;font-size:18px">
      <strong>Total</strong><strong>${esc(formatTTD(opts.total))}</strong>
    </div>
    ${opts.notes?.trim() ? `<p style="margin-top:16px;color:#6b7280">${esc(opts.notes.trim())}</p>` : ""}
  `;

  const metaRows = [
    { label: "Quote #", value: opts.number },
    { label: "Date", value: opts.dateLabel },
    { label: "Customer", value: opts.customerName },
  ];
  if (opts.title) metaRows.push({ label: "Title", value: opts.title });

  const html = wrapDocument({
    header: opts.header,
    title: "Quotation",
    metaRows,
    bodyHtml,
    footer: opts.footer,
  });

  const text = [
    opts.header,
    "Quotation",
    `Quote #: ${opts.number}`,
    `Customer: ${opts.customerName}`,
    opts.title ? `Title: ${opts.title}` : "",
    ...rows.map((r) => `${r.label}: ${formatTTD(r.amount)}`),
    `Total: ${formatTTD(opts.total)}`,
    opts.notes?.trim() ? `Notes: ${opts.notes.trim()}` : "",
    opts.footer,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    subject: `Quotation ${opts.number} — ${opts.header}`,
    text,
    html,
  };
}

export function buildInvoiceEmail(opts: {
  header: string;
  footer: string;
  number: string;
  issueDate: string;
  dueDate?: string | null;
  customerName: string;
  jobNumber?: string | null;
  lines: Line[];
  subtotal: number;
  taxAmount: number;
  total: number;
  amountPaid: number;
  notes?: string | null;
}) {
  const balance = opts.total - opts.amountPaid;
  const metaRows = [
    { label: "Invoice #", value: opts.number },
    { label: "Issue date", value: opts.issueDate },
    { label: "Customer", value: opts.customerName },
  ];
  if (opts.dueDate) metaRows.push({ label: "Due date", value: opts.dueDate });
  if (opts.jobNumber) metaRows.push({ label: "Job", value: opts.jobNumber });

  const bodyHtml = `
    <table style="width:100%;font-size:13px;border-collapse:collapse">
      <thead><tr>
        <th style="text-align:left;padding-bottom:6px">Item</th>
        <th style="text-align:right;padding-bottom:6px">Qty</th>
        <th style="text-align:right;padding-bottom:6px">Total</th>
      </tr></thead>
      <tbody>
        ${
          opts.lines.length
            ? linesHtml(opts.lines)
            : `<tr><td colspan="3" style="padding:6px 0;color:#6b7280">Services / billed amount</td></tr>`
        }
      </tbody>
    </table>
    <div style="display:flex;justify-content:space-between;margin-top:12px"><span>Subtotal</span><span>${esc(formatTTD(opts.subtotal || opts.total))}</span></div>
    ${opts.taxAmount ? `<div style="display:flex;justify-content:space-between"><span>Tax</span><span>${esc(formatTTD(opts.taxAmount))}</span></div>` : ""}
    <div style="display:flex;justify-content:space-between;margin-top:8px;font-size:18px"><strong>Total</strong><strong>${esc(formatTTD(opts.total))}</strong></div>
    <div style="display:flex;justify-content:space-between"><span>Paid</span><span>${esc(formatTTD(opts.amountPaid))}</span></div>
    <div style="display:flex;justify-content:space-between"><strong>Balance</strong><strong>${esc(formatTTD(balance))}</strong></div>
    ${opts.notes?.trim() ? `<p style="margin-top:16px;color:#6b7280">${esc(opts.notes.trim())}</p>` : ""}
  `;

  const html = wrapDocument({
    header: opts.header,
    title: "Invoice",
    metaRows,
    bodyHtml,
    footer: opts.footer,
  });

  const text = [
    opts.header,
    "Invoice",
    `Invoice #: ${opts.number}`,
    `Customer: ${opts.customerName}`,
    `Total: ${formatTTD(opts.total)}`,
    `Paid: ${formatTTD(opts.amountPaid)}`,
    `Balance: ${formatTTD(balance)}`,
    opts.footer,
  ].join("\n");

  return {
    subject: `Invoice ${opts.number} — ${opts.header}`,
    text,
    html,
  };
}

export function buildPaymentEmail(opts: {
  header: string;
  footer: string;
  dateLabel: string;
  customerName: string;
  invoiceNumber?: string | null;
  method: string;
  reference?: string | null;
  amount: number;
  notes?: string | null;
}) {
  const metaRows = [
    { label: "Date", value: opts.dateLabel },
    { label: "Customer", value: opts.customerName },
    { label: "Method", value: opts.method },
  ];
  if (opts.invoiceNumber) metaRows.push({ label: "Invoice", value: opts.invoiceNumber });
  if (opts.reference) metaRows.push({ label: "Reference", value: opts.reference });

  const bodyHtml = `
    <div style="display:flex;justify-content:space-between;font-size:18px;margin-top:8px">
      <strong>Amount received</strong><strong>${esc(formatTTD(opts.amount))}</strong>
    </div>
    ${opts.notes?.trim() ? `<p style="margin-top:16px;color:#6b7280">${esc(opts.notes.trim())}</p>` : ""}
  `;

  const html = wrapDocument({
    header: opts.header,
    title: "Payment receipt",
    metaRows,
    bodyHtml,
    footer: opts.footer,
  });

  const text = [
    opts.header,
    "Payment receipt",
    `Customer: ${opts.customerName}`,
    `Amount: ${formatTTD(opts.amount)}`,
    `Method: ${opts.method}`,
    opts.footer,
  ].join("\n");

  return {
    subject: `Payment receipt — ${opts.header}`,
    text,
    html,
  };
}

export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
