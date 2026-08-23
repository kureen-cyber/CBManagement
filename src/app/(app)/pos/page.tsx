import { prisma } from "@/lib/prisma";
import { formatTTD } from "@/lib/money";
import { requireCompany } from "@/lib/company";
import { getBusinessType } from "@/lib/session-business";
import { isRetailOnly } from "@/lib/business-type";
import {
  ensureDefaultInventoryCategories,
  ensureDefaultPaymentTypes,
} from "@/lib/catalog";
import { ensureStoresForCompany } from "@/lib/store";
import {
  FREE_TIER_MAX_TRANSACTION_DAYS,
  isFreeRetailTier,
  parsePlanTier,
  receiptVisibleSince,
} from "@/lib/tier";
import { resolveRegisterAccess } from "@/lib/register-access";
import {
  readActiveRegisterIdFromCookies,
  readActiveStoreIdFromCookies,
} from "@/lib/register-access-server";
import { PosTerminal } from "@/components/PosTerminal";
import { PageHeader, Panel } from "@/components/ui";
import Link from "next/link";

export const dynamic = "force-dynamic";

function parseOptions(raw: string): string[] {
  try {
    const v = JSON.parse(raw || "[]");
    return Array.isArray(v) ? v.map((o) => String(o)) : [];
  } catch {
    return [];
  }
}

export default async function PosPage() {
  const { companyId, company } = await requireCompany();
  await ensureDefaultPaymentTypes(companyId);
  const stores = await ensureStoresForCompany(companyId);
  const cookieStoreId = await readActiveStoreIdFromCookies();
  const activeStore = stores.find((s) => s.id === cookieStoreId) || stores[0] || null;
  await ensureDefaultInventoryCategories(companyId, activeStore?.id);

  const businessType = await getBusinessType();
  const retailMode = isRetailOnly(businessType) || businessType === "BOTH";
  const planTier = parsePlanTier(company.planTier);
  const since = receiptVisibleSince(planTier);

  const [
    products,
    customers,
    sales,
    posRegisters,
    paymentTypes,
    categories,
    openTickets,
    discounts,
  ] = await Promise.all([
    prisma.product.findMany({
      where: { companyId },
      orderBy: { name: "asc" },
      include: { variables: { orderBy: { sortOrder: "asc" } } },
    }),
    prisma.customer.findMany({ where: { companyId }, orderBy: { name: "asc" } }),
    prisma.sale.findMany({
      where: {
        companyId,
        status: "COMPLETED",
        ...(since ? { soldAt: { gte: since } } : {}),
      },
      orderBy: { soldAt: "desc" },
      take: 12,
      include: { customer: true, lines: true, posRegister: true },
    }),
    prisma.posRegister.findMany({
      where: {
        companyId,
        ...(activeStore ? { storeId: activeStore.id } : {}),
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    prisma.paymentType.findMany({
      where: { companyId, active: true },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    }),
    prisma.inventoryCategory.findMany({
      where: {
        companyId,
        ...(activeStore ? { storeId: activeStore.id } : {}),
      },
      orderBy: { name: "asc" },
    }),
    company.featureOpenTickets
      ? prisma.sale.findMany({
          where: { companyId, status: "OPEN" },
          orderBy: { updatedAt: "desc" },
          include: { customer: true, lines: true },
          take: 50,
        })
      : Promise.resolve([]),
    prisma.discountPreset.findMany({
      where: { companyId, active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
  ]);

  const activeRegisterId = await readActiveRegisterIdFromCookies();
  const access = resolveRegisterAccess(posRegisters, activeRegisterId);

  return (
    <div className="stack">
      <PageHeader
        title={isRetailOnly(businessType) ? "POS Terminal" : "Point of Sale"}
        description={
          [
            activeStore ? `Store: ${activeStore.name}.` : null,
            isRetailOnly(businessType)
              ? `Ring up sales on a named register. Free Retail keeps receipts for ${FREE_TIER_MAX_TRANSACTION_DAYS} days.`
              : "Ring up products and services. Stock updates automatically.",
          ]
            .filter(Boolean)
            .join(" ")
        }
        actions={
          access.canManageInventory ? (
            <a className="btn btn-secondary" href="/api/inventory/export">
              Export stock CSV
            </a>
          ) : undefined
        }
      />

      {isFreeRetailTier(planTier) && posRegisters.length === 0 ? (
        <div className="info-banner">
          Name your POS registers in{" "}
          <Link href="/settings?tab=pos">Settings → POS</Link> before ringing sales
          (up to 2 sign-ins).
        </div>
      ) : null}

      <PosTerminal
        retailMode={retailMode && access.canManageInventory}
        requireRegister={isFreeRetailTier(planTier)}
        openTicketsEnabled={company.featureOpenTickets}
        outOfStockWarn={company.featureOutOfStockWarn}
        canVoidTickets={access.canVoidTickets}
        canManageInventory={access.canManageInventory}
        initialRegisterId={access.registerId || ""}
        honeyPersonsEnabled={company.receiptHoneyPersons === true}
        registers={posRegisters.map((r) => ({ id: r.id, name: r.name }))}
        paymentTypes={paymentTypes.map((p) => ({ code: p.code, label: p.label }))}
        categories={categories.map((c) => c.name)}
        discounts={discounts.map((d) => ({
          id: d.id,
          name: d.name,
          percent: d.percent,
        }))}
        openTickets={openTickets.map((t) => ({
          id: t.id,
          number: t.number,
          method: t.method,
          customerId: t.customerId,
          customerName: t.customer?.name ?? null,
          posRegisterId: t.posRegisterId,
          total: t.total,
          updatedAt: t.updatedAt.toISOString(),
          lines: t.lines.map((l) => ({
            productId: l.productId,
            description: l.description,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
          })),
        }))}
        products={products.map((p) => ({
          id: p.id,
          name: p.name,
          category: p.category,
          unit: p.unit,
          unitPrice: p.unitPrice,
          variablePrice: p.variablePrice,
          stockQty: p.stockQty,
          trackStock: p.trackStock,
          isService: p.isService,
          variables: p.variables.map((v) => ({
            name: v.name,
            options: parseOptions(v.options),
          })),
        }))}
        customers={customers.map((c) => ({ id: c.id, name: c.name }))}
      />

      <Panel className="table-wrap">
        {isFreeRetailTier(planTier) ? (
          <p className="muted" style={{ margin: "0 0 0.75rem", fontSize: "0.85rem" }}>
            Showing receipts from the last {FREE_TIER_MAX_TRANSACTION_DAYS} days only.
          </p>
        ) : null}
        <table className="data">
          <thead>
            <tr>
              <th>Recent receipts</th>
              <th>Register</th>
              <th>Customer</th>
              <th>Method</th>
              <th>Items</th>
              <th>Total</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sales.map((s) => (
              <tr key={s.id}>
                <td>
                  <strong>{s.number}</strong>
                  <div className="muted" style={{ fontSize: "0.8rem" }}>
                    {s.soldAt.toLocaleString("en-TT")}
                    {s.isRefund ? " · Refund" : ""}
                  </div>
                </td>
                <td>{s.posRegister?.name ?? "—"}</td>
                <td>{s.customer?.name ?? "Walk-in"}</td>
                <td>{s.method}</td>
                <td className="muted">{s.lines.length}</td>
                <td className="money">{formatTTD(s.total)}</td>
                <td>
                  <Link className="btn btn-secondary btn-sm" href={`/pos/receipt/${s.id}`}>
                    Receipt
                  </Link>
                </td>
              </tr>
            ))}
            {sales.length === 0 ? (
              <tr>
                <td colSpan={7} className="muted">
                  No POS sales yet — complete one above.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
