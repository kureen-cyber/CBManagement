import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireCompany } from "@/lib/company";
import { PageHeader, Panel } from "@/components/ui";
import { SupplierDetailClient } from "@/components/SupplierDetailClient";

export const dynamic = "force-dynamic";

export default async function SupplierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { companyId } = await requireCompany();
  const supplier = await prisma.supplier.findFirst({
    where: { id, companyId },
    include: {
      items: { orderBy: { name: "asc" } },
      purchases: { orderBy: { purchasedAt: "desc" }, take: 100 },
    },
  });
  if (!supplier) notFound();

  return (
    <div className="stack">
      <PageHeader
        title={supplier.name}
        description="Supply cost database for quotations, plus a log of what you buy."
        actions={
          <Link className="btn btn-secondary" href="/suppliers">
            All suppliers
          </Link>
        }
      />

      <Panel style={{ padding: "1.25rem" }}>
        <div className="form-grid" style={{ marginBottom: 0 }}>
          <div>
            <div className="muted" style={{ fontSize: "0.78rem" }}>
              Address
            </div>
            <div>{supplier.address || "—"}</div>
          </div>
          <div>
            <div className="muted" style={{ fontSize: "0.78rem" }}>
              Contact
            </div>
            <div>{supplier.phone || "—"}</div>
          </div>
          <div>
            <div className="muted" style={{ fontSize: "0.78rem" }}>
              Email
            </div>
            <div>{supplier.email || "—"}</div>
          </div>
          <div>
            <div className="muted" style={{ fontSize: "0.78rem" }}>
              Sales rep
            </div>
            <div>{supplier.salesRep || "—"}</div>
          </div>
        </div>
        {supplier.notes ? (
          <p className="muted" style={{ marginTop: "1rem", fontSize: "0.9rem" }}>
            {supplier.notes}
          </p>
        ) : null}
      </Panel>

      <SupplierDetailClient
        supplierId={supplier.id}
        items={supplier.items.map((i) => ({
          id: i.id,
          name: i.name,
          supplyType: i.supplyType,
          unit: i.unit,
          unitCost: i.unitCost,
          notes: i.notes,
        }))}
        purchases={supplier.purchases.map((p) => ({
          id: p.id,
          name: p.name,
          unit: p.unit,
          quantity: p.quantity,
          unitCost: p.unitCost,
          totalCost: p.totalCost,
          purchasedAt: p.purchasedAt.toISOString(),
          notes: p.notes,
          supplierItemId: p.supplierItemId,
        }))}
      />
    </div>
  );
}
