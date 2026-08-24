import { PageHeader, Panel } from "@/components/ui";

export const dynamic = "force-dynamic";

export default function AiAssistantPage() {
  return (
    <div className="stack">
      <PageHeader
        title="AI Assistant"
        description="Ask questions about your business data and get guided help in the app."
      />
      <Panel style={{ padding: "1.25rem" }}>
        <p className="muted" style={{ margin: 0, lineHeight: 1.5 }}>
          The AI Assistant is coming next. This page is available in the sidebar so you can navigate
          here during development.
        </p>
      </Panel>
    </div>
  );
}
