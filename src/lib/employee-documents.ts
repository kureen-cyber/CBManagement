import { formatTTD } from "@/lib/money";
import { formatAppDate } from "@/lib/timezone";
import type { PayFrequency } from "@/lib/employee-banks";

function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function frequencyLabel(frequency: PayFrequency) {
  if (frequency === "weekly") return "weekly";
  if (frequency === "fortnightly") return "fortnightly";
  return "monthly";
}

export type EmployeeLetterData = {
  companyName: string;
  letterheadData?: string | null;
  businessLogoData?: string | null;
  footer?: string | null;
  employeeName: string;
  role?: string | null;
  email?: string | null;
  phone?: string | null;
  dateOfEngagement?: Date | string | null;
  nisNumber?: string | null;
  payeNumber?: string | null;
  bankName?: string | null;
  bankBranch?: string | null;
  bankAccountNumber?: string | null;
  salaryCents: number;
  frequency: PayFrequency;
};

export type PayslipLine = {
  date: string;
  clockIn: string;
  clockOut: string;
  hours: number;
  payCents: number;
};

export type EmployeePayslipData = {
  companyName: string;
  letterheadData?: string | null;
  businessLogoData?: string | null;
  footer?: string | null;
  employeeName: string;
  role?: string | null;
  nisNumber?: string | null;
  payeNumber?: string | null;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  periodStart: Date | string;
  periodEnd: Date | string;
  lines: PayslipLine[];
  hoursWorked: number;
  grossPayCents: number;
};

function documentShell(opts: {
  companyName: string;
  title: string;
  letterheadData?: string | null;
  businessLogoData?: string | null;
  footer?: string | null;
  body: string;
}) {
  const letterhead = opts.letterheadData
    ? `<img src="${opts.letterheadData}" alt="" class="document-letterhead" />`
    : "";
  const logo = opts.businessLogoData
    ? `<img src="${opts.businessLogoData}" alt="" class="receipt-logo" />`
    : "";

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8" />
<style>
  body { font-family: Georgia, "Times New Roman", serif; color: #111; margin: 0; padding: 24px; line-height: 1.55; }
  .sheet { max-width: 720px; margin: 0 auto; }
  .document-letterhead { display:block;width:100%;max-height:140px;object-fit:contain;margin:0 auto 12px; }
  .receipt-logo { display:block;max-width:160px;max-height:80px;margin:0 auto 10px; }
  h1 { font-size: 1.35rem; margin: 0 0 1rem; text-align: center; }
  .meta { margin: 1rem 0; font-size: 0.95rem; }
  .meta p { margin: 0.25rem 0; }
  table.data { width:100%; border-collapse: collapse; font-size: 0.9rem; margin-top: 1rem; }
  table.data th, table.data td { border-bottom: 1px solid #ddd; padding: 0.45rem 0.35rem; text-align: left; }
  table.data th { font-size: 0.75rem; text-transform: uppercase; color: #555; }
  .footer { margin-top: 2rem; font-size: 0.85rem; color: #555; text-align: center; }
  @media print { body { padding: 0; } }
</style></head><body>
<div class="sheet employee-document-print">
  ${letterhead}
  ${logo}
  <div style="text-align:center;font-weight:700;font-size:1.1rem;margin-bottom:0.35rem">${esc(opts.companyName)}</div>
  <h1>${esc(opts.title)}</h1>
  ${opts.body}
  <div class="footer">${esc(opts.footer || "Confidential — for the employee's records.")}</div>
</div>
</body></html>`;
}

export function buildJobLetterHtml(data: EmployeeLetterData) {
  const engaged = data.dateOfEngagement ? formatAppDate(data.dateOfEngagement) : "—";
  const body = `
    <p>${formatAppDate(new Date())}</p>
    <p><strong>${esc(data.employeeName)}</strong><br/>
    ${data.role ? esc(data.role) : "Employee"}</p>
    <p>Dear ${esc(data.employeeName.split(" ")[0] || data.employeeName)},</p>
    <p>
      We are pleased to confirm your employment with <strong>${esc(data.companyName)}</strong>
      ${data.role ? ` as <strong>${esc(data.role)}</strong>` : ""}, effective <strong>${esc(engaged)}</strong>.
    </p>
    <div class="meta">
      <p><strong>Remuneration:</strong> ${esc(formatTTD(data.salaryCents))} ${esc(frequencyLabel(data.frequency))}</p>
      ${data.email ? `<p><strong>Email:</strong> ${esc(data.email)}</p>` : ""}
      ${data.phone ? `<p><strong>Phone:</strong> ${esc(data.phone)}</p>` : ""}
      ${data.nisNumber ? `<p><strong>NIS:</strong> ${esc(data.nisNumber)}</p>` : ""}
      ${data.payeNumber ? `<p><strong>PAYE:</strong> ${esc(data.payeNumber)}</p>` : ""}
      ${
        data.bankName
          ? `<p><strong>Bank:</strong> ${esc(data.bankName)}${data.bankBranch ? `, ${esc(data.bankBranch)}` : ""}${data.bankAccountNumber ? ` — Acct ${esc(data.bankAccountNumber)}` : ""}</p>`
          : ""
      }
    </div>
    <p>
      This letter confirms the terms discussed and your engagement with our organisation.
      Please retain a copy for your records.
    </p>
    <p style="margin-top:2rem">Sincerely,<br/><strong>${esc(data.companyName)}</strong></p>
  `;

  return documentShell({
    companyName: data.companyName,
    title: "Employment Confirmation",
    letterheadData: data.letterheadData,
    businessLogoData: data.businessLogoData,
    footer: data.footer,
    body,
  });
}

export function buildPayslipHtml(data: EmployeePayslipData) {
  const rows = data.lines
    .map(
      (line) =>
        `<tr>
          <td>${esc(line.date)}</td>
          <td>${esc(line.clockIn)}</td>
          <td>${esc(line.clockOut)}</td>
          <td>${line.hours.toFixed(2)}</td>
          <td style="text-align:right">${esc(formatTTD(line.payCents))}</td>
        </tr>`,
    )
    .join("");

  const body = `
    <div class="meta">
      <p><strong>Employee:</strong> ${esc(data.employeeName)}</p>
      ${data.role ? `<p><strong>Role:</strong> ${esc(data.role)}</p>` : ""}
      <p><strong>Pay period:</strong> ${esc(formatAppDate(data.periodStart))} – ${esc(formatAppDate(data.periodEnd))}</p>
      ${data.nisNumber ? `<p><strong>NIS:</strong> ${esc(data.nisNumber)}</p>` : ""}
      ${data.payeNumber ? `<p><strong>PAYE:</strong> ${esc(data.payeNumber)}</p>` : ""}
      ${
        data.bankName
          ? `<p><strong>Bank:</strong> ${esc(data.bankName)}${data.bankAccountNumber ? ` — ${esc(data.bankAccountNumber)}` : ""}</p>`
          : ""
      }
    </div>
    <table class="data">
      <thead>
        <tr>
          <th>Date</th>
          <th>Clocked in</th>
          <th>Clocked out</th>
          <th>Hours</th>
          <th style="text-align:right">Pay</th>
        </tr>
      </thead>
      <tbody>
        ${rows || `<tr><td colspan="5">No completed shifts in this period.</td></tr>`}
      </tbody>
    </table>
    <div class="meta" style="margin-top:1.25rem">
      <p><strong>Total hours:</strong> ${data.hoursWorked.toFixed(2)}</p>
      <p><strong>Gross pay:</strong> ${esc(formatTTD(data.grossPayCents))}</p>
    </div>
  `;

  return documentShell({
    companyName: data.companyName,
    title: "Payslip",
    letterheadData: data.letterheadData,
    businessLogoData: data.businessLogoData,
    footer: data.footer,
    body,
  });
}
