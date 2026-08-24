"use client";

import type { VariableOption } from "@/lib/product-variables";

export type VarDraft = {
  name: string;
  options: VariableOption[];
  /** Temporary text while typing comma-separated labels before qty rows expand. */
  optionsText?: string;
};

export function varDraftFromStored(
  variables: { name: string; options: VariableOption[] | string[] }[],
): VarDraft[] {
  return variables.map((v) => ({
    name: v.name,
    options: (v.options || []).map((o) =>
      typeof o === "string" ? { label: o, qty: 0 } : { label: o.label, qty: Number(o.qty) || 0 },
    ),
  }));
}

export function sumDraftStock(vars: VarDraft[]): number {
  return vars.reduce(
    (sum, v) => sum + v.options.reduce((s, o) => s + (Number(o.qty) || 0), 0),
    0,
  );
}

export function VariableOptionsEditor({
  vars,
  setVars,
  variableNames,
  listId,
  showQty,
}: {
  vars: VarDraft[];
  setVars: (next: VarDraft[] | ((prev: VarDraft[]) => VarDraft[])) => void;
  variableNames: string[];
  listId: string;
  showQty: boolean;
}) {
  function syncOptionsFromText(idx: number, text: string) {
    const labels = text
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean);
    setVars((prev) =>
      prev.map((row, i) => {
        if (i !== idx) return row;
        const byLabel = new Map(row.options.map((o) => [o.label.toLowerCase(), o.qty]));
        return {
          ...row,
          optionsText: text,
          options: labels.map((label) => ({
            label,
            qty: byLabel.get(label.toLowerCase()) ?? 0,
          })),
        };
      }),
    );
  }

  return (
    <div className="full stack" style={{ gap: "0.65rem" }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <strong>Variables</strong>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => setVars((prev) => [...prev, { name: "", options: [], optionsText: "" }])}
        >
          Add variable
        </button>
      </div>
      <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
        Example: name <em>Colour</em>, options <em>Red, Blue, Black</em>
        {showQty ? ", then enter how many of each. Opening stock totals automatically." : "."} Names
        you save appear in the dropdown next time.
      </p>
      {vars.map((v, idx) => (
        <div key={idx} className="stack" style={{ gap: "0.5rem" }}>
          <div className="row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
            <label className="field" style={{ flex: "1 1 140px" }}>
              Variable name
              <input
                list={listId}
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
                value={v.optionsText ?? v.options.map((o) => o.label).join(", ")}
                onChange={(e) => syncOptionsFromText(idx, e.target.value)}
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
          {showQty && v.options.length > 0 ? (
            <div className="stack" style={{ gap: "0.4rem", paddingLeft: "0.25rem" }}>
              <span className="muted" style={{ fontSize: "0.82rem" }}>
                Stock per {v.name || "option"}
              </span>
              <div className="row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
                {v.options.map((o, oi) => (
                  <label key={`${o.label}-${oi}`} className="field" style={{ flex: "1 1 110px" }}>
                    {o.label}
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={o.qty}
                      onChange={(e) => {
                        const qty = Math.max(0, Number(e.target.value) || 0);
                        setVars((prev) =>
                          prev.map((row, i) =>
                            i !== idx
                              ? row
                              : {
                                  ...row,
                                  options: row.options.map((opt, j) =>
                                    j === oi ? { ...opt, qty } : opt,
                                  ),
                                },
                          ),
                        );
                      }}
                    />
                  </label>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ))}
      <datalist id={listId}>
        {variableNames.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
    </div>
  );
}
