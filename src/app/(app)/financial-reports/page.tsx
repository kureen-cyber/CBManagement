import { Suspense } from "react";
import { requireCompany } from "@/lib/company";
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
  if (value === "income" || value === "balance" || value === "bank") return value;
  return null;
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
  const monthlyStatement =
    yearlyStatement
      ? extractSingleMonth(yearlyStatement, clampedMonth - 1)
      : null;

  const setupPreview =
    section === "income" && !setup
      ? await snapshotOpeningInventoryCents(
          companyId,
          startOfAppMonth(now),
          now,
        )
      : 0;

  const balanceSheet = section === "balance" ? await fetchBalanceSheet(companyId, businessName) : null;

  const bankLedger = section === "bank" ? await fetchBankLedger(companyId) : null;
  const moneyMixPlan = planFromCompany(company);
  const plannedSlices =
    bankLedger && section === "bank"
      ? plannedAllocation(Math.max(0, bankLedger.balance), moneyMixPlan)
      : [];
  const actualSlices = section === "bank" ? await actualSpendingMix(companyId) : [];

  return (
    <div className="stack">
      <PageHeader
        title="Financial Reports"
        description="Income statement, balance sheet, and bank position."
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
