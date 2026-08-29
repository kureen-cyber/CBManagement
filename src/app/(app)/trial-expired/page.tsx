import Link from "next/link";
import { requireCompany } from "@/lib/company";
import { formatAppDate } from "@/lib/timezone";
import { PageHeader, Panel } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function TrialExpiredPage() {
  const { company } = await requireCompany({ allowExpiredTrial: true });
  const endedOn = company.trialEndsAt ? formatAppDate(company.trialEndsAt) : null;

  return (
    <div className="stack">
      <PageHeader
        title="Trial ended"
        description="Your 30-day free trial has finished."
      />
      <Panel style={{ padding: "1.5rem", maxWidth: "36rem" }}>
        <p style={{ margin: "0 0 1rem", lineHeight: 1.55 }}>
          {endedOn
            ? `Your free access ended on ${endedOn}. Subscribe to keep using Complete Business Management.`
            : "Your free trial has ended. Subscribe to keep using Complete Business Management."}
        </p>
        <div className="row" style={{ gap: "0.75rem" }}>
          <Link className="btn btn-primary" href="/settings">
            View plan &amp; settings
          </Link>
          <a className="btn btn-secondary" href="mailto:support@cbmanagement.app">
            Contact us
          </a>
        </div>
      </Panel>
    </div>
  );
}
