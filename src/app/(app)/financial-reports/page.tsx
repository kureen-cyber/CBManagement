import { PageHeader, Panel } from "@/components/ui";

export const dynamic = "force-dynamic";

export default function FinancialReportsPage() {
  return (
    <div className="stack">
      <PageHeader
        title="Financial Reports"
        description="Profit &amp; loss, cash position, and formal financial summaries."
      />
      <Panel style={{ padding: "1.25rem" }}>
        <p className="muted" style={{ margin: 0, lineHeight: 1.5 }}>
          Financial reports are coming next. This page is available in the sidebar so you can
          navigate here during development.
        </p>
      </Panel>
    </div>
  );
}
