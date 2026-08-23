"use server";

import { prisma } from "@/lib/prisma";
import { requireCompany } from "@/lib/company";
import { sendEmail } from "@/lib/email";
import { receiptFooterText, receiptHeaderText, resolveBusinessLogo } from "@/lib/settings";
import {
  buildInvoiceEmail,
  buildPaymentEmail,
  buildQuotationEmail,
  buildSaleReceiptEmail,
  isValidEmail,
} from "@/lib/document-email";
import {
  FREE_TIER_MAX_TRANSACTION_DAYS,
  parsePlanTier,
  receiptVisibleSince,
} from "@/lib/tier";

function normalizeTo(email: string) {
  return String(email || "").trim().toLowerCase();
}

export async function emailPosReceipt(input: { saleId: string; toEmail: string }) {
  const { companyId, company } = await requireCompany();
  const to = normalizeTo(input.toEmail);
  if (!isValidEmail(to)) return { error: "Enter a valid email address" };

  const sale = await prisma.sale.findFirst({
    where: { id: input.saleId, companyId },
    include: { customer: true, lines: true },
  });
  if (!sale) return { error: "Receipt not found" };

  const since = receiptVisibleSince(parsePlanTier(company.planTier));
  if (since && sale.soldAt < since) {
    return {
      error: `This receipt is past the ${FREE_TIER_MAX_TRANSACTION_DAYS}-day visibility window`,
    };
  }

  const payload = buildSaleReceiptEmail({
    header: receiptHeaderText(company),
    footer: receiptFooterText(company),
    number: sale.number,
    dateLabel: sale.soldAt.toLocaleString("en-TT"),
    customerName: sale.customer?.name ?? "Walk-in",
    method: sale.method,
    lines: sale.lines.map((l) => ({
      description: l.description,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      lineTotal: l.lineTotal,
    })),
    subtotal: sale.subtotal,
    discountAmount: sale.discountAmount,
    discountPercent: sale.discountPercent,
    taxAmount: sale.taxAmount,
    total: sale.total,
    honeyPersons: company.receiptHoneyPersons ? sale.honeyPersons : null,
    apiaryNumber: company.receiptShowApiaryNumber ? company.receiptApiaryNumber : null,
    oprNumber: company.receiptShowOprNumber ? company.receiptOprNumber : null,
    isRefund: sale.isRefund,
  });

  const result = await sendEmail({ to, ...payload });
  if (!result.ok) return { error: result.error || "Could not send email" };
  if (result.skipped) {
    return {
      error:
        "Email is not configured on the server (RESEND_API_KEY). Add it in Vercel environment variables.",
    };
  }
  return { ok: true as const, to };
}

export async function emailQuotation(input: {
  quotationId: string;
  toEmail: string;
  includeNotesInCustomerView?: boolean;
}) {
  const { companyId, company } = await requireCompany();
  const to = normalizeTo(input.toEmail);
  if (!isValidEmail(to)) return { error: "Enter a valid email address" };

  const quote = await prisma.quotation.findFirst({
    where: { id: input.quotationId, companyId },
    include: { customer: true, lines: true },
  });
  if (!quote) return { error: "Quotation not found" };

  const { quotationClientLines } = await import("@/lib/quotation-pricing");
  const payload = buildQuotationEmail({
    header: receiptHeaderText(company),
    footer: receiptFooterText(company),
    number: quote.number,
    dateLabel: quote.createdAt.toLocaleDateString("en-TT"),
    customerName: quote.customer.name,
    title: quote.title,
    lines: quotationClientLines(quote),
    total: quote.total,
    notes: input.includeNotesInCustomerView ? quote.notes : null,
    logoData: resolveBusinessLogo(company),
    letterheadData: company.letterheadData,
  });

  const result = await sendEmail({ to, ...payload });
  if (!result.ok) return { error: result.error || "Could not send email" };
  if (result.skipped) {
    return {
      error:
        "Email is not configured on the server (RESEND_API_KEY). Add it in Vercel environment variables.",
    };
  }
  return { ok: true as const, to };
}

export async function emailInvoice(input: { invoiceId: string; toEmail: string }) {
  const { companyId, company } = await requireCompany();
  const to = normalizeTo(input.toEmail);
  if (!isValidEmail(to)) return { error: "Enter a valid email address" };

  const invoice = await prisma.invoice.findFirst({
    where: { id: input.invoiceId, companyId },
    include: { customer: true, job: true, lines: true },
  });
  if (!invoice) return { error: "Invoice not found" };

  const payload = buildInvoiceEmail({
    header: receiptHeaderText(company),
    footer: receiptFooterText(company),
    number: invoice.number,
    issueDate: invoice.issueDate.toLocaleDateString("en-TT"),
    dueDate: invoice.dueDate?.toLocaleDateString("en-TT") ?? null,
    customerName: invoice.customer.name,
    jobNumber: invoice.job?.number ?? null,
    lines: invoice.lines.map((l) => ({
      description: l.description,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      lineTotal: l.lineTotal,
    })),
    subtotal: invoice.subtotal,
    taxAmount: invoice.taxAmount,
    total: invoice.total,
    amountPaid: invoice.amountPaid,
    notes: invoice.notes,
    logoData: resolveBusinessLogo(company),
    letterheadData: company.letterheadData,
  });

  const result = await sendEmail({ to, ...payload });
  if (!result.ok) return { error: result.error || "Could not send email" };
  if (result.skipped) {
    return {
      error:
        "Email is not configured on the server (RESEND_API_KEY). Add it in Vercel environment variables.",
    };
  }
  return { ok: true as const, to };
}

export async function emailPaymentReceipt(input: { paymentId: string; toEmail: string }) {
  const { companyId, company } = await requireCompany();
  const to = normalizeTo(input.toEmail);
  if (!isValidEmail(to)) return { error: "Enter a valid email address" };

  const payment = await prisma.payment.findFirst({
    where: { id: input.paymentId, companyId },
    include: { customer: true, invoice: true },
  });
  if (!payment) return { error: "Payment not found" };

  const payload = buildPaymentEmail({
    header: receiptHeaderText(company),
    footer: receiptFooterText(company),
    dateLabel: payment.paidAt.toLocaleString("en-TT"),
    customerName: payment.customer.name,
    invoiceNumber: payment.invoice?.number ?? null,
    method: payment.method,
    reference: payment.reference,
    amount: payment.amount,
    notes: payment.notes,
  });

  const result = await sendEmail({ to, ...payload });
  if (!result.ok) return { error: result.error || "Could not send email" };
  if (result.skipped) {
    return {
      error:
        "Email is not configured on the server (RESEND_API_KEY). Add it in Vercel environment variables.",
    };
  }
  return { ok: true as const, to };
}
