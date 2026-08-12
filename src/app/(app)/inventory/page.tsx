import { prisma } from "@/lib/prisma";
import { formatTTD } from "@/lib/money";
import { createProduct } from "@/app/actions";
import { PageHeader, Panel } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const [suppliers, products] = await Promise.all([
    prisma.supplier.findMany({ orderBy: { name: "asc" } }),
    prisma.product.findMany({ orderBy: { name: "asc" }, include: { supplier: true } }),
  ]);

  return (
    <div className="stack">
      <PageHeader title="Inventory" description="Opening + purchases − usage = current stock." />
      <Panel style={{ padding: "1.25rem" }}>
        <form action={createProduct} className="form-grid">
          <label className="field">Name<input name="name" required /></label>
          <label className="field">SKU<input name="sku" /></label>
          <label className="field">Unit<input name="unit" defaultValue="each" /></label>
          <label className="field">Supplier
            <select name="supplierId" defaultValue="">
              <option value="">None</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label className="field">Unit cost<input name="unitCost" type="number" step="0.01" defaultValue="0" /></label>
          <label className="field">Unit price<input name="unitPrice" type="number" step="0.01" defaultValue="0" /></label>
          <label className="field">Opening stock<input name="stockQty" type="number" step="0.01" defaultValue="0" /></label>
          <label className="field">Min stock<input name="minStock" type="number" step="0.01" defaultValue="10" /></label>
          <label className="field" style={{ flexDirection: "row", alignItems: "center", gap: "0.5rem" }}>
            <input name="trackStock" type="checkbox" defaultChecked /> Track stock
          </label>
          <label className="field" style={{ flexDirection: "row", alignItems: "center", gap: "0.5rem" }}>
            <input name="isService" type="checkbox" /> Service (no stock)
          </label>
          <div className="full"><button className="btn btn-primary" type="submit">Save item</button></div>
        </form>
      </Panel>
      <Panel className="table-wrap">
        <table className="data">
          <thead><tr><th>Item</th><th>Stock</th><th>Min</th><th>Cost</th><th>Price</th><th>Status</th></tr></thead>
          <tbody>
            {products.map((p) => {
              const low = p.trackStock && !p.isService && p.stockQty <= p.minStock;
              return (
                <tr key={p.id}>
                  <td><strong>{p.name}</strong><div className="muted" style={{ fontSize: "0.8rem" }}>{p.sku || (p.isService ? "Service" : "")}</div></td>
                  <td>{p.isService || !p.trackStock ? "—" : p.stockQty}</td>
                  <td>{p.isService || !p.trackStock ? "—" : p.minStock}</td>
                  <td className="money">{formatTTD(p.unitCost)}</td>
                  <td className="money">{formatTTD(p.unitPrice)}</td>
                  <td>{low ? <span className="badge badge-warn">Low stock</span> : p.isService ? <span className="badge badge-info">Service</span> : <span className="badge badge-ok">OK</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
