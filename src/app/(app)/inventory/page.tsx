import { prisma } from "@/lib/prisma";
import { requireCompany } from "@/lib/company";
import { ensureDefaultInventoryCategories } from "@/lib/catalog";
import { resolveRegisterAccess } from "@/lib/register-access";
import { readActiveRegisterIdFromCookies } from "@/lib/register-access-server";
import { parseInventoryViewMode } from "@/lib/settings";
import { PageHeader } from "@/components/ui";
import { InventoryClient } from "@/components/InventoryClient";

export const dynamic = "force-dynamic";

function parseOptions(raw: string): string[] {
  try {
    const v = JSON.parse(raw || "[]");
    return Array.isArray(v) ? v.map((o) => String(o)) : [];
  } catch {
    return [];
  }
}

export default async function InventoryPage() {
  const { company, companyId } = await requireCompany();
  await ensureDefaultInventoryCategories(companyId);

  const registers = await prisma.posRegister.findMany({
    where: { companyId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  const activeRegisterId = await readActiveRegisterIdFromCookies();
  const access = resolveRegisterAccess(registers, activeRegisterId);

  const [products, categories, variableNames] = await Promise.all([
    prisma.product.findMany({
      where: { companyId },
      orderBy: { name: "asc" },
      include: {
        variables: { orderBy: { sortOrder: "asc" } },
      },
    }),
    prisma.inventoryCategory.findMany({
      where: { companyId },
      orderBy: { name: "asc" },
    }),
    prisma.variableNameCatalog.findMany({
      where: { companyId },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="stack">
      <PageHeader
        title={access.canManageInventory ? "Inventory" : "Stock levels"}
        description={
          access.canManageInventory
            ? "Opening + purchases − usage = current stock. Manage categories in Settings → Categories."
            : "View-only stock levels for this register. Inventory edits require POS register 1."
        }
      />
      <InventoryClient
        canManage={access.canManageInventory}
        viewMode={parseInventoryViewMode(company.inventoryViewMode)}
        categoryColors={Object.fromEntries(
          categories.map((c) => [c.name.toLowerCase(), c.color]),
        )}
        variableNames={variableNames.map((v) => v.name)}
        categories={categories.map((c) => c.name)}
        initialProducts={products.map((p) => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          category: p.category,
          unit: p.unit,
          unitCost: p.unitCost,
          unitPrice: p.unitPrice,
          variablePrice: p.variablePrice,
          stockQty: p.stockQty,
          minStock: p.minStock,
          trackStock: p.trackStock,
          isService: p.isService,
          imageData: p.imageData,
          variables: p.variables.map((v) => ({
            name: v.name,
            options: parseOptions(v.options),
          })),
        }))}
      />
    </div>
  );
}
