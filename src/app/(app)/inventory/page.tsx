import { prisma } from "@/lib/prisma";
import { requireCompany } from "@/lib/company";
import { ensureDefaultInventoryCategories } from "@/lib/catalog";
import { PageHeader } from "@/components/ui";
import { InventoryClient } from "@/components/InventoryClient";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const { companyId } = await requireCompany();
  await ensureDefaultInventoryCategories(companyId);

  const [suppliers, products, categories] = await Promise.all([
    prisma.supplier.findMany({ where: { companyId }, orderBy: { name: "asc" } }),
    prisma.product.findMany({
      where: { companyId },
      orderBy: { name: "asc" },
      include: { supplier: true },
    }),
    prisma.inventoryCategory.findMany({
      where: { companyId },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="stack">
      <PageHeader
        title="Inventory"
        description="Opening + purchases − usage = current stock. Manage categories in Settings → Categories."
      />
      <InventoryClient
        suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
        categories={categories.map((c) => c.name)}
        initialProducts={products.map((p) => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          category: p.category,
          unit: p.unit,
          unitCost: p.unitCost,
          unitPrice: p.unitPrice,
          stockQty: p.stockQty,
          minStock: p.minStock,
          trackStock: p.trackStock,
          isService: p.isService,
          supplierName: p.supplier?.name ?? null,
        }))}
      />
    </div>
  );
}
