"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createProduct } from "@/app/actions";
import { formatTTD } from "@/lib/money";
import { PRODUCT_CATEGORIES } from "@/lib/constants";
import { CategoryInput } from "@/components/CategoryInput";
import { ItemMenu } from "@/components/ItemMenu";
import { Panel } from "@/components/ui";

export type InventoryProduct = {
  id: string;
  name: string;
  sku: string | null;
  category: string;
  unit: string;
  unitCost: number;
  unitPrice: number;
  stockQty: number;
  minStock: number;
  trackStock: boolean;
  isService: boolean;
  supplierName?: string | null;
};

export function InventoryClient({
  initialProducts,
  suppliers,
}: {
  initialProducts: InventoryProduct[];
  suppliers: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [products, setProducts] = useState(initialProducts);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [isService, setIsService] = useState(false);

  useEffect(() => {
    setProducts(initialProducts);
  }, [initialProducts]);

  function onCreate(formData: FormData) {
    setMessage(null);
    startTransition(async () => {
      const created = await createProduct(formData);
      if (created?.id) {
        setProducts((prev) => {
          if (prev.some((p) => p.id === created.id)) return prev;
          return [
            ...prev,
            {
              id: created.id,
              name: created.name,
              sku: created.sku,
              category: created.category,
              unit: created.unit,
              unitCost: created.unitCost,
              unitPrice: created.unitPrice,
              stockQty: created.stockQty,
              minStock: created.minStock,
              trackStock: created.trackStock,
              isService: created.isService,
              supplierName: null,
            },
          ].sort((a, b) => a.name.localeCompare(b.name));
        });
        setMessage(`Saved “${created.name}”`);
        setIsService(false);
      }
      router.refresh();
    });
  }

  function onDeleted(id: string) {
    setProducts((prev) => prev.filter((p) => p.id !== id));
    router.refresh();
  }

  return (
    <div className="stack">
      <Panel style={{ padding: "1.25rem" }}>
        <form action={onCreate} className="form-grid">
          <label className="field">
            Name
            <input name="name" required placeholder="Item or fixed-price service" />
          </label>
          <label className="field">
            SKU
            <input name="sku" />
          </label>
          <label className="field">
            Category
            <CategoryInput
              name="category"
              defaultValue="General"
              suggestions={[...PRODUCT_CATEGORIES, ...products.map((p) => p.category)]}
              listId="inventory-category-suggestions"
            />
          </label>
          <label className="field">
            Unit
            <input name="unit" defaultValue="each" />
          </label>
          <label className="field">
            Supplier
            <select name="supplierId" defaultValue="">
              <option value="">None</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Unit cost
            <input name="unitCost" type="number" step="0.01" defaultValue="0" />
          </label>
          <label className="field">
            Unit price (fixed)
            <input name="unitPrice" type="number" step="0.01" defaultValue="0" />
          </label>
          {!isService ? (
            <>
              <label className="field">
                Opening stock
                <input name="stockQty" type="number" step="0.01" defaultValue="0" />
              </label>
              <label className="field">
                Min stock
                <input name="minStock" type="number" step="0.01" defaultValue="10" />
              </label>
            </>
          ) : null}
          <label className="field" style={{ flexDirection: "row", alignItems: "center", gap: "0.5rem" }}>
            <input
              name="isService"
              type="checkbox"
              checked={isService}
              onChange={(e) => setIsService(e.target.checked)}
            />{" "}
            Service (fixed price — also shows on POS)
          </label>
          {!isService ? (
            <label className="field" style={{ flexDirection: "row", alignItems: "center", gap: "0.5rem" }}>
              <input name="trackStock" type="checkbox" defaultChecked /> Track stock
            </label>
          ) : null}
          <div className="full">
            <button className="btn btn-primary" type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save item"}
            </button>
          </div>
        </form>
        {message ? (
          <div className="badge badge-ok" style={{ marginTop: "0.75rem" }}>
            {message}
          </div>
        ) : null}
      </Panel>

      <div className="inventory-grid">
        {products.map((p) => {
          const low = p.trackStock && !p.isService && p.stockQty <= p.minStock;
          return (
            <div key={p.id} className="inventory-card panel">
              <ItemMenu productId={p.id} productName={p.name} onDeleted={onDeleted} />
              <div className="name">{p.name}</div>
              <div className="muted" style={{ fontSize: "0.8rem" }}>
                {p.category}
                {p.sku ? ` · ${p.sku}` : ""}
                {p.isService ? " · Service" : ""}
                {p.supplierName ? ` · ${p.supplierName}` : ""}
              </div>
              <div className="row" style={{ marginTop: "0.75rem", justifyContent: "space-between" }}>
                <div>
                  <div className="muted" style={{ fontSize: "0.72rem" }}>Stock</div>
                  <strong>{p.isService || !p.trackStock ? "—" : p.stockQty}</strong>
                </div>
                <div>
                  <div className="muted" style={{ fontSize: "0.72rem" }}>Price</div>
                  <strong className="money">{formatTTD(p.unitPrice)}</strong>
                </div>
                <div>
                  <div className="muted" style={{ fontSize: "0.72rem" }}>Cost</div>
                  <strong className="money">{formatTTD(p.unitCost)}</strong>
                </div>
              </div>
              <div style={{ marginTop: "0.75rem" }}>
                {p.isService ? (
                  <span className="badge badge-info">Service</span>
                ) : low ? (
                  <span className="badge badge-warn">Low stock</span>
                ) : (
                  <span className="badge badge-ok">OK</span>
                )}
              </div>
            </div>
          );
        })}
        {products.length === 0 ? <div className="muted">No inventory items yet.</div> : null}
      </div>
    </div>
  );
}
