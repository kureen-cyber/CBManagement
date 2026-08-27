import Link from "next/link";
import { requireCompany } from "@/lib/company";
import { isFreeTier, parsePlanTier } from "@/lib/tier";
import { readDateRangeFromSearchParams } from "@/lib/date-range";
import { fetchPeriodSummary } from "@/lib/period-summary";
import { fetchMonthlyIncomeStatement } from "@/lib/monthly-income-statement";
import { receiptHeaderText } from "@/lib/settings";
import { PageHeader, Panel } from "@/components/ui";
import { PeriodSelector } from "@/components/PeriodSelector";
import { PeriodSummaryCards } from "@/components/PeriodSummaryCards";
import { MonthlyIncomeStatementTable } from "@/components/MonthlyIncomeStatement";
import { IncomeStatementYearSelector } from "@/components/IncomeStatementYearSelector";

export const dynamic = "force-dynamic";

function parseYear(value: string | undefined, fallback: number) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 2000 || n > 2100) return fallback;
  return Math.trunc(n);
}

export default async function FinancialReportsPage({
  searchParams,
}: {
  searchParams: Promise<{
    period?: string;
    month?: string;
    from?: string;
    to?: string;
    year?: string;
  }>;
}) {
  const params = await searchParams;
  const { companyId, company } = await requireCompany();
  const planTier = parsePlanTier(company.planTier);
  const range = await readDateRangeFromSearchParams(Promise.resolve(params), planTier);
  const summary = await fetchPeriodSummary(companyId, range.start, range.end);

  const nowYear = new Date().getFullYear();
  const statementYear = parseYear(params.year, range.start.getFullYear() || nowYear);
  const years = Array.from({ length: 6 }, (_, i) => nowYear - i);
  if (!years.includes(statementYear)) years.unshift(statementYear);

  const statement = await fetchMonthlyIncomeStatement(
    companyId,
    statementYear,
    receiptHeaderText(company),
  );

  return (
    <div className="stack">
      <PageHeader
        title="Financial Reports"
        description={`${range.label} · profit &amp; loss and cash position.`}
      />
      <Panel style={{ padding: "1.25rem" }}>
        <PeriodSelector
          basePath="/financial-reports"
          range={range}
          isFree={isFreeTier(planTier)}
        />
      </Panel>
      <Panel style={{ padding: "1.25rem" }}>
        <h3 style={{ marginTop: 0 }}>Profit &amp; loss summary</h3>
        <PeriodSummaryCards summary={summary} variant="financial" />
        <p className="muted" style={{ marginTop: "1rem", marginBottom: 0, fontSize: "0.85rem" }}>
          For detailed POS breakdowns, item sales, and charts, open{" "}
          <Link href="/reports">Reports</Link> with the same period selected.
        </p>
      </Panel>

      <Panel style={{ padding: "1.25rem" }}>
        <div
          className="row"
          style={{ justifyContent: "space-between", alignItems: "flex-end", marginBottom: "0.85rem" }}
        >
          <h3 style={{ margin: 0 }}>Monthly income statement</h3>
          <IncomeStatementYearSelector year={statementYear} years={years} />
        </div>
        <MonthlyIncomeStatementTable statement={statement} />
      </Panel>
    </div>
  );
}
