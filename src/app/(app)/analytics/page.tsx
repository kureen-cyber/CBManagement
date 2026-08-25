import { requireCompany } from "@/lib/company";
import { isFreeTier, parsePlanTier } from "@/lib/tier";
import { readDateRangeFromSearchParams } from "@/lib/date-range";
import { fetchPeriodSummary } from "@/lib/period-summary";
import { fetchCustomerLoyalty } from "@/lib/customer-loyalty";
import { PageHeader, Panel } from "@/components/ui";
import { PeriodSelector } from "@/components/PeriodSelector";
import { PeriodSummaryCards } from "@/components/PeriodSummaryCards";
import { CustomerLoyaltyChart } from "@/components/CustomerLoyaltyChart";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; month?: string; from?: string; to?: string }>;
}) {
  const { companyId, company } = await requireCompany();
  const planTier = parsePlanTier(company.planTier);
  const range = await readDateRangeFromSearchParams(searchParams, planTier);
  const [summary, loyalty] = await Promise.all([
    fetchPeriodSummary(companyId, range.start, range.end),
    fetchCustomerLoyalty(companyId, range.start, range.end),
  ]);

  return (
    <div className="stack">
      <PageHeader
        title="Analytics"
        description={`${range.label} · trends across sales, jobs, and customers.`}
      />
      <Panel style={{ padding: "1.25rem" }}>
        <PeriodSelector basePath="/analytics" range={range} isFree={isFreeTier(planTier)} />
      </Panel>
      <Panel style={{ padding: "1.25rem" }}>
        <CustomerLoyaltyChart data={loyalty} />
      </Panel>
      <Panel style={{ padding: "1.25rem" }}>
        <h3 style={{ marginTop: 0 }}>Period summary</h3>
        <PeriodSummaryCards summary={summary} variant="analytics" />
      </Panel>
    </div>
  );
}
