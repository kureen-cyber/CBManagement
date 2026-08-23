export const THEMES = ["light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

export const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
] as const;
export type LanguageCode = (typeof LANGUAGES)[number]["code"];

export const HOME_LAYOUTS = [
  { value: "RETAIL", label: "Retail", description: "POS-first tiles: sales, customers, stock" },
  {
    value: "RETAIL_SERVICE",
    label: "Retail & service",
    description: "Mixed home: POS plus jobs, quotes, and invoices",
  },
] as const;
export type HomeLayout = (typeof HOME_LAYOUTS)[number]["value"];

export const DEFAULT_RECEIPT_FOOTER = "Thank you for your business";

/** Max logo payload size (~300KB raw ≈ ~400KB base64). */
export const RECEIPT_LOGO_MAX_BYTES = 300_000;
/** Max letterhead payload size (~800KB raw). */
export const LETTERHEAD_MAX_BYTES = 800_000;

export type CompanyBranding = {
  name: string;
  receiptHeader?: string | null;
  businessLogoData?: string | null;
  receiptLogoData?: string | null;
  letterheadData?: string | null;
};

export function resolveBusinessLogo(company: CompanyBranding): string | null {
  return company.businessLogoData ?? company.receiptLogoData ?? null;
}

export function parseTheme(value: unknown): Theme {
  return value === "dark" ? "dark" : "light";
}

export function parseLanguage(value: unknown): LanguageCode {
  const v = String(value || "en").toLowerCase();
  if (v === "es" || v === "fr") return v;
  return "en";
}

export function parseHomeLayout(value: unknown): HomeLayout {
  return value === "RETAIL_SERVICE" ? "RETAIL_SERVICE" : "RETAIL";
}

export function receiptHeaderText(company: {
  name: string;
  receiptHeader?: string | null;
}): string {
  const custom = String(company.receiptHeader || "").trim();
  return custom || company.name || "CBManagement";
}

export function receiptFooterText(company: {
  receiptFooter?: string | null;
}): string {
  const custom = String(company.receiptFooter || "").trim();
  return custom || DEFAULT_RECEIPT_FOOTER;
}

type ReceiptLabels = {
  salesReceipt: string;
  receiptNo: string;
  date: string;
  register: string;
  customer: string;
  walkIn: string;
  payment: string;
  item: string;
  qty: string;
  total: string;
  each: string;
  subtotal: string;
  vat: string;
  totalPaid: string;
  comments: string;
};

const RECEIPT_LABELS: Record<LanguageCode, ReceiptLabels> = {
  en: {
    salesReceipt: "Sales receipt",
    receiptNo: "Receipt #",
    date: "Date",
    register: "Register",
    customer: "Customer",
    walkIn: "Walk-in",
    payment: "Payment",
    item: "Item",
    qty: "Qty",
    total: "Total",
    each: "each",
    subtotal: "Subtotal",
    vat: "VAT",
    totalPaid: "Total paid",
    comments: "Comments",
  },
  es: {
    salesReceipt: "Recibo de venta",
    receiptNo: "Recibo #",
    date: "Fecha",
    register: "Caja",
    customer: "Cliente",
    walkIn: "Cliente ocasional",
    payment: "Pago",
    item: "Artículo",
    qty: "Cant.",
    total: "Total",
    each: "c/u",
    subtotal: "Subtotal",
    vat: "IVA",
    totalPaid: "Total pagado",
    comments: "Comentarios",
  },
  fr: {
    salesReceipt: "Reçu de vente",
    receiptNo: "Reçu #",
    date: "Date",
    register: "Caisse",
    customer: "Client",
    walkIn: "Client de passage",
    payment: "Paiement",
    item: "Article",
    qty: "Qté",
    total: "Total",
    each: "chacun",
    subtotal: "Sous-total",
    vat: "TVA",
    totalPaid: "Total payé",
    comments: "Commentaires",
  },
};

export function receiptLabels(language: unknown): ReceiptLabels {
  return RECEIPT_LABELS[parseLanguage(language)];
}

