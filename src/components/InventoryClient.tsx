"use client";

import { FormEvent, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createProduct } from "@/app/actions";
import { formatTTD } from "@/lib/money";
import { PRODUCT_CATEGORIES } from "@/lib/constants";
import type { InventoryViewMode } from "@/lib/settings";
import { AdjustStockModal } from "@/components/AdjustStockModal";
import { CategoryInput } from "@/components/CategoryInput";
import { EditProductModal } from "@/components/EditProductModal";
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
  variablePrice?: boolean;
  stockQty: number;
  minStock: number;
  trackStock: boolean;
  isService: boolean;
  imageData?: string | null;
  variables?: { name: string; options: string[] }[];
};

function categoryColor(
  colors: Record<string, string | null | undefined>,
  name: string,
): string {
  return colors[name.toLowerCase()] || "#5C6B6E";
}

function CategoryBadge({
  name,
  colors,
}: {
  name: string;
  colors: Record<string, string | null | undefined>;
}) {
  const color = categoryColor(colors, name);
  return (
    <span
      className="category-badge"
      style={{
        color,
        background: `${color}18`,
        borderColor: `${color}40`,
      }}
    >
      <span className="category-dot" style={{ background: color }} />
      {name}
    </span>
  );
}

function ProductThumb({ imageData, alt }: { imageData?: string | null; alt: string }) {
  if (imageData) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={imageData} alt={alt} className="inventory-thumb" />
    );
  }
  return <div className="inventory-thumb inventory-thumb-placeholder">No photo</div>;
}

type VarDraft = { name: string; options: string };

export function InventoryClient({
  initialProducts,
  categories = [],
  categoryColors = {},
  variableNames = [],
  viewMode = "card",
  canManage = true,
}: {
  initialProducts: InventoryProduct[];
  categories?: string[];
  categoryColors?: Record<string, string | null | undefined>;
  variableNames?: string[];
  viewMode?: InventoryViewMode;
  canManage?: boolean;
}) {
  const router = useRouter();
  const [products, setProducts] = useState(initialProducts);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [isService, setIsService] = useState(false);
  const [variablePrice, setVariablePrice] = useState(false);
  const [vars, setVars] = useState<VarDraft[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  useEffect(() => {
    setProducts(initialProducts);
  }, [initialProducts]);

  function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canManage) return;
    const form = e.currentTarget;
    const fd = new FormData(form);
    const payload = vars
      .map((v) => ({
        name: v.name.trim(),
        options: v.options
          .split(",")
          .map((o) => o.trim())
          .filter(Boolean),
      }))
      .filter((v) => v.name && v.options.length);
    fd.set("variablesJson", JSON.stringify(payload));
    if (variablePrice) fd.set("variablePrice", "on");

    setMessage(null);
    startTransition(async () => {
      const created = await createProduct(fd);
      if (created && "error" in created && created.error) {
        setMessage(created.error);
        return;
      }
      if (created && "id" in created && created.id) {
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
              variablePrice: created.variablePrice,
              stockQty: created.stockQty,
              minStock: created.minStock,
              trackStock: created.trackStock,
              isService: created.isService,
              imageData: created.imageData ?? null,
              variables: created.variables,
            },
          ].sort((a, b) => a.name.localeCompare(b.name));
        });
        setMessage(`Saved “${created.name}”`);
        setIsService(false);
        setVariablePrice(false);
        setVars([]);
        setImagePreview(null);
        form.reset();
      }
      router.refresh();
    });
  }

  function onDeleted(id: string) {
    setProducts((prev) => prev.filter((p) => p.id !== id));
    router.refresh();
  }

  function onSaved(updated: InventoryProduct) {
    setProducts((prev) =>
      prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)).sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
    );
    router.refresh();
  }

  function onAdjusted(id: string, stockQty: number) {
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, stockQty } : p)));
    router.refresh();
  }

  const editingProduct = editingId ? products.find((p) => p.id === editingId) : null;
  const adjustingProduct = adjustingId ? products.find((p) => p.id === adjustingId) : null;

  return (
    <div className="stack">
      {canManage ? (
        <Panel style={{ padding: "1.25rem" }}>
          <form onSubmit={onCreate} className="form-grid" encType="multipart/form-data">
            <label className="field">
              Name
              <input name="name" required placeholder="Item or fixed-price service" />
            </label>
            <label className="field">
              SKU
              <input name="sku" placeholder="Auto-generated if blank" />
              <span className="muted" style={{ fontSize: "0.8rem" }}>
                Leave blank to auto-generate (e.g. SKU-0001)
              </span>
            </label>
            <label className="field">
              Category
              <CategoryInput
                name="category"
                defaultValue={categories[0] || "General"}
                suggestions={
                  categories.length
                    ? categories
                    : [...PRODUCT_CATEGORIES, ...products.map((p) => p.category)]
                }
                listId="inventory-category-suggestions"
              />
              {categories.length ? (
                <span className="muted" style={{ fontSize: "0.78rem" }}>
                  Category colours are set in Settings → POS → Categories
                </span>
              ) : null}
            </label>
            <label className="field full">
              Item photo (optional)
              <input
                name="image"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  setImagePreview(file ? URL.createObjectURL(file) : null);
                }}
              />
              <span className="muted" style={{ fontSize: "0.8rem" }}>
                PNG, JPEG, WebP, or GIF · max 500KB
              </span>
            </label>
            {imagePreview ? (
              <div className="full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="inventory-thumb"
                  style={{ width: 120, height: 120 }}
                />
              </div>
            ) : null}
            <label className="field">
              Unit
              <input name="unit" defaultValue="each" />
            </label>
            <label className="field">
              Unit cost
              <input name="unitCost" type="number" step="0.01" defaultValue="0" />
            </label>
            <label className="field">
              Unit price (fixed)
              <input
                name="unitPrice"
                type="number"
                step="0.01"
                defaultValue="0"
                disabled={variablePrice}
                placeholder={variablePrice ? "Entered at POS" : "0.00"}
              />
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

            <label className="choice-card full">
              <input
                type="checkbox"
                checked={variablePrice}
                onChange={(e) => setVariablePrice(e.target.checked)}
              />
              <span>
                <strong>Variable price at POS</strong>
                <span className="muted" style={{ display: "block", fontSize: "0.82rem" }}>
                  Cashier enters the price when selling (leave fixed price empty or check this)
                </span>
              </span>
            </label>

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

            <div className="full stack" style={{ gap: "0.65rem" }}>
              <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                <strong>Variables</strong>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setVars((prev) => [...prev, { name: "", options: "" }])}
                >
                  Add variable
                </button>
              </div>
              <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
                Example: name <em>Colour</em>, options <em>Red, Blue, Black</em>. Names you save
                appear in the dropdown next time.
              </p>
              {vars.map((v, idx) => (
                <div key={idx} className="row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
                  <label className="field" style={{ flex: "1 1 140px" }}>
                    Variable name
                    <input
                      list="variable-name-catalog"
                      value={v.name}
                      onChange={(e) =>
                        setVars((prev) =>
                          prev.map((row, i) => (i === idx ? { ...row, name: e.target.value } : row)),
                        )
                      }
                      placeholder="Colour"
                    />
                  </label>
                  <label className="field" style={{ flex: "2 1 220px" }}>
                    Options (comma-separated)
                    <input
                      value={v.options}
                      onChange={(e) =>
                        setVars((prev) =>
                          prev.map((row, i) =>
                            i === idx ? { ...row, options: e.target.value } : row,
                          ),
                        )
                      }
                      placeholder="Red, Blue, Black"
                    />
                  </label>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setVars((prev) => prev.filter((_, i) => i !== idx))}
                  >
                    Remove
                  </button>
                </div>
              ))}
              <datalist id="variable-name-catalog">
                {variableNames.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
            </div>

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
      ) : (
        <div className="info-banner">Stock levels only — inventory changes require POS register 1.</div>
      )}

      <div className={viewMode === "list" ? "inventory-list" : "inventory-grid"}>
        {products.map((p) => {
          const low = p.trackStock && !p.isService && p.stockQty <= p.minStock;
          if (viewMode === "list") {
            return (
              <div key={p.id} className="inventory-list-row panel inventory-card">
                {canManage ? (
                  <ItemMenu
                    productId={p.id}
                    productName={p.name}
                    onDeleted={onDeleted}
                    onEdit={setEditingId}
                    onAdjustStock={setAdjustingId}
                    canAdjustStock={!p.isService && p.trackStock}
                  />
                ) : null}
                <ProductThumb imageData={p.imageData} alt={p.name} />
                <div>
                  <div className="name">{p.name}</div>
                  <div className="muted" style={{ fontSize: "0.8rem", marginTop: "0.25rem" }}>
                    {p.sku ? `${p.sku} · ` : ""}
                    {p.isService ? "Service · " : ""}
                    {p.variablePrice ? "Variable price" : ""}
                  </div>
                  <div style={{ marginTop: "0.35rem" }}>
                    <CategoryBadge name={p.category} colors={categoryColors} />
                  </div>
                </div>
                <div>
                  <div className="muted" style={{ fontSize: "0.72rem" }}>Stock</div>
                  <strong>{p.isService || !p.trackStock ? "—" : p.stockQty}</strong>
                </div>
                <div>
                  <div className="muted" style={{ fontSize: "0.72rem" }}>Price</div>
                  <strong className="money">
                    {p.variablePrice ? "At POS" : formatTTD(p.unitPrice)}
                  </strong>
                </div>
                <div>
                  <div className="muted" style={{ fontSize: "0.72rem" }}>Cost</div>
                  <strong className="money">{formatTTD(p.unitCost)}</strong>
                </div>
                <div>
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
          }

          return (
            <div key={p.id} className="inventory-card panel">
              {canManage ? (
                <ItemMenu
                  productId={p.id}
                  productName={p.name}
                  onDeleted={onDeleted}
                  onEdit={setEditingId}
                  onAdjustStock={setAdjustingId}
                  canAdjustStock={!p.isService && p.trackStock}
                />
              ) : null}
              <ProductThumb imageData={p.imageData} alt={p.name} />
              <div className="name">{p.name}</div>
              <div style={{ marginTop: "0.35rem" }}>
                <CategoryBadge name={p.category} colors={categoryColors} />
              </div>
              <div className="muted" style={{ fontSize: "0.8rem", marginTop: "0.35rem" }}>
                {p.sku ? `${p.sku} · ` : ""}
                {p.isService ? "Service · " : ""}
                {p.variablePrice ? "Variable price" : ""}
              </div>
              {p.variables?.length ? (
                <div className="muted" style={{ fontSize: "0.78rem", marginTop: "0.35rem" }}>
                  {p.variables.map((v) => `${v.name}: ${v.options.join(", ")}`).join(" · ")}
                </div>
              ) : null}
              <div className="row" style={{ marginTop: "0.75rem", justifyContent: "space-between" }}>
                <div>
                  <div className="muted" style={{ fontSize: "0.72rem" }}>Stock</div>
                  <strong>{p.isService || !p.trackStock ? "—" : p.stockQty}</strong>
                </div>
                <div>
                  <div className="muted" style={{ fontSize: "0.72rem" }}>Price</div>
                  <strong className="money">
                    {p.variablePrice ? "At POS" : formatTTD(p.unitPrice)}
                  </strong>
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

      {editingProduct ? (
        <EditProductModal
          product={editingProduct}
          categories={categories}
          variableNames={variableNames}
          allCategories={products.map((p) => p.category)}
          onClose={() => setEditingId(null)}
          onSaved={onSaved}
        />
      ) : null}
      {adjustingProduct ? (
        <AdjustStockModal
          product={adjustingProduct}
          onClose={() => setAdjustingId(null)}
          onAdjusted={onAdjusted}
        />
      ) : null}
    </div>
  );
}
