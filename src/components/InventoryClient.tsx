"use client";

import { FormEvent, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createProduct } from "@/app/actions";
import { formatTTD } from "@/lib/money";
import { PRODUCT_CATEGORIES } from "@/lib/constants";
import type { InventoryViewMode } from "@/lib/settings";
import {
  isOptionLowStock,
  resolveOptionUnitCost,
  resolveOptionUnitPrice,
  type VariableOption,
} from "@/lib/product-variables";
import { AdjustStockModal } from "@/components/AdjustStockModal";
import { CategoryInput } from "@/components/CategoryInput";
import { EditProductModal } from "@/components/EditProductModal";
import { ItemMenu } from "@/components/ItemMenu";
import {
  sumDraftStock,
  VariableOptionsEditor,
  type VarDraft,
} from "@/components/VariableOptionsEditor";
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
  variables?: { name: string; options: VariableOption[] }[];
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

function marginLabel(cost: number | null, price: number | null): string {
  if (cost == null || price == null || price <= 0) return "—";
  const pct = ((price - cost) / price) * 100;
  return `${pct.toFixed(1)}%`;
}

function VariantTable({
  variables,
  unit,
  unitPrice,
  unitCost,
  variablePrice,
  productMinStock,
  highlightRows = false,
}: {
  variables: { name: string; options: VariableOption[] }[];
  unit: string;
  unitPrice: number;
  unitCost: number;
  variablePrice?: boolean;
  productMinStock: number;
  /** Emphasize each variant row (list view). */
  highlightRows?: boolean;
}) {
  const first = variables[0];
  if (!first?.options.length) return null;
  return (
    <div className="table-wrap inventory-variant-table">
      <table className="data inventory-variant-data" style={{ fontSize: "0.78rem" }}>
        <thead>
          <tr>
            <th>{first.name}</th>
            <th>Price</th>
            <th>Cost</th>
            <th>Margin %</th>
            <th>In stock</th>
          </tr>
        </thead>
        <tbody>
          {first.options.map((o) => {
            const cost = resolveOptionUnitCost(o, unitCost);
            const price = resolveOptionUnitPrice(o, unitPrice, Boolean(variablePrice));
            const costCents = cost > 0 ? cost : null;
            const isOut = o.qty <= 0;
            const isLow = !isOut && isOptionLowStock(o, productMinStock);
            const rowClass = highlightRows
              ? isOut
                ? "variant-row variant-row-out"
                : isLow
                  ? "variant-row variant-row-low"
                  : "variant-row"
              : undefined;
            return (
              <tr key={o.label} className={rowClass}>
                <td>
                  <strong>{o.label}</strong>
                </td>
                <td className="money">{price != null ? formatTTD(price) : "At POS"}</td>
                <td className="money">{costCents != null ? formatTTD(costCents) : "—"}</td>
                <td>{marginLabel(costCents, price)}</td>
                <td>
                  <div className="inventory-variant-stock">
                    <strong>
                      {o.qty} {unit}
                    </strong>
                    {isOut ? (
                      <span className="badge badge-danger">Out of stock</span>
                    ) : isLow ? (
                      <span className="badge badge-warn">Low stock</span>
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Always-open variant table for card view. */
function OptionStockSelect({
  variables,
  unit,
  unitPrice,
  unitCost,
  variablePrice,
  productMinStock,
}: {
  variables: { name: string; options: VariableOption[] }[];
  unit: string;
  unitPrice: number;
  unitCost: number;
  variablePrice?: boolean;
  productMinStock: number;
}) {
  if (!variables[0]?.options.length) return null;
  return (
    <div style={{ marginTop: "0.5rem" }}>
      <VariantTable
        variables={variables}
        unit={unit}
        unitPrice={unitPrice}
        unitCost={unitCost}
        variablePrice={variablePrice}
        productMinStock={productMinStock}
      />
    </div>
  );
}

/** Expanded variants table under the main item name (list view). */
function VariantExpanded({
  variables,
  unit,
  unitPrice,
  unitCost,
  variablePrice,
  productMinStock,
}: {
  variables: { name: string; options: VariableOption[] }[];
  unit: string;
  unitPrice: number;
  unitCost: number;
  variablePrice?: boolean;
  productMinStock: number;
}) {
  const first = variables[0];
  if (!first?.options.length) return null;

  return (
    <div className="inventory-variant-expanded">
      <div className="inventory-variant-expanded-label muted">
        {first.name} variants
      </div>
      <VariantTable
        variables={variables}
        unit={unit}
        unitPrice={unitPrice}
        unitCost={unitCost}
        variablePrice={variablePrice}
        productMinStock={productMinStock}
        highlightRows
      />
    </div>
  );
}

function StockStatusBadge({
  isService,
  out,
  low,
  listMode,
}: {
  isService: boolean;
  out: boolean;
  low: boolean;
  listMode?: boolean;
}) {
  if (isService) return <span className="badge badge-info">Service</span>;
  if (out) return <span className="badge badge-danger">Out of stock</span>;
  if (low) return <span className="badge badge-warn">Low stock</span>;
  return <span className="badge badge-ok">{listMode ? "OK" : "In stock"}</span>;
}

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

  const autoOpeningStock = useMemo(() => sumDraftStock(vars), [vars]);
  const hasOptionQtys = vars.some((v) => v.options.length > 0);

  function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canManage) return;
    const form = e.currentTarget;
    const fd = new FormData(form);
    const payload = vars
      .map((v) => ({
        name: v.name.trim(),
        options: v.options.filter((o) => o.label.trim()),
      }))
      .filter((v) => v.name && v.options.length);
    fd.set("variablesJson", JSON.stringify(payload));
    if (variablePrice) fd.set("variablePrice", "on");
    if (hasOptionQtys) {
      fd.set("stockQty", String(autoOpeningStock));
    }

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
      prev
        .map((p) => (p.id === updated.id ? { ...p, ...updated } : p))
        .sort((a, b) => a.name.localeCompare(b.name)),
    );
    router.refresh();
  }

  function onAdjusted(
    id: string,
    stockQty: number,
    variables?: { name: string; options: VariableOption[] }[],
  ) {
    setProducts((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, stockQty, ...(variables ? { variables } : {}) } : p,
      ),
    );
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
                  <input
                    name="stockQty"
                    type="number"
                    step="0.01"
                    value={hasOptionQtys ? autoOpeningStock : undefined}
                    defaultValue={hasOptionQtys ? undefined : 0}
                    readOnly={hasOptionQtys}
                    key={hasOptionQtys ? `auto-${autoOpeningStock}` : "manual"}
                  />
                  {hasOptionQtys ? (
                    <span className="muted" style={{ fontSize: "0.78rem" }}>
                      Auto-calculated from option quantities
                    </span>
                  ) : null}
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

            <label
              className="field"
              style={{ flexDirection: "row", alignItems: "center", gap: "0.5rem" }}
            >
              <input
                name="isService"
                type="checkbox"
                checked={isService}
                onChange={(e) => setIsService(e.target.checked)}
              />{" "}
              Service (fixed price — also shows on POS)
            </label>
            {!isService ? (
              <label
                className="field"
                style={{ flexDirection: "row", alignItems: "center", gap: "0.5rem" }}
              >
                <input name="trackStock" type="checkbox" defaultChecked /> Track stock
              </label>
            ) : null}

            <VariableOptionsEditor
              vars={vars}
              setVars={setVars}
              variableNames={variableNames}
              listId="variable-name-catalog"
              showQty={!isService}
              optionDefaults={{ minStock: 10 }}
            />

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
          const hasOptions = Boolean(p.variables?.some((v) => v.options.length));
          const out =
            p.trackStock &&
            !p.isService &&
            (hasOptions && p.variables?.[0]?.options.length
              ? p.variables[0].options.every((o) => o.qty <= 0)
              : p.stockQty <= 0);
          const low =
            !out &&
            p.trackStock &&
            !p.isService &&
            (hasOptions && p.variables
              ? p.variables.some((v) =>
                  v.options.some((o) => isOptionLowStock(o, p.minStock)),
                )
              : p.stockQty <= p.minStock);
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
                <div
                  className={
                    hasOptions
                      ? "inventory-list-row-main inventory-list-row-main-compact"
                      : "inventory-list-row-main"
                  }
                >
                  <ProductThumb imageData={p.imageData} alt={p.name} />
                  <div className="inventory-list-identity">
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
                  {!hasOptions ? (
                    <>
                      <div>
                        <div className="muted" style={{ fontSize: "0.72rem" }}>
                          Price
                        </div>
                        <strong className="money">
                          {p.variablePrice ? "At POS" : formatTTD(p.unitPrice)}
                        </strong>
                      </div>
                      <div>
                        <div className="muted" style={{ fontSize: "0.72rem" }}>
                          Cost
                        </div>
                        <strong className="money">{formatTTD(p.unitCost)}</strong>
                      </div>
                      <div>
                        <div className="muted" style={{ fontSize: "0.72rem" }}>
                          In stock
                        </div>
                        <strong>{p.isService || !p.trackStock ? "—" : p.stockQty}</strong>
                      </div>
                    </>
                  ) : null}
                  <div>
                    <StockStatusBadge
                      isService={p.isService}
                      out={out}
                      low={low}
                      listMode
                    />
                  </div>
                </div>
                {hasOptions && p.variables ? (
                  <VariantExpanded
                    variables={p.variables}
                    unit={p.unit}
                    unitPrice={p.unitPrice}
                    unitCost={p.unitCost}
                    variablePrice={p.variablePrice}
                    productMinStock={p.minStock}
                  />
                ) : null}
              </div>
            );
          }

          const margin = marginLabel(
            p.unitCost > 0 ? p.unitCost : null,
            p.variablePrice ? null : p.unitPrice > 0 ? p.unitPrice : null,
          );

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
              {hasOptions && p.variables ? (
                <OptionStockSelect
                  variables={p.variables}
                  unit={p.unit}
                  unitPrice={p.unitPrice}
                  unitCost={p.unitCost}
                  variablePrice={p.variablePrice}
                  productMinStock={p.minStock}
                />
              ) : null}
              <div className="row" style={{ marginTop: "0.75rem", justifyContent: "space-between" }}>
                <div>
                  <div className="muted" style={{ fontSize: "0.72rem" }}>
                    Price
                  </div>
                  <strong className="money">
                    {p.variablePrice ? "At POS" : formatTTD(p.unitPrice)}
                  </strong>
                </div>
                <div>
                  <div className="muted" style={{ fontSize: "0.72rem" }}>
                    Cost
                  </div>
                  <strong className="money">{formatTTD(p.unitCost)}</strong>
                </div>
                <div>
                  <div className="muted" style={{ fontSize: "0.72rem" }}>
                    Margin
                  </div>
                  <strong>{margin}</strong>
                </div>
                <div>
                  <div className="muted" style={{ fontSize: "0.72rem" }}>
                    In stock
                  </div>
                  <strong>{p.isService || !p.trackStock ? "—" : p.stockQty}</strong>
                </div>
              </div>
              <div style={{ marginTop: "0.75rem" }}>
                <StockStatusBadge isService={p.isService} out={out} low={low} />
              </div>
            </div>
          );
        })}
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
