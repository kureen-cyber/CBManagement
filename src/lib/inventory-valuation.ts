import {
  effectiveProductUnitCost,
  findOptionForVariantLabel,
  hasOptionStock,
  resolveOptionUnitCost,
  type ProductVariableDef,
} from "@/lib/product-variables";

export type ValuedProduct = {
  id: string;
  stockQty: number;
  unitCost: number;
  variables: ProductVariableDef[];
};

export type InventorySaleLine = {
  productId: string | null;
  quantity: number;
  variantLabel: string | null;
  soldAt: Date;
  isRefund: boolean;
  isService: boolean;
};

export type InventoryStockMove = {
  productId: string;
  quantity: number;
  createdAt: Date;
  type: string;
  notes: string | null;
};

function cloneProduct(p: ValuedProduct): ValuedProduct {
  return {
    id: p.id,
    stockQty: p.stockQty,
    unitCost: p.unitCost,
    variables: p.variables.map((v) => ({
      name: v.name,
      options: v.options.map((o) => ({ ...o })),
    })),
  };
}

function applyQtyDelta(product: ValuedProduct, variantLabel: string | null, delta: number) {
  if (Math.abs(delta) < 1e-9) return;
  const label = String(variantLabel || "").trim();
  if (hasOptionStock(product.variables)) {
    const hit = label ? findOptionForVariantLabel(product.variables, label) : null;
    if (hit) {
      const opt = product.variables[hit.variableIndex]!.options[hit.optionIndex]!;
      opt.qty += delta;
      return;
    }
    const primary = product.variables[0];
    if (primary?.options.length === 1) {
      primary.options[0]!.qty += delta;
      return;
    }
  }
  product.stockQty += delta;
}

function extractMoveVariant(notes: string | null | undefined): string | null {
  const n = String(notes || "");
  const matches = [...n.matchAll(/\(([^)]+)\)/g)];
  for (let i = matches.length - 1; i >= 0; i--) {
    const inner = String(matches[i]![1] || "").trim();
    if (inner.includes(":") && !/sum of variable/i.test(inner)) return inner;
  }
  return null;
}

function isInboundMove(type: string, quantity: number) {
  if (quantity <= 0) return false;
  const t = type.toUpperCase();
  // OPENING is already in current on-hand qty. Reversing it zeros items without
  // variants on the income statement while variant rows (updated in place) stay.
  return t === "PURCHASE" || t === "ADJUSTMENT";
}

function isOutboundAdjust(type: string, quantity: number) {
  if (quantity >= 0) return false;
  const t = type.toUpperCase();
  return t === "ADJUSTMENT";
}

function unitCostCents(product: ValuedProduct): number {
  if (product.unitCost > 0) return product.unitCost;
  return effectiveProductUnitCost(product, product.variables);
}

/**
 * Prefer the product unit cost; if it was never set, use the latest movement cost.
 */
export function fillUnitCostFromMovements(
  products: ValuedProduct[],
  moves: { productId: string; unitCost: number; createdAt: Date }[],
): ValuedProduct[] {
  const lastCost = new Map<string, { cost: number; at: number }>();
  for (const m of moves) {
    if (m.unitCost <= 0) continue;
    const at = m.createdAt.getTime();
    const prev = lastCost.get(m.productId);
    if (!prev || at >= prev.at) lastCost.set(m.productId, { cost: m.unitCost, at });
  }
  return products.map((p) => {
    if (p.unitCost > 0) return p;
    const fromMove = lastCost.get(p.id)?.cost ?? 0;
    return fromMove > 0 ? { ...p, unitCost: fromMove } : p;
  });
}

/**
 * Sum of on-hand stock × unit cost for every tracked item:
 * each variant row uses its own cost; items without variants use the product unit cost.
 */
export function onHandInventoryValueCents(products: ValuedProduct[]): number {
  let value = 0;
  for (const p of products) {
    const primary = p.variables[0];
    const productCost = unitCostCents(p);
    if (primary?.options.length) {
      let optionQty = 0;
      let optionValue = 0;
      for (const o of primary.options) {
        const qty = Math.max(0, o.qty);
        if (qty <= 0) continue;
        optionQty += qty;
        optionValue += Math.round(qty * resolveOptionUnitCost(o, productCost));
      }
      if (optionQty > 0) {
        value += optionValue;
      } else {
        const qty = Math.max(0, p.stockQty);
        if (qty > 0 && productCost > 0) value += Math.round(qty * productCost);
      }
    } else {
      const qty = Math.max(0, p.stockQty);
      if (qty > 0 && productCost > 0) value += Math.round(qty * productCost);
    }
  }
  return value;
}

/**
 * Reconstruct inventory value at `asOf` from current on-hand variant quantities:
 * add back goods sold after that instant, undo stock received after it.
 * That way beginning inventory includes items already sold in the month.
 */
export function inventoryValueAsOfCents(
  products: ValuedProduct[],
  asOf: Date,
  sales: InventorySaleLine[],
  moves: InventoryStockMove[],
): number {
  const byId = new Map(products.map((p) => [p.id, cloneProduct(p)]));

  for (const line of sales) {
    if (!line.productId || line.isService) continue;
    if (line.soldAt < asOf) continue;
    const product = byId.get(line.productId);
    if (!product) continue;
    const sign = line.isRefund ? -1 : 1;
    applyQtyDelta(product, line.variantLabel, line.quantity * sign);
  }

  for (const move of moves) {
    if (move.createdAt < asOf) continue;
    const product = byId.get(move.productId);
    if (!product) continue;
    const variant = extractMoveVariant(move.notes);
    if (isInboundMove(move.type, move.quantity)) {
      applyQtyDelta(product, variant, -move.quantity);
    } else if (isOutboundAdjust(move.type, move.quantity)) {
      applyQtyDelta(product, variant, -move.quantity);
    }
  }

  return onHandInventoryValueCents([...byId.values()]);
}
