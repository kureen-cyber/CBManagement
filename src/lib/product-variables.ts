/** Option on a product variable, with per-option stock and pricing. */
export type VariableOption = {
  label: string;
  /** Units on hand for this option (e.g. colour). */
  qty: number;
  /** Cost in cents; 0 = inherit product unit cost. */
  unitCost?: number;
  /** Price in cents; 0 = inherit product price / variable price rules. */
  unitPrice?: number;
  /** Low-stock threshold for this option. */
  minStock?: number;
  /** Target / optimal stock level for replenishment. */
  optimalStock?: number;
  sku?: string;
};

export type VariableOptionDefaults = {
  unitCost?: number;
  unitPrice?: number;
  minStock?: number;
  optimalStock?: number;
};

export type ProductVariableDef = {
  name: string;
  options: VariableOption[];
};

function numOr(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function nonNeg(value: unknown, fallback = 0): number {
  return Math.max(0, numOr(value, fallback));
}

export function coerceVariableOption(
  item: unknown,
  defaults: VariableOptionDefaults = {},
): VariableOption | null {
  if (typeof item === "string") {
    const label = item.trim();
    return label
      ? {
          label,
          qty: 0,
          unitCost: defaults.unitCost ?? 0,
          unitPrice: defaults.unitPrice ?? 0,
          minStock: defaults.minStock ?? 0,
          optimalStock: defaults.optimalStock ?? 0,
          sku: "",
        }
      : null;
  }
  if (item && typeof item === "object") {
    const raw = item as Record<string, unknown>;
    const label = String(raw.label ?? "").trim();
    if (!label) return null;
    return {
      label,
      qty: nonNeg(raw.qty),
      unitCost: nonNeg(raw.unitCost, defaults.unitCost ?? 0),
      unitPrice: nonNeg(raw.unitPrice, defaults.unitPrice ?? 0),
      minStock: nonNeg(raw.minStock, defaults.minStock ?? 0),
      optimalStock: nonNeg(raw.optimalStock, defaults.optimalStock ?? 0),
      sku: String(raw.sku ?? "").trim(),
    };
  }
  return null;
}

/** Parse stored ProductVariable.options JSON (legacy string[] or object[]). */
export function parseVariableOptions(
  raw: string | null | undefined,
  defaults: VariableOptionDefaults = {},
): VariableOption[] {
  try {
    const v = JSON.parse(raw || "[]");
    if (!Array.isArray(v)) return [];
    return v
      .map((item) => coerceVariableOption(item, defaults))
      .filter((o): o is VariableOption => Boolean(o));
  } catch {
    return [];
  }
}

export function optionLabels(options: VariableOption[]): string[] {
  return options.map((o) => o.label);
}

export function newVariableOption(
  label: string,
  defaults: VariableOptionDefaults = {},
): VariableOption {
  return {
    label,
    qty: 0,
    unitCost: defaults.unitCost ?? 0,
    unitPrice: defaults.unitPrice ?? 0,
    minStock: defaults.minStock ?? 0,
    optimalStock: defaults.optimalStock ?? 0,
    sku: "",
  };
}

export function serializeVariableOptions(options: VariableOption[]): string {
  return JSON.stringify(
    options.map((o) => ({
      label: o.label,
      qty: nonNeg(o.qty),
      unitCost: nonNeg(o.unitCost),
      unitPrice: nonNeg(o.unitPrice),
      minStock: nonNeg(o.minStock),
      optimalStock: nonNeg(o.optimalStock),
      sku: String(o.sku ?? "").trim(),
    })),
  );
}

/**
 * Fill blank option SKUs as `{parentSku}-01`, `{parentSku}-02`, …
 * Manual SKUs are kept. `used` is updated so assignments stay unique.
 */
export function assignOptionSkus(
  parentSku: string,
  variables: ProductVariableDef[],
  used: Set<string>,
): ProductVariableDef[] {
  const base = String(parentSku || "SKU").trim() || "SKU";
  const parentKey = base.toUpperCase();
  used.add(parentKey);

  return variables.map((v) => ({
    ...v,
    options: v.options.map((o) => {
      const existing = String(o.sku ?? "").trim();
      if (existing) {
        used.add(existing.toUpperCase());
        return { ...o, sku: existing };
      }
      let n = 1;
      let next = "";
      do {
        next = `${base}-${String(n).padStart(2, "0")}`;
        n += 1;
      } while (used.has(next.toUpperCase()));
      used.add(next.toUpperCase());
      return { ...o, sku: next };
    }),
  }));
}

/** Sum option qtys on the primary (first) variable — the stock-keeping dimension. */
export function sumOptionStock(variables: ProductVariableDef[]): number {
  const primary = variables[0];
  if (!primary?.options.length) return 0;
  return primary.options.reduce((s, o) => s + nonNeg(o.qty), 0);
}

export function hasOptionStock(variables: ProductVariableDef[]): boolean {
  return variables.some((v) => v.options.length > 0);
}

export function resolveOptionUnitCost(option: VariableOption, productUnitCost: number): number {
  const cost = nonNeg(option.unitCost);
  return cost > 0 ? cost : productUnitCost;
}

/**
 * Unit cost in cents for a sold line: prefer the matched variant option cost,
 * otherwise the product cost, otherwise a qty-weighted average of option costs.
 */
export function resolveSaleUnitCost(
  product: { unitCost: number },
  variables: ProductVariableDef[],
  variantLabel?: string | null,
): number {
  const label = String(variantLabel || "").trim();
  if (label) {
    const hit = findOptionForVariantLabel(variables, label);
    if (hit) return resolveOptionUnitCost(hit.option, product.unitCost);
  }
  return effectiveProductUnitCost(product, variables);
}

/** Best available unit cost in cents when no specific variant is known. */
export function effectiveProductUnitCost(
  product: { unitCost: number },
  variables: ProductVariableDef[],
): number {
  if (product.unitCost > 0) return product.unitCost;

  const primary = variables[0];
  if (!primary?.options.length) return 0;

  let weighted = 0;
  let qtySum = 0;
  const positiveCosts: number[] = [];
  for (const o of primary.options) {
    const cost = nonNeg(o.unitCost);
    if (cost <= 0) continue;
    positiveCosts.push(cost);
    const qty = nonNeg(o.qty);
    if (qty > 0) {
      weighted += cost * qty;
      qtySum += qty;
    }
  }
  if (qtySum > 0) return Math.round(weighted / qtySum);
  if (positiveCosts.length) {
    return Math.round(positiveCosts.reduce((s, c) => s + c, 0) / positiveCosts.length);
  }
  return 0;
}

/**
 * Resolve sell price for an option. Returns null when price must be entered at POS.
 */
export function resolveOptionUnitPrice(
  option: VariableOption,
  productUnitPrice: number,
  variablePrice: boolean,
): number | null {
  const optionPrice = nonNeg(option.unitPrice);
  if (optionPrice > 0) return optionPrice;
  if (variablePrice) return null;
  return productUnitPrice;
}

export function resolveOptionMinStock(option: VariableOption, productMinStock: number): number {
  const min = nonNeg(option.minStock);
  return min > 0 ? min : productMinStock;
}

export function isOptionLowStock(
  option: VariableOption,
  productMinStock: number,
): boolean {
  const threshold = resolveOptionMinStock(option, productMinStock);
  return threshold > 0 && option.qty <= threshold;
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
      return { ...o, qty: Math.max(0, o.qty + delta) };
    }),
  }));
  return next;
}

/** Parse variant label from a sale line description like "Shirt (Colour: Red)". */
export function parseVariantFromDescription(
  productName: string,
  description: string,
): string | undefined {
  let desc = String(description || "").trim();
  if (desc.startsWith("Refund: ")) desc = desc.slice("Refund: ".length).trim();
  const prefix = `${productName} (`;
  if (desc.startsWith(prefix) && desc.endsWith(")")) {
    return desc.slice(prefix.length, -1);
  }
  return undefined;
}
