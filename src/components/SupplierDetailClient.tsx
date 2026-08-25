"use client";

import { FormEvent, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatTTD, fromCents } from "@/lib/money";
import { SUPPLY_UNITS, SUPPLY_TYPES, isBuiltInSupplyType, supplyTypeLabel } from "@/lib/constants";
import {
  createSupplierItem,
  createSupplierPurchase,
  deleteSupplierItem,
  deleteSupplierPurchase,
  updateSupplierItem,
} from "@/app/actions";
import { Panel } from "@/components/ui";
import { formatAppDate } from "@/lib/timezone";

type SupplyItem = {
  id: string;
  name: string;
  supplyType: string;
  unit: string;
  unitCost: number;
  notes: string | null;
};

type Purchase = {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  purchasedAt: string;
  notes: string | null;
  supplierItemId: string | null;
};

type Tab = "database" | "purchases";

export function SupplierDetailClient({
  supplierId,
  items,
  purchases,
}: {
  supplierId: string;
  items: SupplyItem[];
  purchases: Purchase[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("database");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [customCategories, setCustomCategories] = useState<string[]>(() => {
    const seen = new Set<string>();
    for (const item of items) {
      const t = String(item.supplyType || "").trim();
      if (t && !isBuiltInSupplyType(t)) seen.add(t);
    }
    return [...seen].sort((a, b) => a.localeCompare(b));
  });

  useEffect(() => {
    setCustomCategories((prev) => {
      const seen = new Set(prev);
      for (const item of items) {
        const t = String(item.supplyType || "").trim();
        if (t && !isBuiltInSupplyType(t)) seen.add(t);
      }
      return [...seen].sort((a, b) => a.localeCompare(b));
    });
  }, [items]);

  const [newCategoryName, setNewCategoryName] = useState("");
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [addSupplyType, setAddSupplyType] = useState("MATERIAL");

  const supplyTypeOptions = useMemo(() => {
    const extras = customCategories
      .filter((c) => !isBuiltInSupplyType(c))
      .map((c) => ({ value: c, label: supplyTypeLabel(c) }));
    return [...SUPPLY_TYPES, ...extras];
  }, [customCategories]);

  const [purchaseItemId, setPurchaseItemId] = useState("");
  const selectedCatalog = useMemo(
    () => items.find((i) => i.id === purchaseItemId) || null,
    [items, purchaseItemId],
  );

  function refresh() {
    router.refresh();
  }

  function addCustomCategory() {
    const name = newCategoryName.trim();
    if (!name) {
      setError("Enter a category name");
      return;
    }
    if (isBuiltInSupplyType(name) || supplyTypeOptions.some((o) => o.value.toLowerCase() === name.toLowerCase())) {
      setAddSupplyType(
        isBuiltInSupplyType(name)
          ? name
          : supplyTypeOptions.find((o) => o.value.toLowerCase() === name.toLowerCase())!.value,
      );
      setNewCategoryName("");
      setShowAddCategory(false);
      setError(null);
      return;
    }
    setCustomCategories((prev) => [...prev, name].sort((a, b) => a.localeCompare(b)));
    setAddSupplyType(name);
    setNewCategoryName("");
    setShowAddCategory(false);
    setError(null);
  }

  function onAddSupply(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("supplyType", addSupplyType);
    startTransition(async () => {
      try {
        await createSupplierItem(fd);
        (e.target as HTMLFormElement).reset();
        setAddSupplyType("MATERIAL");
        refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not add supply item");
      }
    });
  }

  function onUpdateSupply(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await updateSupplierItem(fd);
        setEditingId(null);
        refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not update item");
      }
    });
  }

  function onAddPurchase(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await createSupplierPurchase(fd);
        (e.target as HTMLFormElement).reset();
        setPurchaseItemId("");
        refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not record purchase");
      }
    });
  }

  return (
    <div className="stack">
      {error ? (
        <div className="info-banner" style={{ borderColor: "var(--danger)", color: "var(--danger)" }}>
          {error}
        </div>
      ) : null}

      <div className="settings-subtabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "database"}
          className={tab === "database" ? "settings-subtab active" : "settings-subtab"}
          onClick={() => setTab("database")}
        >
          Supply database
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "purchases"}
          className={tab === "purchases" ? "settings-subtab active" : "settings-subtab"}
          onClick={() => setTab("purchases")}
        >
          Purchases
        </button>
      </div>

      {tab === "database" ? (
        <>
          <Panel style={{ padding: "1.25rem" }}>
            <h2 style={{ marginTop: 0, fontSize: "1.15rem" }}>Add to supply database</h2>
            <p className="muted" style={{ margin: "0 0 1rem", fontSize: "0.88rem" }}>
              In-house cost reference for this supplier — used when building quotations. Classify
              each item as material, equipment, equipment rental, or an additional cost category you
              define.
            </p>

            <div className="panel" style={{ padding: "1rem", marginBottom: "1rem" }}>
              <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <strong>Additional cost category</strong>
                  <div className="muted" style={{ fontSize: "0.82rem", marginTop: "0.2rem" }}>
                    Add a custom type (e.g. Transport, Permits, Subcontractor) for supply items
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  aria-label="Add additional cost category"
                  onClick={() => {
                    setShowAddCategory(true);
                    setError(null);
                  }}
                >
                  +
                </button>
              </div>
              {showAddCategory ? (
                <div
                  className="row"
                  style={{ gap: "0.5rem", flexWrap: "wrap", alignItems: "flex-end", marginTop: "0.85rem" }}
                >
                  <label className="field" style={{ flex: "1 1 200px" }}>
                    Category name
                    <input
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      placeholder="e.g. Transport"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addCustomCategory();
                        }
                      }}
                    />
                  </label>
                  <button type="button" className="btn btn-primary btn-sm" onClick={addCustomCategory}>
                    Add category
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setShowAddCategory(false);
                      setNewCategoryName("");
                    }}
                  >
                    Cancel
                  </button>
                </div>
              ) : null}
              {customCategories.length > 0 ? (
                <div className="muted" style={{ fontSize: "0.82rem", marginTop: "0.75rem" }}>
                  Custom categories: {customCategories.map((c) => supplyTypeLabel(c)).join(", ")}
                </div>
              ) : null}
            </div>

            <form className="form-grid" onSubmit={onAddSupply} autoComplete="off">
              <input type="hidden" name="supplierId" value={supplierId} />
              <label className="field">
                Item name
                <input name="name" required placeholder="e.g. Electrical cable 2.5mm" />
              </label>
              <label className="field">
                Type
                <select
                  name="supplyType"
                  value={addSupplyType}
                  onChange={(e) => setAddSupplyType(e.target.value)}
                >
                  {supplyTypeOptions.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Cost per unit (TT$)
                <input name="unitCost" type="number" step="0.01" min="0" required placeholder="0.00" />
              </label>
              <label className="field">
                Unit
                <input
                  name="unit"
                  list="supply-unit-suggestions"
                  defaultValue="each"
                  placeholder="each, kg, case…"
                />
                <datalist id="supply-unit-suggestions">
                  {SUPPLY_UNITS.map((u) => (
                    <option key={u} value={u} />
                  ))}
                </datalist>
              </label>
              <label className="field full">
                Notes
                <textarea name="notes" rows={2} placeholder="Optional" />
              </label>
              <div className="full">
                <button className="btn btn-primary" type="submit" disabled={pending}>
                  {pending ? "Saving…" : "Add to database"}
                </button>
              </div>
            </form>
          </Panel>

          <Panel className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Type</th>
                  <th>Unit</th>
                  <th>Cost</th>
                  <th>Notes</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((item) =>
                  editingId === item.id ? (
                    <tr key={item.id}>
                      <td colSpan={6}>
                        <form className="form-grid" onSubmit={onUpdateSupply} autoComplete="off">
                          <input type="hidden" name="id" value={item.id} />
                          <label className="field">
                            Name
                            <input name="name" required defaultValue={item.name} />
                          </label>
                          <label className="field">
                            Type
                            <select name="supplyType" defaultValue={item.supplyType}>
                              {[
                                ...supplyTypeOptions,
                                ...(!supplyTypeOptions.some((t) => t.value === item.supplyType)
                                  ? [{ value: item.supplyType, label: supplyTypeLabel(item.supplyType) }]
                                  : []),
                              ].map((t) => (
                                <option key={t.value} value={t.value}>
                                  {t.label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="field">
                            Cost (TT$)
                            <input
                              name="unitCost"
                              type="number"
                              step="0.01"
                              min="0"
                              required
                              defaultValue={fromCents(item.unitCost)}
                            />
                          </label>
                          <label className="field">
                            Unit
                            <input name="unit" defaultValue={item.unit} />
                          </label>
                          <label className="field full">
                            Notes
                            <input name="notes" defaultValue={item.notes || ""} />
                          </label>
                          <div className="full row" style={{ gap: "0.5rem" }}>
                            <button className="btn btn-primary btn-sm" type="submit" disabled={pending}>
                              Save
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => setEditingId(null)}
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      </td>
                    </tr>
                  ) : (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.name}</strong>
                      </td>
                      <td className="muted">{supplyTypeLabel(item.supplyType)}</td>
                      <td className="muted">{item.unit}</td>
                      <td className="money">{formatTTD(item.unitCost)}</td>
                      <td className="muted" style={{ fontSize: "0.85rem" }}>
                        {item.notes || "—"}
                      </td>
                      <td>
                        <div className="row" style={{ gap: "0.35rem", justifyContent: "flex-end" }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setEditingId(item.id)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            disabled={pending}
                            onClick={() => {
                              const fd = new FormData();
                              fd.set("id", item.id);
                              fd.set("supplierId", supplierId);
                              startTransition(async () => {
                                await deleteSupplierItem(fd);
                                refresh();
                              });
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  ),
                )}
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="muted">
                      No supply items yet — add costs here for quotations.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </Panel>
        </>
      ) : null}

      {tab === "purchases" ? (
        <>
          <Panel style={{ padding: "1.25rem" }}>
            <h2 style={{ marginTop: 0, fontSize: "1.15rem" }}>Record a purchase</h2>
            <p className="muted" style={{ margin: "0 0 1rem", fontSize: "0.88rem" }}>
              Track what you actually bought from this supplier. Optionally pick from the supply
              database to fill name and cost.
            </p>
            <form className="form-grid" onSubmit={onAddPurchase} autoComplete="off">
              <input type="hidden" name="supplierId" value={supplierId} />
              <label className="field">
                From supply database
                <select
                  name="supplierItemId"
                  value={purchaseItemId}
                  onChange={(e) => setPurchaseItemId(e.target.value)}
                >
                  <option value="">Custom / one-off</option>
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({formatTTD(i.unitCost)}/{i.unit})
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Item bought
                <input
                  name="name"
                  required={!selectedCatalog}
                  key={`name-${purchaseItemId}`}
                  defaultValue={selectedCatalog?.name || ""}
                  placeholder="e.g. Rice delivery"
                />
              </label>
              <label className="field">
                Quantity
                <input name="quantity" type="number" step="0.001" min="0.001" defaultValue={1} required />
              </label>
              <label className="field">
                Unit
                <input
                  name="unit"
                  key={`unit-${purchaseItemId}`}
                  defaultValue={selectedCatalog?.unit || "each"}
                  list="purchase-unit-suggestions"
                />
                <datalist id="purchase-unit-suggestions">
                  {SUPPLY_UNITS.map((u) => (
                    <option key={u} value={u} />
                  ))}
                </datalist>
              </label>
              <label className="field">
                Cost per unit (TT$)
                <input
                  name="unitCost"
                  type="number"
                  step="0.01"
                  min="0"
                  key={`cost-${purchaseItemId}`}
                  defaultValue={selectedCatalog ? fromCents(selectedCatalog.unitCost) : ""}
                  placeholder="0.00"
                />
              </label>
              <label className="field">
                Date
                <input
                  name="purchasedAt"
                  type="date"
                  defaultValue={new Date().toISOString().slice(0, 10)}
                />
              </label>
              <label className="field full">
                Notes
                <textarea name="notes" rows={2} placeholder="Invoice #, delivery note…" />
              </label>
              <div className="full">
                <button className="btn btn-primary" type="submit" disabled={pending}>
                  {pending ? "Saving…" : "Record purchase"}
                </button>
              </div>
            </form>
          </Panel>

          <Panel className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Unit cost</th>
                  <th>Total</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {purchases.map((p) => (
                  <tr key={p.id}>
                    <td className="muted">
                      {formatAppDate(p.purchasedAt)}
                    </td>
                    <td>
                      <strong>{p.name}</strong>
                      {p.notes ? (
                        <div className="muted" style={{ fontSize: "0.8rem" }}>
                          {p.notes}
                        </div>
                      ) : null}
                    </td>
                    <td>
                      {p.quantity} {p.unit}
                    </td>
                    <td className="money">{formatTTD(p.unitCost)}</td>
                    <td className="money">{formatTTD(p.totalCost)}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={pending}
                        onClick={() => {
                          const fd = new FormData();
                          fd.set("id", p.id);
                          startTransition(async () => {
                            await deleteSupplierPurchase(fd);
                            refresh();
                          });
                        }}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
                {purchases.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="muted">
                      No purchases recorded yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </Panel>
        </>
      ) : null}
    </div>
  );
}
