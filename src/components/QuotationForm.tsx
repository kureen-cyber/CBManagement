"use client";

import { useMemo, useState } from "react";
import { createQuotation, updateQuotation } from "@/app/actions";
import { formatTTD, fromCents, toCents } from "@/lib/money";
import { quotationClientLines } from "@/lib/quotation-pricing";

type ExtraDraft = { name: string; amount: string };

export type QuotationFormInitial = {
  id: string;
  customerId: string;
  title: string | null;
  labourCost: number;
  materialsCost: number;
  equipmentCost: number;
  transportCost: number;
  markupPct: number;
  fixedPrice: boolean;
  total: number;
  extras: { name: string; amount: number }[];
};

function centsToInput(cents: number) {
  return String(fromCents(cents));
}

export function QuotationForm({
  customers,
  initial,
}: {
  customers: { id: string; name: string }[];
  initial?: QuotationFormInitial;
}) {
  const isEdit = Boolean(initial?.id);
  const [fixedPrice, setFixedPrice] = useState(initial?.fixedPrice ?? false);
  const [labour, setLabour] = useState(initial ? centsToInput(initial.labourCost) : "2500");
  const [materials, setMaterials] = useState(initial ? centsToInput(initial.materialsCost) : "1800");
  const [equipment, setEquipment] = useState(initial ? centsToInput(initial.equipmentCost) : "500");
  const [transport, setTransport] = useState(initial ? centsToInput(initial.transportCost) : "300");
  const [markupPct, setMarkupPct] = useState(String(initial?.markupPct ?? 25));
  const [fixedAmount, setFixedAmount] = useState(
    initial?.fixedPrice ? centsToInput(initial.total) : "5100",
  );
  const [extras, setExtras] = useState<ExtraDraft[]>(
    initial?.extras.length
      ? initial.extras.map((e) => ({ name: e.name, amount: centsToInput(e.amount) }))
      : [{ name: "", amount: "" }],
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
    <form action={isEdit ? updateQuotation : createQuotation} className="form-grid">
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

      <div className="full row" style={{ gap: "0.5rem" }}>
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
