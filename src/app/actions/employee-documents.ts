"use server";

import { revalidatePath } from "next/cache";
import { requireCompany } from "@/lib/company";
import { prisma } from "@/lib/prisma";
import { toCents } from "@/lib/money";
import { sendEmail } from "@/lib/email";
import {
  buildJobLetterHtml,
  buildPayslipHtml,
  type PayslipLine,
} from "@/lib/employee-documents";
import { formatAppDate } from "@/lib/timezone";
import type { EmploymentBasis, EmployeePronoun, PayFrequency } from "@/lib/employee-banks";
import { DEFAULT_RECEIPT_FOOTER } from "@/lib/settings";

function parseDateOnly(value: string): Date {
  const d = new Date(`${value}T12:00:00`);
  if (Number.isNaN(d.getTime())) throw new Error("Invalid date");
  return d;
}

function endOfDay(d: Date) {
  const copy = new Date(d);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function loadEmployee(employeeId: string, companyId: string) {
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, companyId },
  });
  if (!employee) throw new Error("Employee not found");
  return employee;
}

async function loadCompanyBranding(companyId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      name: true,
      receiptHeader: true,
      receiptFooter: true,
      businessLogoData: true,
      receiptLogoData: true,
      letterheadData: true,
      companyStampData: true,
      businessContactNumber: true,
      businessEmail: true,
    },
  });
  if (!company) throw new Error("Company not found");
  return {
    companyName: company.receiptHeader?.trim() || company.name,
    footer: company.receiptFooter?.trim() || DEFAULT_RECEIPT_FOOTER,
    businessLogoData: company.businessLogoData,
    receiptLogoData: company.receiptLogoData,
    letterheadData: company.letterheadData,
    companyStampData: company.companyStampData,
    companyPhone: company.businessContactNumber,
    companyEmail: company.businessEmail,
  };
}

type JobLetterInput = {
  employeeId: string;
  salary: number;
  frequency: PayFrequency;
  idNumber?: string;
  employmentBasis: EmploymentBasis;
  pronoun: EmployeePronoun;
  employerName?: string;
  employerTitle?: string;
  jobTitle?: string;
  startDate?: string;
  companyPhone?: string;
  companyEmail?: string;
};

async function buildJobLetterForEmployee(input: JobLetterInput, companyId: string) {
  const employee = await loadEmployee(input.employeeId, companyId);
  const branding = await loadCompanyBranding(companyId);
  const startDate = input.startDate?.trim()
    ? parseDateOnly(input.startDate.trim())
    : employee.dateOfEngagement;

  return buildJobLetterHtml({
    companyName: branding.companyName,
    letterheadData: branding.letterheadData,
    businessLogoData: branding.businessLogoData,
    receiptLogoData: branding.receiptLogoData,
    companyStampData: branding.companyStampData,
    employeeName: `${employee.firstName} ${employee.lastName}`,
    role: input.jobTitle?.trim() || employee.role,
    idNumber: input.idNumber?.trim() || null,
    dateOfEngagement: startDate,
    employmentBasis: input.employmentBasis,
    pronoun: input.pronoun,
    salaryCents: toCents(Number(input.salary) || 0),
    frequency: input.frequency,
    employerName: input.employerName?.trim() || null,
    employerTitle: input.employerTitle?.trim() || null,
    companyPhone: input.companyPhone?.trim() || branding.companyPhone,
    companyEmail: input.companyEmail?.trim() || branding.companyEmail,
  });
}

function payForEntry(
  hours: number,
  hourlyRate: number,
  employeeRate: number,
  paymentAmount: number | null,
) {
  const rate = hourlyRate > 0 ? hourlyRate : employeeRate;
  if (rate > 0) return Math.round(hours * rate);
  return paymentAmount ?? 0;
}

type PayslipPeriodInput = {
  employeeId: string;
  periodStart: string;
  periodEnd: string;
  nisDeduction?: number;
  payeDeduction?: number;
};

async function buildPayslipForPeriod(input: PayslipPeriodInput, companyId: string) {
  const employee = await loadEmployee(input.employeeId, companyId);
  const branding = await loadCompanyBranding(companyId);

  const periodStart = parseDateOnly(input.periodStart);
  const periodEnd = endOfDay(parseDateOnly(input.periodEnd));
  if (periodEnd < periodStart) throw new Error("Period end must be on or after period start");

  const entries = await prisma.timeEntry.findMany({
    where: {
      employeeId: employee.id,
      clockOutAt: { not: null, gte: periodStart, lte: periodEnd },
    },
    orderBy: [{ clockInAt: "asc" }],
  });

  const lines: PayslipLine[] = entries.map((entry) => ({
    date: formatAppDate(entry.clockInAt || entry.date),
    hours: entry.hours,
    payCents: payForEntry(
      entry.hours,
      entry.hourlyRate,
      employee.hourlyRate,
      entry.paymentAmount,
    ),
  }));

  const hoursWorked = lines.reduce((s, l) => s + l.hours, 0);
  const grossPayCents = lines.reduce((s, l) => s + l.payCents, 0);
  const nisDeductionCents = toCents(Number(input.nisDeduction) || 0);
  const payeDeductionCents = toCents(Number(input.payeDeduction) || 0);
  const netPayCents = Math.max(0, grossPayCents - nisDeductionCents - payeDeductionCents);

  const documentHtml = buildPayslipHtml({
    companyName: branding.companyName,
    letterheadData: branding.letterheadData,
    businessLogoData: branding.businessLogoData,
    employeeName: `${employee.firstName} ${employee.lastName}`,
    role: employee.role,
    nisNumber: employee.nisNumber,
    payeNumber: employee.payeNumber,
    bankName: employee.bankName,
    bankAccountNumber: employee.bankAccountNumber,
    periodStart,
    periodEnd,
    lines,
    hoursWorked,
    grossPayCents,
    nisDeductionCents,
    payeDeductionCents,
  });

  return {
    employee,
    periodStart,
    periodEnd,
    documentHtml,
    hoursWorked,
    grossPayCents,
    nisDeductionCents,
    payeDeductionCents,
    netPayCents,
  };
}

export async function createEmployeePayslip(input: PayslipPeriodInput) {
  const { companyId } = await requireCompany();
  const built = await buildPayslipForPeriod(input, companyId);

  const payslip = await prisma.employeePayslip.create({
    data: {
      companyId,
      employeeId: built.employee.id,
      periodStart: built.periodStart,
      periodEnd: built.periodEnd,
      hoursWorked: built.hoursWorked,
      grossPay: built.grossPayCents,
      documentHtml: built.documentHtml,
    },
  });

  revalidatePath(`/employees/${built.employee.id}`);
  return {
    id: payslip.id,
    documentHtml: built.documentHtml,
    hoursWorked: built.hoursWorked,
    grossPayCents: built.grossPayCents,
    netPayCents: built.netPayCents,
  };
}

export async function emailEmployeeJobLetter(input: JobLetterInput & { toEmail: string }) {
  const { companyId } = await requireCompany();
  const to = input.toEmail.trim().toLowerCase();
  if (!isValidEmail(to)) return { error: "Enter a valid email address" };

  const employee = await loadEmployee(input.employeeId, companyId);
  const html = await buildJobLetterForEmployee(input, companyId);

  const result = await sendEmail({
    to,
    subject: `Employment confirmation — ${employee.firstName} ${employee.lastName}`,
    text: `Employment confirmation for ${employee.firstName} ${employee.lastName}. Open this email in an HTML-capable client to view the full letter.`,
    html,
  });

  if (!result.ok) return { error: result.error || "Could not send email" };
  return { ok: true as const, to };
}

export async function emailEmployeePayslip(input: { payslipId: string; toEmail: string }) {
  const { companyId } = await requireCompany();
  const to = input.toEmail.trim().toLowerCase();
  if (!isValidEmail(to)) return { error: "Enter a valid email address" };

  const payslip = await prisma.employeePayslip.findFirst({
    where: { id: input.payslipId, companyId },
    include: { employee: true },
  });
  if (!payslip) return { error: "Payslip not found" };

  const result = await sendEmail({
    to,
    subject: `Payslip — ${payslip.employee.firstName} ${payslip.employee.lastName} (${formatAppDate(payslip.periodStart)} – ${formatAppDate(payslip.periodEnd)})`,
    text: `Payslip for ${payslip.employee.firstName} ${payslip.employee.lastName}, ${formatAppDate(payslip.periodStart)} – ${formatAppDate(payslip.periodEnd)}. Open this email in an HTML-capable client to view the full payslip.`,
    html: payslip.documentHtml,
  });

  if (!result.ok) return { error: result.error || "Could not send email" };
  return { ok: true as const, to };
}

export async function previewEmployeeJobLetter(input: JobLetterInput) {
  const { companyId } = await requireCompany();
  const html = await buildJobLetterForEmployee(input, companyId);
  return { html };
}

export async function previewEmployeePayslip(input: PayslipPeriodInput) {
  const { companyId } = await requireCompany();
  const built = await buildPayslipForPeriod(input, companyId);
  return {
    html: built.documentHtml,
    hoursWorked: built.hoursWorked,
    grossPayCents: built.grossPayCents,
    netPayCents: built.netPayCents,
  };
}
