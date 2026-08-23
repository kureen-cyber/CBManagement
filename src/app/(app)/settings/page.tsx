import { Suspense } from "react";
import { requireCompany } from "@/lib/company";
import { prisma } from "@/lib/prisma";
import {
  parseHomeLayout,
  parseInventoryViewMode,
  parseLanguage,
  parseTheme,
} from "@/lib/settings";
import { parsePlanTier } from "@/lib/tier";
import {
  ensureDefaultInventoryCategories,
  ensureDefaultPaymentTypes,
} from "@/lib/catalog";
import { ensureStoresForCompany } from "@/lib/store";
import { resolveRegisterAccess } from "@/lib/register-access";
import {
  readActiveRegisterIdFromCookies,
  readActiveStoreIdFromCookies,
} from "@/lib/register-access-server";
import { PageHeader } from "@/components/ui";
import { SettingsPanel } from "@/components/SettingsPanel";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { company, companyId } = await requireCompany();
  await ensureDefaultPaymentTypes(companyId);
  const stores = await ensureStoresForCompany(companyId);
  const cookieStoreId = await readActiveStoreIdFromCookies();
  const activeStore =
    stores.find((s) => s.id === cookieStoreId) || stores[0] || null;
  await ensureDefaultInventoryCategories(companyId, activeStore?.id);

  const [posRegisters, paymentTypes, inventoryCategories, discountPresets] =
    await Promise.all([
      prisma.posRegister.findMany({
        where: { companyId },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
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

  const storeRegisters = posRegisters.filter((r) => r.storeId === activeStore?.id);
  const activeRegisterId = await readActiveRegisterIdFromCookies();
  const access = resolveRegisterAccess(storeRegisters, activeRegisterId);

  return (
    <div className="stack">
      <PageHeader
        title="Settings"
        description="Theme, receipts, features, payment types, discounts, printers, and POS stores."
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
          businessLogoData={company.businessLogoData}
          letterheadData={company.letterheadData}
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
          stores={stores.map((s) => ({
            id: s.id,
            name: s.name,
            inventoryViewMode: parseInventoryViewMode(s.inventoryViewMode),
          }))}
          activeStoreId={activeStore?.id ?? null}
          inventoryCategories={inventoryCategories.map((c) => ({
            id: c.id,
            name: c.name,
            color: c.color,
            storeId: c.storeId,
          }))}
          discountPresets={discountPresets.map((d) => ({
            id: d.id,
            name: d.name,
            percent: d.percent,
            active: d.active,
          }))}
          canEditDiscounts={access.canEditDiscounts}
          planTier={parsePlanTier(company.planTier)}
          posRegisters={posRegisters.map((r) => ({
            id: r.id,
            name: r.name,
            storeId: r.storeId,
          }))}
        />
      </Suspense>
    </div>
  );
}
