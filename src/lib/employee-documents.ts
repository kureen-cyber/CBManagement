import { formatTTD } from "@/lib/money";
import { formatAppDate } from "@/lib/timezone";
import type { EmploymentBasis, EmployeePronoun, PayFrequency } from "@/lib/employee-banks";
import { resolveDocumentHeaderImages } from "@/lib/settings";

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

function pronounSubject(pronoun: EmployeePronoun) {
  if (pronoun === "he") return "He";
  if (pronoun === "she") return "She";
  return "They";
}

export type EmployeeLetterData = {
  companyName: string;
  letterheadData?: string | null;
  businessLogoData?: string | null;
  receiptLogoData?: string | null;
  companyStampData?: string | null;
  footer?: string | null;
  employeeName: string;
  role?: string | null;
  idNumber?: string | null;
  dateOfEngagement?: Date | string | null;
  employmentBasis: EmploymentBasis;
  pronoun: EmployeePronoun;
  salaryCents: number;
  frequency: PayFrequency;
  employerName?: string | null;
  employerTitle?: string | null;
  companyPhone?: string | null;
  companyEmail?: string | null;
};

export type PayslipLine = {
  date: string;
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
  /** NIS deduction amount for the period (cents) */
  nisDeductionCents?: number;
  /** PAYE deduction amount for the period (cents) */
  payeDeductionCents?: number;
};

function documentShell(opts: {
  companyName: string;
  title: string;
  letterheadData?: string | null;
  businessLogoData?: string | null;
  footer?: string | null;
  showFooter?: boolean;
  showCompanyName?: boolean;
  body: string;
}) {
  const letterhead = opts.letterheadData
    ? `<img src="${opts.letterheadData}" alt="" class="document-letterhead" />`
    : "";
  const logo = opts.businessLogoData
    ? `<img src="${opts.businessLogoData}" alt="" class="receipt-logo" />`
    : "";
  const showCompanyName = opts.showCompanyName !== false;
  const showFooter = opts.showFooter !== false;
  const footerText = opts.footer || "Confidential — for the employee's records.";

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
  .job-letter-heading { font-weight: 700; text-transform: uppercase; margin: 1.25rem 0 0.35rem; }
  .job-letter-subject { font-weight: 700; margin: 0 0 1.25rem; }
  .job-letter-body p { margin: 0 0 1rem; }
  .job-letter-signoff { margin-top: 2rem; }
  .job-letter-signoff .signature-line { margin: 2rem 0 0.75rem; border-bottom: 1px solid #111; max-width: 280px; }
  .job-letter-signoff p { margin: 0.15rem 0; }
  .company-stamp-img { display:block;max-width:120px;max-height:80px;margin-top:0.5rem;object-fit:contain; }
  @media print { body { padding: 0; } }
</style></head><body>
<div class="sheet employee-document-print">
  ${letterhead}
  ${logo}
  ${showCompanyName ? `<div style="text-align:center;font-weight:700;font-size:1.1rem;margin-bottom:0.35rem">${esc(opts.companyName)}</div>` : ""}
  ${opts.title ? `<h1>${esc(opts.title)}</h1>` : ""}
  ${opts.body}
  ${showFooter ? `<div class="footer">${esc(footerText)}</div>` : ""}
</div>
</body></html>`;
}

export function buildJobLetterHtml(data: EmployeeLetterData) {
  const engaged = data.dateOfEngagement ? formatAppDate(data.dateOfEngagement) : "—";
  const jobTitle = data.role?.trim() || "Employee";
  const idClause = data.idNumber?.trim()
    ? `, holder of National ID/Passport No. <strong>${esc(data.idNumber.trim())}</strong>,`
    : "";
  const subject = pronounSubject(data.pronoun);
  const employerName = data.employerName?.trim() || "____________________________";
  const employerTitle = data.employerTitle?.trim() || "";
  const companyPhone = data.companyPhone?.trim() || "—";
  const companyEmail = data.companyEmail?.trim() || "—";

  const stampBlock = data.companyStampData
    ? `<p><strong>Company Stamp:</strong></p><img src="${data.companyStampData}" alt="" class="company-stamp-img" />`
    : `<p><strong>Company Stamp:</strong> __________________</p>`;

  const body = `
    <div class="job-letter-body">
      <p class="job-letter-heading">To Whom It May Concern</p>
      <p class="job-letter-subject">Re: Employment Confirmation – ${esc(data.employeeName)}</p>
      <p>
        This letter serves to confirm that <strong>${esc(data.employeeName)}</strong>${idClause}
        is employed with <strong>${esc(data.companyName)}</strong> in the position of
        <strong>${esc(jobTitle)}</strong>.
      </p>
      <p>
        ${subject} commenced employment with the company on <strong>${esc(engaged)}</strong>
        and is currently employed on a <strong>${esc(data.employmentBasis)}</strong> basis.
      </p>
      <p>
        ${esc(data.employeeName)} receives a <strong>${esc(frequencyLabel(data.frequency))}</strong>
        salary of <strong>${esc(formatTTD(data.salaryCents))}</strong>.
      </p>
      <p>
        Should you require any further information or verification regarding this employment,
        please feel free to contact us using the information provided above.
      </p>
      <div class="job-letter-signoff">
        <p>Yours faithfully,</p>
        <div class="signature-line"></div>
        <p><strong>${esc(employerName)}</strong></p>
        ${employerTitle ? `<p>${esc(employerTitle)}</p>` : ""}
        <p>${esc(data.companyName)}</p>
        <p>${esc(companyPhone)}</p>
        <p>${esc(companyEmail)}</p>
        ${stampBlock}
      </div>
    </div>
  `;

  const headerImages = resolveDocumentHeaderImages({
    name: data.companyName,
    letterheadData: data.letterheadData,
    businessLogoData: data.businessLogoData,
    receiptLogoData: data.receiptLogoData,
  });

  return documentShell({
    companyName: data.companyName,
    title: "",
    letterheadData: headerImages.letterheadData,
    businessLogoData: headerImages.logoData,
    showFooter: false,
    showCompanyName: !headerImages.letterheadData,
    body,
  });
}

export function buildPayslipHtml(data: EmployeePayslipData) {
  const nisId = data.nisNumber?.trim() || "—";
  const payeId = data.payeNumber?.trim() || "—";
  const nisDeduction = Math.max(0, Math.round(data.nisDeductionCents || 0));
  const payeDeduction = Math.max(0, Math.round(data.payeDeductionCents || 0));
  const netPayCents = Math.max(0, data.grossPayCents - nisDeduction - payeDeduction);
  const periodLabel = `${formatAppDate(data.periodStart)} – ${formatAppDate(data.periodEnd)}`;

  const body = `
    <div class="meta">
      <p><strong>Employee:</strong> ${esc(data.employeeName)}</p>
      ${data.role ? `<p><strong>Role:</strong> ${esc(data.role)}</p>` : ""}
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
          <th>Hours</th>
          <th style="text-align:right">Gross Pay</th>
          <th>NIS</th>
          <th>PAYE</th>
          <th style="text-align:right">Net Pay</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td></td>
          <td></td>
          <td></td>
          <td>${esc(nisId)}</td>
          <td>${esc(payeId)}</td>
          <td></td>
        </tr>
        <tr>
          <td>${esc(periodLabel)}</td>
          <td>${data.hoursWorked.toFixed(2)}</td>
          <td style="text-align:right">${esc(formatTTD(data.grossPayCents))}</td>
          <td style="text-align:right">${esc(formatTTD(nisDeduction))}</td>
          <td style="text-align:right">${esc(formatTTD(payeDeduction))}</td>
          <td style="text-align:right">${esc(formatTTD(netPayCents))}</td>
        </tr>
      </tbody>
    </table>
  `;

  return documentShell({
    companyName: data.companyName,
    title: "Payslip",
    letterheadData: data.letterheadData,
    businessLogoData: data.businessLogoData,
    showFooter: false,
    body,
  });
}
