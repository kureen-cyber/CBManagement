/** Option on a product variable, with optional per-option stock quantity. */
export type VariableOption = {
  label: string;
  /** Units on hand for this option (e.g. colour). */
  qty: number;
};

export type ProductVariableDef = {
  name: string;
  options: VariableOption[];
};

/** Parse stored ProductVariable.options JSON (legacy string[] or {label,qty}[]). */
export function parseVariableOptions(raw: string | null | undefined): VariableOption[] {
  try {
    const v = JSON.parse(raw || "[]");
    if (!Array.isArray(v)) return [];
    return v
      .map((item) => {
        if (typeof item === "string") {
          const label = item.trim();
          return label ? { label, qty: 0 } : null;
        }
        if (item && typeof item === "object") {
          const label = String((item as { label?: unknown }).label ?? "").trim();
          if (!label) return null;
          const qtyRaw = Number((item as { qty?: unknown }).qty ?? 0);
          const qty = Number.isFinite(qtyRaw) ? Math.max(0, qtyRaw) : 0;
          return { label, qty };
        }
        return null;
      })
      .filter((o): o is VariableOption => Boolean(o));
  } catch {
    return [];
  }
}

export function optionLabels(options: VariableOption[]): string[] {
  return options.map((o) => o.label);
}

export function serializeVariableOptions(options: VariableOption[]): string {
  return JSON.stringify(
    options.map((o) => ({
      label: o.label,
      qty: Math.max(0, Number(o.qty) || 0),
    })),
  );
}

/** Sum option qtys across variables (used when at least one option has qty tracking). */
export function sumOptionStock(variables: ProductVariableDef[]): number {
  let sum = 0;
  let anyQty = false;
  for (const v of variables) {
    for (const o of v.options) {
      if (o.qty > 0) anyQty = true;
      sum += o.qty;
    }
  }
  return anyQty || variables.some((v) => v.options.length) ? sum : 0;
}

export function hasOptionStock(variables: ProductVariableDef[]): boolean {
  return variables.some((v) => v.options.length > 0);
}

/**
 * Resolve which option stock row a POS variant label maps to.
 * Labels look like "Colour: Red" or "Colour: Red, Size: L" — match first var:option pair.
 */
export function findOptionForVariantLabel(
  variables: ProductVariableDef[],
  variantLabel: string | null | undefined,
): { variableIndex: number; optionIndex: number; option: VariableOption } | null {
  const label = String(variantLabel || "").trim();
  if (!label || !variables.length) return null;

  for (let vi = 0; vi < variables.length; vi++) {
    const v = variables[vi]!;
    for (let oi = 0; oi < v.options.length; oi++) {
      const o = v.options[oi]!;
      const exact = `${v.name}: ${o.label}`;
      if (label === exact || label.startsWith(`${exact},`) || label.includes(exact)) {
        return { variableIndex: vi, optionIndex: oi, option: o };
      }
    }
  }

  // Fallback: bare option label match on first variable
  const first = variables[0];
  if (first) {
    for (let oi = 0; oi < first.options.length; oi++) {
      const o = first.options[oi]!;
      if (label === o.label || label.endsWith(`: ${o.label}`)) {
        return { variableIndex: 0, optionIndex: oi, option: o };
      }
    }
  }
  return null;
}

export function applyOptionQtyDelta(
  variables: ProductVariableDef[],
  variantLabel: string | null | undefined,
  delta: number,
): ProductVariableDef[] | null {
  const hit = findOptionForVariantLabel(variables, variantLabel);
  if (!hit) return null;
  const next = variables.map((v, vi) => ({
    name: v.name,
    options: v.options.map((o, oi) => {
      if (vi !== hit.variableIndex || oi !== hit.optionIndex) return { ...o };
      return { label: o.label, qty: Math.max(0, o.qty + delta) };
    }),
  }));
  return next;
}
