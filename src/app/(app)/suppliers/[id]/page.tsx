import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatTTD } from "@/lib/money";
import { requireCompany } from "@/lib/company";
import { SUPPLY_UNITS } from "@/lib/constants";
import { createSupplierItem, deleteSupplierItem } from "@/app/actions";
import { PageHeader, Panel } from "@/components/ui";

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
    },
  });
  if (!supplier) notFound();

  return (
    <div className="stack">
      <PageHeader
        title={supplier.name}
        description="Procurement catalog — record what you buy from this supplier."
        actions={
          <Link className="btn btn-secondary" href="/suppliers">
            All suppliers
          </Link>
        }
      />

      <Panel style={{ padding: "1.25rem" }}>
        <div className="form-grid" style={{ marginBottom: 0 }}>
          <div>
            <div className="muted" style={{ fontSize: "0.78rem" }}>Address</div>
            <div>{supplier.address || "—"}</div>
          </div>
          <div>
            <div className="muted" style={{ fontSize: "0.78rem" }}>Contact</div>
            <div>{supplier.phone || "—"}</div>
          </div>
          <div>
            <div className="muted" style={{ fontSize: "0.78rem" }}>Email</div>
            <div>{supplier.email || "—"}</div>
          </div>
          <div>
            <div className="muted" style={{ fontSize: "0.78rem" }}>Sales rep</div>
            <div>{supplier.salesRep || "—"}</div>
          </div>
        </div>
        {supplier.notes ? (
          <p className="muted" style={{ marginTop: "1rem", fontSize: "0.9rem" }}>
            {supplier.notes}
          </p>
        ) : null}
      </Panel>

      <Panel style={{ padding: "1.25rem" }}>
        <h2 style={{ marginTop: 0, fontSize: "1.15rem" }}>Add supply item</h2>
        <p className="muted" style={{ margin: "0 0 1rem", fontSize: "0.88rem" }}>
          Record something you procure from this supplier — name, cost, and how it is sold (each,
          by weight, case, etc.).
        </p>
        <form action={createSupplierItem} className="form-grid" autoComplete="off">
          <input type="hidden" name="supplierId" value={supplier.id} />
          <label className="field">
            Item name
            <input name="name" required placeholder="e.g. Rice 25kg bag" autoComplete="off" />
          </label>
          <label className="field">
            Cost per unit ($)
            <input
              name="unitCost"
              type="number"
              step="0.01"
              min="0"
              required
              placeholder="0.00"
            />
          </label>
          <label className="field">
            Sold / stocked by
            <input
              name="unit"
              list="supply-unit-suggestions"
              defaultValue="each"
              placeholder="each, kg, case…"
              autoComplete="off"
            />
            <datalist id="supply-unit-suggestions">
              {SUPPLY_UNITS.map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
          </label>
          <label className="field full">
            Notes
            <textarea name="notes" rows={2} placeholder="Optional" autoComplete="off" />
          </label>
          <div className="full">
            <button className="btn btn-primary" type="submit">Add item</button>
          </div>
        </form>
      </Panel>

      <Panel className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Item</th>
              <th>Unit</th>
              <th>Cost</th>
              <th>Notes</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {supplier.items.map((item) => (
              <tr key={item.id}>
                <td><strong>{item.name}</strong></td>
                <td className="muted">{item.unit}</td>
                <td className="money">{formatTTD(item.unitCost)}</td>
                <td className="muted" style={{ fontSize: "0.85rem" }}>{item.notes || "—"}</td>
                <td>
                  <form action={deleteSupplierItem}>
                    <input type="hidden" name="id" value={item.id} />
                    <input type="hidden" name="supplierId" value={supplier.id} />
                    <button className="btn btn-secondary btn-sm" type="submit">Remove</button>
                  </form>
                </td>
              </tr>
            ))}
            {supplier.items.length === 0 ? (
              <tr>
                <td colSpan={5} className="muted">
                  No items yet — use Add supply item above.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
