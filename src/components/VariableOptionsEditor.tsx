"use client";

import { fromCents } from "@/lib/money";
import type { VariableOption, VariableOptionDefaults } from "@/lib/product-variables";
import { newVariableOption } from "@/lib/product-variables";

export type VarDraft = {
  name: string;
  options: VariableOption[];
  /** Temporary text while typing comma-separated labels before table rows expand. */
  optionsText?: string;
};

export function varDraftFromStored(
  variables: { name: string; options: VariableOption[] | string[] }[],
  defaults: VariableOptionDefaults = {},
): VarDraft[] {
  return variables.map((v) => ({
    name: v.name,
    options: (v.options || []).map((o) =>
      typeof o === "string" ? newVariableOption(o, defaults) : { ...newVariableOption(o.label, defaults), ...o },
    ),
  }));
}

export function sumDraftStock(vars: VarDraft[]): number {
  return vars.reduce(
    (sum, v) => sum + v.options.reduce((s, o) => s + (Number(o.qty) || 0), 0),
    0,
  );
}

function updateOption(
  vars: VarDraft[],
  varIdx: number,
  optIdx: number,
  patch: Partial<VariableOption>,
): VarDraft[] {
  return vars.map((row, i) =>
    i !== varIdx
      ? row
      : {
          ...row,
          options: row.options.map((opt, j) => (j === optIdx ? { ...opt, ...patch } : opt)),
        },
  );
}

export function VariableOptionsEditor({
  vars,
  setVars,
  variableNames,
  listId,
  showQty,
  optionDefaults = {},
}: {
  vars: VarDraft[];
  setVars: (next: VarDraft[] | ((prev: VarDraft[]) => VarDraft[])) => void;
  variableNames: string[];
  listId: string;
  showQty: boolean;
  optionDefaults?: VariableOptionDefaults;
}) {
  function syncOptionsFromText(idx: number, text: string) {
    const labels = text
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean);
    setVars((prev) =>
      prev.map((row, i) => {
        if (i !== idx) return row;
        const byLabel = new Map(row.options.map((o) => [o.label.toLowerCase(), o]));
        return {
          ...row,
          optionsText: text,
          options: labels.map((label) => {
            const existing = byLabel.get(label.toLowerCase());
            return existing ?? newVariableOption(label, optionDefaults);
          }),
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
        {showQty
          ? ", then set cost, price, stock, and SKU for each option in the table below."
          : "."}{" "}
        Names you save appear in the dropdown next time.
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
            <div className="stack" style={{ gap: "0.35rem" }}>
              <span className="muted" style={{ fontSize: "0.82rem" }}>
                {v.name || "Option"} details — opening stock totals automatically
              </span>
              <div className="table-wrap">
                <table className="data" style={{ fontSize: "0.82rem" }}>
                  <thead>
                    <tr>
                      <th>Option</th>
                      <th>Cost</th>
                      <th>Price</th>
                      <th>In stock</th>
                      <th>Low stock</th>
                      <th>Negative stock</th>
                      <th>SKU</th>
                    </tr>
                  </thead>
                  <tbody>
                    {v.options.map((o, oi) => (
                      <tr key={`${o.label}-${oi}`}>
                        <td>
                          <strong>{o.label}</strong>
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={fromCents(o.unitCost ?? 0) || ""}
                            placeholder="0.00"
                            onChange={(e) =>
                              setVars((prev) =>
                                updateOption(prev, idx, oi, {
                                  unitCost: Math.round(Math.max(0, Number(e.target.value) || 0) * 100),
                                }),
                              )
                            }
                            style={{ width: "5.5rem" }}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={fromCents(o.unitPrice ?? 0) || ""}
                            placeholder="0.00"
                            onChange={(e) =>
                              setVars((prev) =>
                                updateOption(prev, idx, oi, {
                                  unitPrice: Math.round(Math.max(0, Number(e.target.value) || 0) * 100),
                                }),
                              )
                            }
                            style={{ width: "5.5rem" }}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={o.qty}
                            onChange={(e) =>
                              setVars((prev) =>
                                updateOption(prev, idx, oi, {
                                  qty: Math.max(0, Number(e.target.value) || 0),
                                }),
                              )
                            }
                            style={{ width: "4.5rem" }}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={o.minStock ?? 0}
                            onChange={(e) =>
                              setVars((prev) =>
                                updateOption(prev, idx, oi, {
                                  minStock: Math.max(0, Number(e.target.value) || 0),
                                }),
                              )
                            }
                            style={{ width: "4.5rem" }}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={o.optimalStock ?? 0}
                            onChange={(e) =>
                              setVars((prev) =>
                                updateOption(prev, idx, oi, {
                                  optimalStock: Math.max(0, Number(e.target.value) || 0),
                                }),
                              )
                            }
                            style={{ width: "4.5rem" }}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            value={o.sku ?? ""}
                            placeholder="SKU"
                            onChange={(e) =>
                              setVars((prev) =>
                                updateOption(prev, idx, oi, { sku: e.target.value }),
                              )
                            }
                            style={{ width: "6.5rem" }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
