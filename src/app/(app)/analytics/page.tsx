import { PageHeader, Panel } from "@/components/ui";

export const dynamic = "force-dynamic";

export default function AnalyticsPage() {
  return (
    <div className="stack">
      <PageHeader
        title="Analytics"
        description="Trends and performance insights across sales, jobs, and customers."
      />
      <Panel style={{ padding: "1.25rem" }}>
        <p className="muted" style={{ margin: 0, lineHeight: 1.5 }}>
          Analytics is coming next. This page is available in the sidebar so you can navigate here
          during development.
        </p>
      </Panel>
    </div>
  );
}
