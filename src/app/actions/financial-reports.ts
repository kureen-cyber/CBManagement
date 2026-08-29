"use server";

import { revalidatePath } from "next/cache";
import { requireCompany } from "@/lib/company";
import { sendEmail } from "@/lib/email";
import { isValidEmail } from "@/lib/document-email";
import { formatTTD } from "@/lib/money";
import {
  extractSingleMonth,
  fetchMonthlyIncomeStatement,
  INCOME_STATEMENT_MONTHS,
} from "@/lib/monthly-income-statement";
import { receiptHeaderText } from "@/lib/settings";
import { prisma } from "@/lib/prisma";
import type { MoneyMixPlan } from "@/lib/money-mix";

function buildIncomeStatementHtml(opts: {
  businessName: string;
  monthLabel: string;
  year: number;
  rows: { label: string; amount: number; kind: string }[];
}) {
  const bodyRows = opts.rows
    .map(
      (r) =>
        `<tr>
          <td style="padding:8px 0;border-bottom:1px solid #e5e7eb">${r.label}</td>
          <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;text-align:right">${formatTTD(r.amount)}</td>
        </tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html><body style="font-family:Arial,sans-serif;color:#111;max-width:640px;margin:0 auto;padding:24px">
  <h2 style="margin:0 0 4px">${opts.businessName}</h2>
  <p style="margin:0 0 16px;color:#6b7280">Income Statement — ${opts.monthLabel} ${opts.year}</p>
  <table style="width:100%;border-collapse:collapse">${bodyRows}</table>
</body></html>`;
}

export async function emailIncomeStatement(input: {
  year: number;
  month: number;
  toEmail: string;
}) {
  const { companyId, company } = await requireCompany();
  const to = String(input.toEmail || "").trim().toLowerCase();
  if (!isValidEmail(to)) return { error: "Enter a valid email address" };

  const monthIndex = Math.max(0, Math.min(11, input.month - 1));
  const yearly = await fetchMonthlyIncomeStatement(
    companyId,
    input.year,
    receiptHeaderText(company),
  );
  const single = extractSingleMonth(yearly, monthIndex);
  const html = buildIncomeStatementHtml({
    businessName: single.businessName,
    monthLabel: INCOME_STATEMENT_MONTHS[monthIndex] ?? single.monthLabel,
    year: single.year,
    rows: single.rows.map((r) => ({ label: r.label, amount: r.amount, kind: r.kind })),
  });

  const sent = await sendEmail({
    to,
    subject: `Income Statement — ${single.monthLabel} ${single.year}`,
    html,
    text: `Income statement for ${single.monthLabel} ${single.year} from ${single.businessName}`,
  });
  if (!sent.ok) return { error: sent.error || "Could not send email" };

  return { ok: true as const, to };
}

export async function saveMoneyMixPlan(plan: MoneyMixPlan) {
  const { companyId } = await requireCompany();
  const total =
    plan.expenses + plan.materials + plan.growth + plan.reserve + plan.drawings;
  if (Math.abs(total - 100) > 0.01) {
    return { error: "Percentages must add up to 100%" };
  }

  await prisma.company.update({
    where: { id: companyId },
    data: {
      moneyMixExpensesPct: plan.expenses,
      moneyMixMaterialsPct: plan.materials,
      moneyMixGrowthPct: plan.growth,
      moneyMixReservePct: plan.reserve,
      moneyMixDrawingsPct: plan.drawings,
    },
  });

  revalidatePath("/financial-reports");
  return { ok: true as const };
}
