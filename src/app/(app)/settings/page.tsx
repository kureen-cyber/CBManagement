import { Suspense } from "react";
import { getCompany } from "@/lib/company";
import {
  parseHomeLayout,
  parseLanguage,
  parseTheme,
} from "@/lib/settings";
import { PageHeader } from "@/components/ui";
import { SettingsPanel } from "@/components/SettingsPanel";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const company = await getCompany();

  return (
    <div className="stack">
      <PageHeader
        title="Settings"
        description="Theme, home layout, language, VAT, and receipt printers."
      />
      <Suspense fallback={<div className="muted">Loading settings…</div>}>
        <SettingsPanel
          theme={parseTheme(company.theme)}
          language={parseLanguage(company.language)}
          homeLayout={parseHomeLayout(company.homeLayout)}
          vatRate={company.vatRate}
          receiptPrinting={company.receiptPrinting}
          printerName={company.printerName}
        />
      </Suspense>
    </div>
  );
}
