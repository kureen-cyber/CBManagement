import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import { InventoryClient } from "@/components/InventoryClient";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const [suppliers, products] = await Promise.all([
    prisma.supplier.findMany({ orderBy: { name: "asc" } }),
    prisma.product.findMany({
      orderBy: { name: "asc" },
      include: { supplier: true },
    }),
  ]);

  return (
    <div className="stack">
      <PageHeader title="Inventory" description="Opening + purchases − usage = current stock." />
      <InventoryClient
        suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
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
