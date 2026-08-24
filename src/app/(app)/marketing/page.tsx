import { PageHeader, Panel } from "@/components/ui";

export const dynamic = "force-dynamic";

export default function MarketingPage() {
  return (
    <div className="stack">
      <PageHeader
        title="Marketing"
        description="Campaigns, promotions, and customer outreach for your business."
      />
      <Panel style={{ padding: "1.25rem" }}>
        <p className="muted" style={{ margin: 0, lineHeight: 1.5 }}>
          Marketing tools are coming next. This page is available in the sidebar so you can navigate
          here during development.
        </p>
      </Panel>
    </div>
  );
}
