"use client";

import { useMemo, useState } from "react";
import { createQuotation, updateQuotation } from "@/app/actions";
import { formatTTD, fromCents, toCents } from "@/lib/money";
import { quotationClientLines } from "@/lib/quotation-pricing";
import { supplyTypeLabel } from "@/lib/constants";
import type { PersistedSupplyLine } from "@/lib/supply-lines";

type ExtraDraft = { name: string; amount: string };
type FormTab = "details" | "notes";

export type SupplyCatalogItem = {
  id: string;
  name: string;
  unit: string;
  unitCost: number;
  supplyType: string;
  supplierName: string;
};

export type QuotationFormInitial = {
  id: string;
  customerId: string;
  title: string | null;
  notes: string | null;
  labourCost: number;
  materialsCost: number;
  equipmentCost: number;
  transportCost: number;
  markupPct: number;
  fixedPrice: boolean;
  total: number;
  extras: { name: string; amount: number }[];
  supplyLines?: PersistedSupplyLine[];
};

function centsToInput(cents: number) {
  return String(fromCents(cents));
}

export function QuotationForm({
  customers,
  supplyCatalog = [],
  initial,
}: {
  customers: { id: string; name: string }[];
  /** In-house supply database across suppliers — for materials costing. */
  supplyCatalog?: SupplyCatalogItem[];
  initial?: QuotationFormInitial;
}) {
  const isEdit = Boolean(initial?.id);
  const [tab, setTab] = useState<FormTab>("details");
  const [fixedPrice, setFixedPrice] = useState(initial?.fixedPrice ?? false);
  const [labour, setLabour] = useState(initial ? centsToInput(initial.labourCost) : "2500");
  const [materials, setMaterials] = useState(initial ? centsToInput(initial.materialsCost) : "1800");
  const [equipment, setEquipment] = useState(initial ? centsToInput(initial.equipmentCost) : "500");
  const [transport, setTransport] = useState(initial ? centsToInput(initial.transportCost) : "300");
  const [markupPct, setMarkupPct] = useState(String(initial?.markupPct ?? 25));
  const [fixedAmount, setFixedAmount] = useState(
    initial?.fixedPrice ? centsToInput(initial.total) : "5100",
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [extras, setExtras] = useState<ExtraDraft[]>(
    initial?.extras.length
      ? initial.extras.map((e) => ({ name: e.name, amount: centsToInput(e.amount) }))
      : [{ name: "", amount: "" }],
  );
  const [pickId, setPickId] = useState("");
  const [pickQty, setPickQty] = useState("1");
  const [pickedLines, setPickedLines] = useState<
    (PersistedSupplyLine & { key: string; label: string })[]
  >(
    () =>
      initial?.supplyLines?.map((l, idx) => ({
        ...l,
        key: `${l.supplierItemId || "line"}-${idx}`,
        label: l.supplierName ? `${l.name} (${l.supplierName})` : l.name,
      })) ?? [],
  );

  const selectedSupply = useMemo(
    () => supplyCatalog.find((s) => s.id === pickId) || null,
    [supplyCatalog, pickId],
  );

  function addFromSupply() {
    if (!selectedSupply) return;
    const qty = Math.max(0.001, Number(pickQty) || 1);
    const lineCost = Math.round(selectedSupply.unitCost * qty);
    const supplyType = selectedSupply.supplyType || "MATERIAL";
    setPickedLines((prev) => [
      ...prev,
      {
        key: `${selectedSupply.id}-${Date.now()}`,
        label: `${selectedSupply.name} (${selectedSupply.supplierName})`,
        supplierItemId: selectedSupply.id,
        name: selectedSupply.name,
        supplierName: selectedSupply.supplierName,
        qty,
        unit: selectedSupply.unit,
        unitCost: selectedSupply.unitCost,
        lineCost,
        supplyType,
      },
    ]);
    if (supplyType === "MATERIAL") {
      const current = toCents(Number(materials) || 0);
      setMaterials(centsToInput(current + lineCost));
    } else {
      const current = toCents(Number(equipment) || 0);
      setEquipment(centsToInput(current + lineCost));
    }
    setPickQty("1");
  }

  function removePicked(key: string) {
    const row = pickedLines.find((l) => l.key === key);
    if (!row) return;
    setPickedLines((prev) => prev.filter((l) => l.key !== key));
    if (row.supplyType === "MATERIAL") {
      const current = toCents(Number(materials) || 0);
      setMaterials(centsToInput(Math.max(0, current - row.lineCost)));
    } else {
      const current = toCents(Number(equipment) || 0);
      setEquipment(centsToInput(Math.max(0, current - row.lineCost)));
    }
  }

  const supplyLinesPayload = useMemo(
    () =>
      pickedLines.map((l) => ({
        supplierItemId: l.supplierItemId,
        name: l.name,
        supplierName: l.supplierName,
        qty: l.qty,
        unit: l.unit,
        unitCost: l.unitCost,
        lineCost: l.lineCost,
        supplyType: l.supplyType,
      })),
    [pickedLines],
  );

  const preview = useMemo(() => {
    const labourC = toCents(Number(labour) || 0);
    const materialsC = toCents(Number(materials) || 0);
    const equipmentC = toCents(Number(equipment) || 0);
    const transportC = toCents(Number(transport) || 0);
    const markup = Number(markupPct) || 0;
    const fixed = toCents(Number(fixedAmount) || 0);
    const extraCosts = extras
      .map((e) => ({
        label: e.name.trim(),
        cost: toCents(Number(e.amount) || 0),
      }))
      .filter((e) => e.label && e.cost > 0);
    const lines = quotationClientLines({
      labourCost: labourC,
      materialsCost: materialsC,
      equipmentCost: equipmentC,
      transportCost: transportC,
      markupPct: fixedPrice ? 0 : markup,
      fixedPrice,
      total: fixedPrice
        ? fixed > 0
          ? fixed
          : labourC +
            materialsC +
            equipmentC +
            transportC +
            extraCosts.reduce((s, e) => s + e.cost, 0)
        : 0,
      extraCosts,
    });
    const total = fixedPrice
      ? fixed > 0
        ? fixed
        : lines.reduce((s, l) => s + l.amount, 0)
      : lines.reduce((s, l) => s + l.amount, 0);
    return { lines, total };
  }, [labour, materials, equipment, transport, markupPct, fixedPrice, fixedAmount, extras]);

  return (
    <form action={isEdit ? updateQuotation : createQuotation} className="stack" style={{ gap: "1rem" }}>
      {isEdit ? <input type="hidden" name="quotationId" value={initial!.id} /> : null}
      <input
        type="hidden"
        name="extraCostsJson"
        value={JSON.stringify(
          extras
            .map((e) => ({ name: e.name.trim(), amount: e.amount }))
            .filter((e) => e.name && Number(e.amount) > 0),
        )}
      />
      <input type="hidden" name="supplyLinesJson" value={JSON.stringify(supplyLinesPayload)} />
      <input type="hidden" name="notes" value={notes} />

      <div className="settings-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "details"}
          className={tab === "details" ? "settings-tab active" : "settings-tab"}
          onClick={() => setTab("details")}
        >
          Quote details
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "notes"}
          className={tab === "notes" ? "settings-tab active" : "settings-tab"}
          onClick={() => setTab("notes")}
        >
          Notes
        </button>
      </div>

      {tab === "details" ? (
        <div className="form-grid">
          <label className="field">
            Customer
            <select name="customerId" required defaultValue={initial?.customerId ?? ""}>
              <option value="" disabled>
                Select
              </option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Title
            <input name="title" placeholder="Electrical installation" defaultValue={initial?.title ?? ""} />
          </label>
          <label className="field">
            Labour cost (TT$)
            <input
              name="labourCost"
              type="number"
              step="0.01"
              value={labour}
              onChange={(e) => setLabour(e.target.value)}
            />
          </label>
          <label className="field">
            Materials cost (TT$)
            <input
              name="materialsCost"
              type="number"
              step="0.01"
              value={materials}
              onChange={(e) => setMaterials(e.target.value)}
            />
          </label>
          <label className="field">
            Equipment cost (TT$)
            <input
              name="equipmentCost"
              type="number"
              step="0.01"
              value={equipment}
              onChange={(e) => setEquipment(e.target.value)}
            />
          </label>
          <label className="field">
            Transport cost (TT$)
            <input
              name="transportCost"
              type="number"
              step="0.01"
              value={transport}
              onChange={(e) => setTransport(e.target.value)}
            />
          </label>

          {supplyCatalog.length > 0 ? (
            <div className="full panel" style={{ padding: "1rem" }}>
              <strong>Add from supply database</strong>
              <div className="muted" style={{ fontSize: "0.82rem", marginTop: "0.2rem" }}>
                Pick a supplier catalog item — materials go to Materials cost; equipment and rentals
                go to Equipment cost.
              </div>
              <div
                className="row"
                style={{ gap: "0.5rem", flexWrap: "wrap", alignItems: "flex-end", marginTop: "0.85rem" }}
              >
                <label className="field" style={{ flex: "2 1 220px" }}>
                  Supply item
                  <select value={pickId} onChange={(e) => setPickId(e.target.value)}>
                    <option value="">Select…</option>
                    {supplyCatalog.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.supplierName} — {s.name} ({supplyTypeLabel(s.supplyType)},{" "}
                        {formatTTD(s.unitCost)}/{s.unit})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field" style={{ flex: "0 1 100px" }}>
                  Qty
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    value={pickQty}
                    onChange={(e) => setPickQty(e.target.value)}
                  />
                </label>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={!selectedSupply}
                  onClick={addFromSupply}
                >
                  {selectedSupply?.supplyType === "MATERIAL"
                    ? "Add to materials"
                    : selectedSupply?.supplyType === "EQUIPMENT_RENTAL"
                      ? "Add to equipment (rental)"
                      : "Add to equipment"}
                </button>
              </div>
              {pickedLines.length > 0 ? (
                <ul style={{ margin: "0.85rem 0 0", paddingLeft: "1.1rem" }}>
                  {pickedLines.map((l) => (
                    <li key={l.key} className="row" style={{ gap: "0.5rem", alignItems: "center" }}>
                      <span>
                        {l.qty} {l.unit} × {l.label}{" "}
                        <span className="muted">({supplyTypeLabel(l.supplyType)})</span> ={" "}
                        <strong className="money">{formatTTD(l.lineCost)}</strong>
                      </span>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => removePicked(l.key)}
                      >
                        Undo
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : (
            <div className="full muted" style={{ fontSize: "0.85rem" }}>
              Tip: add items under Suppliers → Supply database to pull material costs into quotes.
            </div>
          )}

          <div className="full panel" style={{ padding: "1rem" }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <strong>Additional cost category</strong>
                <div className="muted" style={{ fontSize: "0.82rem", marginTop: "0.2rem" }}>
                  Name a custom cost (e.g. Permits, Subcontractor) and enter the amount
                </div>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                aria-label="Add another cost category"
                onClick={() => setExtras((prev) => [...prev, { name: "", amount: "" }])}
              >
                +
              </button>
            </div>
            <div className="stack" style={{ marginTop: "0.85rem", gap: "0.65rem" }}>
              {extras.map((row, idx) => (
                <div key={idx} className="row" style={{ gap: "0.5rem", flexWrap: "wrap", alignItems: "flex-end" }}>
                  <label className="field" style={{ flex: "1 1 160px" }}>
                    Category name
                    <input
                      value={row.name}
                      onChange={(e) =>
                        setExtras((prev) =>
                          prev.map((r, i) => (i === idx ? { ...r, name: e.target.value } : r)),
                        )
                      }
                      placeholder="e.g. Permits"
                    />
                  </label>
                  <label className="field" style={{ flex: "1 1 120px" }}>
                    Cost (TT$)
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={row.amount}
                      onChange={(e) =>
                        setExtras((prev) =>
                          prev.map((r, i) => (i === idx ? { ...r, amount: e.target.value } : r)),
                        )
                      }
                      placeholder="0.00"
                    />
                  </label>
                  {extras.length > 1 ? (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setExtras((prev) => prev.filter((_, i) => i !== idx))}
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          <label className="choice-card full">
            <input
              type="checkbox"
              name="fixedPrice"
              checked={fixedPrice}
              onChange={(e) => setFixedPrice(e.target.checked)}
            />
            <span>
              <strong>Fixed-price service</strong>
              <span className="muted" style={{ display: "block", fontSize: "0.82rem" }}>
                Enter a set selling price — markup % is hidden
              </span>
            </span>
          </label>

          {fixedPrice ? (
            <label className="field full">
              Fixed price (TT$)
              <input
                name="fixedPriceAmount"
                type="number"
                step="0.01"
                required
                value={fixedAmount}
                onChange={(e) => setFixedAmount(e.target.value)}
              />
            </label>
          ) : (
            <label className="field full">
              Markup %
              <input
                name="markupPct"
                type="number"
                step="0.1"
                value={markupPct}
                onChange={(e) => setMarkupPct(e.target.value)}
              />
              <span className="muted" style={{ fontSize: "0.8rem" }}>
                Applied inside each item on the customer quote (not shown as a separate line)
              </span>
            </label>
          )}

          <div className="full panel" style={{ padding: "0.85rem 1rem" }}>
            <strong style={{ fontSize: "0.9rem" }}>Customer quote preview</strong>
            <div className="stack" style={{ marginTop: "0.5rem", gap: "0.35rem" }}>
              {preview.lines.map((l) => (
                <div key={l.label} className="row" style={{ justifyContent: "space-between" }}>
                  <span>{l.label}</span>
                  <span className="money">{formatTTD(l.amount)}</span>
                </div>
              ))}
              {preview.lines.length === 0 ? (
                <div className="muted">Enter costs to preview marked-up amounts.</div>
              ) : null}
              <div
                className="row"
                style={{ justifyContent: "space-between", marginTop: "0.35rem", fontWeight: 700 }}
              >
                <span>Total</span>
                <span className="money">{formatTTD(preview.total)}</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="stack" style={{ gap: "0.65rem" }}>
          <label className="field full">
            Internal notes
            <textarea
              rows={6}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes for your team — not shown to customers unless you choose to include them when emailing."
            />
          </label>
          <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
            Notes are visible to business staff only by default. When you email this quote, you can
            choose whether to include them in the customer view.
          </p>
        </div>
      )}

      <div className="row" style={{ gap: "0.5rem" }}>
        <button className="btn btn-primary" type="submit">
          {isEdit ? "Save changes" : "Save quotation"}
        </button>
        {isEdit ? (
          <a className="btn btn-secondary" href={`/quotations/${initial!.id}`}>
            Cancel
          </a>
        ) : null}
      </div>
    </form>
  );
}
