export function toCents(dollars: number): number {
  return Math.round(dollars * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

export function formatTTD(cents: number): string {
  const value = fromCents(cents);
  return `TT$${value.toLocaleString("en-TT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function sellingPriceFromMarkup(costCents: number, markupPct: number): number {
  return Math.round(costCents * (1 + markupPct / 100));
}
