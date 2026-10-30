import { Suspense } from "react";
import { requireCompany } from "@/lib/company";
import { prisma } from "@/lib/prisma";
import { receiptHeaderText } from "@/lib/settings";
import {
  extractSingleMonth,
  fetchMonthlyIncomeStatement,
  incomeStatementSetupFromCompany,
  snapshotOpeningInventoryCents,
} from "@/lib/monthly-income-statement";
import { fetchBalanceSheet } from "@/lib/balance-sheet";
import { fetchBankLedger } from "@/lib/bank-ledger";
import {
  actualSpendingMix,
  planFromCompany,
  plannedAllocation,
} from "@/lib/money-mix";
import {
  appYearMonth,
  formatAppMonthYear,
  startOfAppMonth,
} from "@/lib/timezone";
import { PageHeader, Panel } from "@/components/ui";
import { FinancialReportsHub, type FinancialSection } from "@/components/FinancialReportsHub";
import { IncomeStatementSection } from "@/components/IncomeStatementSection";
import { IncomeStatementSetupForm } from "@/components/IncomeStatementSetupForm";
import { BalanceSheetTable } from "@/components/BalanceSheetTable";
import { BankSection } from "@/components/BankSection";
import { SupplyReferenceSection } from "@/components/SupplyReferenceSection";
import { EmployeeReferenceSection } from "@/components/EmployeeReferenceSection";
import { DEFERRED_PAYMENT_LABEL } from "@/lib/receivables";

export const dynamic = "force-dynamic";

function parseYear(value: string | undefined, fallback: number) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 2000 || n > 2100) return fallback;
  return Math.trunc(n);
}

function parseMonth(value: string | undefined, fallback: number) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1 || n > 12) return fallback;
  return Math.trunc(n);
}

function parseSection(value: string | undefined): FinancialSection | null {
  if (
    value === "income" ||
    value === "balance" ||
    value === "supply" ||
    value === "employee" ||
    value === "bank"
  ) {
    return value;
  }
  return null;
}

async function loadSupplyReference(companyId: string) {
  const [suppliers, purchases] = await Promise.all([
    prisma.supplier.findMany({
      where: { companyId },
      orderBy: { name: "asc" },
      include: { items: { select: { unitCost: true } } },
    }),
    prisma.supplierPurchase.findMany({
      where: {
        companyId,
        NOT: {
          OR: [
            { name: { contains: DEFERRED_PAYMENT_LABEL, mode: "insensitive" } },
            { notes: { contains: DEFERRED_PAYMENT_LABEL, mode: "insensitive" } },
          ],
        },
      },
      include: { supplier: { select: { name: true } } },
      orderBy: { purchasedAt: "desc" },
      take: 40,
    }),
  ]);

  const supplierRows = suppliers.map((s) => ({
    id: s.id,
    name: s.name,
    itemCount: s.items.length,
    catalogValueCents: s.items.reduce((sum, i) => sum + i.unitCost, 0),
  }));

  return {
    suppliers: supplierRows,
    recentPurchases: purchases.map((p) => ({
      id: p.id,
      name: p.name,
      supplierName: p.supplier.name,
      totalCost: p.totalCost,
      purchasedAt: p.purchasedAt,
    })),
    catalogValueCents: supplierRows.reduce((s, r) => s + r.catalogValueCents, 0),
    purchaseLogTotalCents: purchases.reduce((s, p) => s + p.totalCost, 0),
  };
}

async function loadEmployeeReference(companyId: string) {
  const now = new Date();
  const monthStart = startOfAppMonth(now);

  const [employees, payslips] = await Promise.all([
    prisma.employee.findMany({
      where: { companyId },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      include: {
        timeEntries: {
          where: { date: { gte: monthStart }, clockOutAt: { not: null } },
          select: { hours: true, overtimeHours: true, hourlyRate: true },
        },
        payslips: { select: { id: true } },
      },
    }),
    prisma.employeePayslip.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { employee: { select: { firstName: true, lastName: true } } },
    }),
  ]);

  const rows = employees.map((e) => {
    const hoursThisMonth = e.timeEntries.reduce(
      (s, t) => s + t.hours + t.overtimeHours * 1.5,
      0,
    );
    const rate = e.hourlyRate;
    const forecastPayCents = Math.round(hoursThisMonth * rate);
    return {
      id: e.id,
      name: `${e.firstName} ${e.lastName}`.trim(),
      role: e.role || "",
      hourlyRate: e.hourlyRate,
      active: e.active,
      hoursThisMonth,
      forecastPayCents,
      payslipCount: e.payslips.length,
    };
  });

  return {
    employees: rows,
    forecastPayCents: rows.reduce((s, r) => s + r.forecastPayCents, 0),
    hoursThisMonth: rows.reduce((s, r) => s + r.hoursThisMonth, 0),
    recentPayslips: payslips.map((p) => ({
      id: p.id,
      employeeName: `${p.employee.firstName} ${p.employee.lastName}`.trim(),
      periodStart: p.periodStart,
      periodEnd: p.periodEnd,
      grossPay: p.grossPay,
    })),
  };
}

export default async function FinancialReportsPage({
  searchParams,
}: {
  searchParams: Promise<{
    section?: string;
    year?: string;
    month?: string;
    view?: string;
    bankTab?: string;
  }>;
}) {
  const params = await searchParams;
  const { companyId, company } = await requireCompany();
  const businessName = receiptHeaderText(company);
  const section = parseSection(params.section);
  const setup = incomeStatementSetupFromCompany(company);

  const now = new Date();
  const nowParts = appYearMonth(now);
  const nowYear = nowParts?.year ?? now.getFullYear();
  const nowMonth = (nowParts?.monthIndex ?? now.getMonth()) + 1;
  const statementYear = parseYear(params.year, nowYear);
  const statementMonth = parseMonth(params.month, nowMonth);
  const years = Array.from({ length: 6 }, (_, i) => nowYear - i);
  if (!years.includes(statementYear)) years.unshift(statementYear);
  const startYear = setup ? appYearMonth(setup.startAt)?.year : null;
  const startMonth = setup ? (appYearMonth(setup.startAt)?.monthIndex ?? 0) + 1 : nowMonth;
  if (startYear && !years.includes(startYear)) years.push(startYear);
  years.sort((a, b) => b - a);

  const clampedMonth =
    setup && statementYear === startYear && statementMonth < startMonth
      ? startMonth
      : statementMonth;

  const yearlyStatement =
    section === "income" && setup
      ? await fetchMonthlyIncomeStatement(companyId, statementYear, businessName)
      : null;
  const monthlyStatement = yearlyStatement
    ? extractSingleMonth(yearlyStatement, clampedMonth - 1)
    : null;

  const setupPreview =
    section === "income" && !setup
      ? await snapshotOpeningInventoryCents(companyId, startOfAppMonth(now), now)
      : 0;

  const balanceSheet = section === "balance" ? await fetchBalanceSheet(companyId, businessName) : null;

  const bankLedger = section === "bank" ? await fetchBankLedger(companyId) : null;
  const moneyMixPlan = planFromCompany(company);
  const plannedSlices =
    bankLedger && section === "bank"
      ? plannedAllocation(Math.max(0, bankLedger.balance), moneyMixPlan)
      : [];
  const actualSlices = section === "bank" ? await actualSpendingMix(companyId) : [];

  const supplyRef = section === "supply" ? await loadSupplyReference(companyId) : null;
  const employeeRef = section === "employee" ? await loadEmployeeReference(companyId) : null;

  return (
    <div className="stack">
      <PageHeader
        title="Financial Reports"
        description="Accounting statements, plus Supply, Employee, and Bank for reference and forecasting."
      />

      <Panel style={{ padding: "1.25rem" }}>
        <Suspense fallback={<p className="muted">Loading…</p>}>
          <FinancialReportsHub activeSection={section}>
            {section === "income" && !setup ? (
              <IncomeStatementSetupForm
                startMonthLabel={formatAppMonthYear(startOfAppMonth(now))}
                openingInventoryCents={setupPreview}
              />
            ) : null}

            {section === "income" && setup && yearlyStatement && monthlyStatement ? (
              <IncomeStatementSection
                yearlyStatement={yearlyStatement}
                monthlyStatement={monthlyStatement}
                statementYear={statementYear}
                years={years}
                statementMonth={clampedMonth}
                startLabel={formatAppMonthYear(setup.startAt)}
                startYear={startYear ?? statementYear}
                startMonth={startMonth}
              />
            ) : null}

            {section === "balance" && balanceSheet ? (
              <BalanceSheetTable sheet={balanceSheet} />
            ) : null}

            {section === "supply" && supplyRef ? (
              <SupplyReferenceSection data={supplyRef} />
            ) : null}

            {section === "employee" && employeeRef ? (
              <EmployeeReferenceSection data={employeeRef} />
            ) : null}

            {section === "bank" && bankLedger ? (
              <BankSection
                businessName={company.name}
                ledger={bankLedger}
                plan={moneyMixPlan}
                plannedSlices={plannedSlices}
                actualSlices={actualSlices}
              />
            ) : null}
          </FinancialReportsHub>
        </Suspense>
      </Panel>
    </div>
  );
}
