import { sellingPriceFromMarkup } from "@/lib/money";

export type QuotationCostBuckets = {
  labourCost: number;
  materialsCost: number;
  equipmentCost: number;
  transportCost: number;
  markupPct: number;
  fixedPrice: boolean;
  total: number;
};

/** Client-facing line amounts with markup embedded (no separate markup row). */
export function quotationClientLines(
  quote: QuotationCostBuckets,
): { label: string; amount: number }[] {
  const buckets = [
    { label: "Labour", cost: quote.labourCost },
    { label: "Materials", cost: quote.materialsCost },
    { label: "Equipment", cost: quote.equipmentCost },
    { label: "Transport", cost: quote.transportCost },
  ].filter((b) => b.cost > 0);

  if (!buckets.length) {
    return quote.total > 0 ? [{ label: "Services", amount: quote.total }] : [];
  }

  if (quote.fixedPrice) {
    const costSum = buckets.reduce((s, b) => s + b.cost, 0);
    if (costSum <= 0) return [{ label: "Services", amount: quote.total }];
    const lines = buckets.map((b, i) => {
      if (i === buckets.length - 1) return { label: b.label, amount: 0 };
      return {
        label: b.label,
        amount: Math.round(quote.total * (b.cost / costSum)),
      };
    });
    const allocated = lines.slice(0, -1).reduce((s, l) => s + l.amount, 0);
    lines[lines.length - 1]!.amount = Math.max(0, quote.total - allocated);
    return lines;
  }

  const pct = Number(quote.markupPct) || 0;
  return buckets.map((b) => ({
    label: b.label,
    amount: sellingPriceFromMarkup(b.cost, pct),
  }));
}

/** Selling total from cost buckets + markup (or fixed total). */
export function quotationSellTotal(
  labour: number,
  materials: number,
  equipment: number,
  transport: number,
  markupPct: number,
  fixedPrice: boolean,
  fixedAmount?: number,
): number {
  if (fixedPrice) {
    const fixed = Number(fixedAmount) || 0;
    if (fixed > 0) return fixed;
  }
  const lines = quotationClientLines({
    labourCost: labour,
    materialsCost: materials,
    equipmentCost: equipment,
    transportCost: transport,
    markupPct: fixedPrice ? 0 : markupPct,
    fixedPrice: false,
    total: 0,
  });
  return lines.reduce((s, l) => s + l.amount, 0);
}
