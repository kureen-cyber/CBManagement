import { Suspense } from "react";
import { requireCompany } from "@/lib/company";
import { receiptHeaderText } from "@/lib/settings";
import {
  extractSingleMonth,
  fetchMonthlyIncomeStatement,
} from "@/lib/monthly-income-statement";
import { fetchBalanceSheet } from "@/lib/balance-sheet";
import { fetchBankLedger } from "@/lib/bank-ledger";
import {
  actualSpendingMix,
  planFromCompany,
  plannedAllocation,
} from "@/lib/money-mix";
import { PageHeader, Panel } from "@/components/ui";
import { FinancialReportsHub, type FinancialSection } from "@/components/FinancialReportsHub";
import { IncomeStatementSection } from "@/components/IncomeStatementSection";
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

  const nowYear = new Date().getFullYear();
  const statementYear = parseYear(params.year, nowYear);
  const statementMonth = parseMonth(params.month, new Date().getMonth() + 1);
  const years = Array.from({ length: 6 }, (_, i) => nowYear - i);
  if (!years.includes(statementYear)) years.unshift(statementYear);

  const yearlyStatement =
    section === "income"
      ? await fetchMonthlyIncomeStatement(companyId, statementYear, businessName)
      : null;
  const monthlyStatement =
    yearlyStatement
      ? extractSingleMonth(yearlyStatement, statementMonth - 1)
      : null;

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
            {section === "income" && yearlyStatement && monthlyStatement ? (
              <IncomeStatementSection
                yearlyStatement={yearlyStatement}
                monthlyStatement={monthlyStatement}
                statementYear={statementYear}
                years={years}
                statementMonth={statementMonth}
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
