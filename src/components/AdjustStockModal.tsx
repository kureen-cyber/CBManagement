"use client";

import { FormEvent, useState, useTransition } from "react";
import { adjustProductStock } from "@/app/actions";
import { fromCents, formatTTD } from "@/lib/money";
import type { VariableOption } from "@/lib/product-variables";

type AdjustStockProduct = {
  id: string;
  name: string;
  unit: string;
  unitCost: number;
  stockQty: number;
  variables?: { name: string; options: VariableOption[] }[];
};

export function AdjustStockModal({
  product,
  onClose,
  onAdjusted,
}: {
  product: AdjustStockProduct;
  onClose: () => void;
  onAdjusted: (
    id: string,
    stockQty: number,
    variables?: { name: string; options: VariableOption[] }[],
  ) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const optionVar = product.variables?.find((v) => v.options.length);
  const [optionLabel, setOptionLabel] = useState(optionVar?.options[0]?.label || "");

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("productId", product.id);
    if (optionVar) fd.set("optionLabel", optionLabel);

    setError(null);
    startTransition(async () => {
      const result = await adjustProductStock(fd);
      if (result && "error" in result && result.error) {
        setError(result.error);
        return;
      }
      if (result && "stockQty" in result && typeof result.stockQty === "number") {
        onAdjusted(
          product.id,
          result.stockQty,
          "variables" in result ? result.variables : undefined,
        );
      }
      onClose();
    });
  }

  const selectedQty =
    optionVar?.options.find((o) => o.label === optionLabel)?.qty ?? product.stockQty;

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="adjust-stock-title"
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
        style={{ padding: "1.25rem", width: "min(420px, 100%)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="adjust-stock-title" style={{ marginTop: 0 }}>
          Adjust stock
        </h3>
        <p className="muted" style={{ marginTop: 0, fontSize: "0.9rem" }}>
          {product.name} — total: <strong>{product.stockQty}</strong> {product.unit}
          {optionVar ? (
            <>
              {" "}
              · {optionLabel}: <strong>{selectedQty}</strong>
            </>
          ) : null}
        </p>
        <form onSubmit={onSubmit} className="stack" style={{ gap: "0.75rem" }}>
          {optionVar ? (
            <label className="field">
              {optionVar.name}
              <select
                value={optionLabel}
                onChange={(e) => setOptionLabel(e.target.value)}
                required
              >
                {optionVar.options.map((o) => (
                  <option key={o.label} value={o.label}>
                    {o.label} ({o.qty} on hand)
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="field">
            Quantity to add or remove
            <input
              name="quantity"
              type="number"
              step="0.01"
              required
              autoFocus
              placeholder="e.g. 10 to receive, -2 to remove"
            />
          </label>
          <label className="field">
            Unit cost (optional, for purchases)
            <input
              name="unitCost"
              type="number"
              step="0.01"
              defaultValue={fromCents(product.unitCost)}
            />
          </label>
          <label className="field">
            Notes
            <input name="notes" placeholder="e.g. Delivery from supplier" />
          </label>
          {error ? <div className="badge badge-danger">{error}</div> : null}
          <div className="row" style={{ gap: "0.5rem", justifyContent: "flex-end" }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={pending}>
              {pending ? "Saving…" : "Update stock"}
            </button>
          </div>
        </form>
        <p className="muted" style={{ fontSize: "0.78rem", marginBottom: 0 }}>
          Last cost: {formatTTD(product.unitCost)} per {product.unit}
        </p>
      </div>
    </div>
  );
}
