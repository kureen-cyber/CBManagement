import { Suspense } from "react";
import { requireCompany } from "@/lib/company";
import { prisma } from "@/lib/prisma";
import {
  parseHomeLayout,
  parseLanguage,
  parseTheme,
} from "@/lib/settings";
import { parsePlanTier } from "@/lib/tier";
import {
  ensureDefaultInventoryCategories,
  ensureDefaultPaymentTypes,
} from "@/lib/catalog";
import { resolveRegisterAccess } from "@/lib/register-access";
import { readActiveRegisterIdFromCookies } from "@/lib/register-access-server";
import { PageHeader } from "@/components/ui";
import { SettingsPanel } from "@/components/SettingsPanel";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { company, companyId } = await requireCompany();
  await ensureDefaultPaymentTypes(companyId);
  await ensureDefaultInventoryCategories(companyId);

  const [posRegisters, paymentTypes, inventoryCategories, discountPresets] =
    await Promise.all([
      prisma.posRegister.findMany({
        where: { companyId },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        take: 4,
      }),
      prisma.paymentType.findMany({
        where: { companyId },
        orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
      }),
      prisma.inventoryCategory.findMany({
        where: { companyId },
        orderBy: { name: "asc" },
      }),
      prisma.discountPreset.findMany({
        where: { companyId },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
    ]);

  const activeRegisterId = await readActiveRegisterIdFromCookies();
  const access = resolveRegisterAccess(posRegisters, activeRegisterId);

  return (
    <div className="stack">
      <PageHeader
        title="Settings"
        description="Theme, receipts, features, payment types, categories, discounts, and printers."
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
          receiptHoneyPersons={company.receiptHoneyPersons}
          receiptShowApiaryNumber={company.receiptShowApiaryNumber}
          receiptApiaryNumber={company.receiptApiaryNumber}
          receiptShowOprNumber={company.receiptShowOprNumber}
          receiptOprNumber={company.receiptOprNumber}
          receiptLanguage={parseLanguage(company.receiptLanguage)}
          featureOpenTickets={company.featureOpenTickets}
          featureLowStockEmail={company.featureLowStockEmail}
          featureOutOfStockWarn={company.featureOutOfStockWarn}
          paymentTypes={paymentTypes.map((p) => ({
            id: p.id,
            code: p.code,
            label: p.label,
            active: p.active,
          }))}
          inventoryCategories={inventoryCategories.map((c) => ({
            id: c.id,
            name: c.name,
          }))}
          discountPresets={discountPresets.map((d) => ({
            id: d.id,
            name: d.name,
            percent: d.percent,
            active: d.active,
          }))}
          canEditDiscounts={access.canEditDiscounts}
          planTier={parsePlanTier(company.planTier)}
          posRegisters={posRegisters.map((r) => ({ id: r.id, name: r.name }))}
        />
      </Suspense>
    </div>
  );
}
