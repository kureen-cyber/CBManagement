"use client";

import { FormEvent, useMemo, useState, useTransition } from "react";
import { updateProduct } from "@/app/actions";
import { fromCents } from "@/lib/money";
import { PRODUCT_CATEGORIES } from "@/lib/constants";
import { CategoryInput } from "@/components/CategoryInput";
import type { InventoryProduct } from "@/components/InventoryClient";
import {
  sumDraftStock,
  varDraftFromStored,
  VariableOptionsEditor,
  type VarDraft,
} from "@/components/VariableOptionsEditor";

export function EditProductModal({
  product,
  categories = [],
  variableNames = [],
  allCategories = [],
  onClose,
  onSaved,
}: {
  product: InventoryProduct;
  categories?: string[];
  variableNames?: string[];
  allCategories?: string[];
  onClose: () => void;
  onSaved: (updated: InventoryProduct) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [isService, setIsService] = useState(product.isService);
  const [variablePrice, setVariablePrice] = useState(Boolean(product.variablePrice));
  const [vars, setVars] = useState<VarDraft[]>(() => varDraftFromStored(product.variables || []));
  const [imagePreview, setImagePreview] = useState<string | null>(product.imageData ?? null);
  const [removeImage, setRemoveImage] = useState(false);

  const autoStock = useMemo(() => sumDraftStock(vars), [vars]);
  const hasOptionQtys = vars.some((v) => v.options.length > 0);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set("productId", product.id);
    const payload = vars
      .map((v) => ({
        name: v.name.trim(),
        options: v.options.filter((o) => o.label.trim()),
      }))
      .filter((v) => v.name && v.options.length);
    fd.set("variablesJson", JSON.stringify(payload));
    if (variablePrice) fd.set("variablePrice", "on");
    if (removeImage) fd.set("removeImage", "on");

    setError(null);
    startTransition(async () => {
      const result = await updateProduct(fd);
      if (result && "error" in result && result.error) {
        setError(result.error);
        return;
      }
      if (result && "id" in result) {
        onSaved(result);
        onClose();
      }
    });
  }

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-product-title"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        display: "grid",
        placeItems: "center",
        zIndex: 50,
        padding: "1rem",
      }}
      onClick={onClose}
    >
      <div
        className="panel"
        style={{
          padding: "1.25rem",
          width: "min(640px, 100%)",
          maxHeight: "min(90vh, 900px)",
          overflowY: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="edit-product-title" style={{ marginTop: 0 }}>
          Edit item
        </h3>
        <form onSubmit={onSubmit} className="form-grid" encType="multipart/form-data">
          <label className="field">
            Name
            <input name="name" required defaultValue={product.name} />
          </label>
          <label className="field">
            SKU
            <input name="sku" defaultValue={product.sku || ""} />
          </label>
          <label className="field">
            Category
            <CategoryInput
              name="category"
              defaultValue={product.category}
              suggestions={
                categories.length ? categories : [...PRODUCT_CATEGORIES, ...allCategories]
              }
              listId="edit-inventory-category-suggestions"
            />
          </label>
          <label className="field full">
            Item photo
            <input
              name="image"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setRemoveImage(false);
                  setImagePreview(URL.createObjectURL(file));
                }
              }}
            />
          </label>
          {imagePreview && !removeImage ? (
            <div className="full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imagePreview}
                alt={product.name}
                className="inventory-thumb"
                style={{ width: 120, height: 120 }}
              />
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ marginTop: "0.5rem" }}
                onClick={() => {
                  setRemoveImage(true);
                  setImagePreview(null);
                }}
              >
                Remove photo
              </button>
            </div>
          ) : null}
          <label className="field">
            Unit
            <input name="unit" defaultValue={product.unit} />
          </label>
          <label className="field">
            Unit cost
            <input
              name="unitCost"
              type="number"
              step="0.01"
              defaultValue={fromCents(product.unitCost)}
            />
          </label>
          <label className="field">
            Unit price (fixed)
            <input
              name="unitPrice"
              type="number"
              step="0.01"
              defaultValue={product.variablePrice ? "" : fromCents(product.unitPrice)}
              disabled={variablePrice}
              placeholder={variablePrice ? "Entered at POS" : "0.00"}
            />
          </label>
          {!isService ? (
            <>
              <label className="field">
                Total stock
                <input
                  type="number"
                  step="0.01"
                  value={hasOptionQtys ? autoStock : product.stockQty}
                  readOnly
                />
                {hasOptionQtys ? (
                  <span className="muted" style={{ fontSize: "0.78rem" }}>
                    Auto-calculated from option quantities
                  </span>
                ) : (
                  <span className="muted" style={{ fontSize: "0.78rem" }}>
                    Use Adjust stock to change quantity
                  </span>
                )}
              </label>
              <label className="field">
                Min stock
                <input name="minStock" type="number" step="0.01" defaultValue={product.minStock} />
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
            Service (no stock)
          </label>
          {!isService ? (
            <label
              className="field"
              style={{ flexDirection: "row", alignItems: "center", gap: "0.5rem" }}
            >
              <input name="trackStock" type="checkbox" defaultChecked={product.trackStock} /> Track
              stock
            </label>
          ) : null}

          <VariableOptionsEditor
            vars={vars}
            setVars={setVars}
            variableNames={variableNames}
            listId="edit-variable-name-catalog"
            showQty={!isService}
          />

          {error ? <div className="full badge badge-danger">{error}</div> : null}
          <div className="full row" style={{ gap: "0.5rem", justifyContent: "flex-end" }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={pending}>
              {pending ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
