import Link from "next/link";
import { requireCompany } from "@/lib/company";
import { isFreeTier, parsePlanTier } from "@/lib/tier";
import { readDateRangeFromSearchParams } from "@/lib/date-range";
import { fetchPeriodSummary } from "@/lib/period-summary";
import { PageHeader, Panel } from "@/components/ui";
import { PeriodSelector } from "@/components/PeriodSelector";
import { PeriodSummaryCards } from "@/components/PeriodSummaryCards";

export const dynamic = "force-dynamic";

export default async function FinancialReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; month?: string; from?: string; to?: string }>;
}) {
  const { companyId, company } = await requireCompany();
  const planTier = parsePlanTier(company.planTier);
  const range = await readDateRangeFromSearchParams(searchParams, planTier);
  const summary = await fetchPeriodSummary(companyId, range.start, range.end);

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
    </div>
  );
}
