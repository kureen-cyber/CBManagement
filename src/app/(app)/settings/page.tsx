import { Suspense } from "react";
import { requireCompany } from "@/lib/company";
import { prisma } from "@/lib/prisma";
import {
  parseHomeLayout,
  parseLanguage,
  parseTheme,
} from "@/lib/settings";
import { parsePlanTier } from "@/lib/tier";
import { PageHeader } from "@/components/ui";
import { SettingsPanel } from "@/components/SettingsPanel";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { company, companyId } = await requireCompany();
  const posRegisters = await prisma.posRegister.findMany({
    where: { companyId },
    orderBy: { createdAt: "asc" },
    take: 4,
  });

  return (
    <div className="stack">
      <PageHeader
        title="Settings"
        description="Theme, receipts, POS registers, VAT, and printers."
      />
      <Suspense fallback={<div className="muted">Loading settings…</div>}>
        <SettingsPanel
          businessName={company.name}
          theme={parseTheme(company.theme)}
          language={parseLanguage(company.language)}
          homeLayout={parseHomeLayout(company.homeLayout)}
          taxEnabled={company.taxEnabled}
          vatRate={company.vatRate}
          receiptPrinting={company.receiptPrinting}
          printerName={company.printerName}
          receiptLogoData={company.receiptLogoData}
          receiptHeader={company.receiptHeader}
          receiptFooter={company.receiptFooter}
          receiptShowCustomer={company.receiptShowCustomer}
          receiptShowComments={company.receiptShowComments}
          receiptLanguage={parseLanguage(company.receiptLanguage)}
          planTier={parsePlanTier(company.planTier)}
          posRegisters={posRegisters.map((r) => ({ id: r.id, name: r.name }))}
        />
      </Suspense>
    </div>
  );
}
