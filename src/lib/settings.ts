export const THEME_FAMILIES = ["red-white-black", "yellow-parrot"] as const;
export type ThemeFamily = (typeof THEME_FAMILIES)[number];

export const THEME_MODES = ["light", "dark"] as const;
export type ThemeMode = (typeof THEME_MODES)[number];

/** Stored on Company.theme — family + optional dark suffix. */
export const THEMES = [
  "red-white-black",
  "red-white-black-dark",
  "yellow-parrot",
  "yellow-parrot-dark",
] as const;
export type Theme = (typeof THEMES)[number];

export const DEFAULT_THEME: Theme = "red-white-black";

export const THEME_FAMILY_LABELS: Record<ThemeFamily, string> = {
  "red-white-black": "Red, white & black",
  "yellow-parrot": "Green & yellow",
};

export const INVENTORY_VIEW_MODES = ["card", "list"] as const;
export type InventoryViewMode = (typeof INVENTORY_VIEW_MODES)[number];

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
/** Max company stamp payload size (~300KB raw). */
export const COMPANY_STAMP_MAX_BYTES = 300_000;
/** Max product photo payload size (~500KB raw). */
export const PRODUCT_IMAGE_MAX_BYTES = 500_000;
/** Max expense / job receipt upload (~800KB raw). */
export const RECEIPT_UPLOAD_MAX_BYTES = 800_000;

/** Default palette when assigning category colours. */
export const CATEGORY_COLOR_PALETTE = [
  "#C41E3A",
  "#0A6B6E",
  "#C45C26",
  "#1F7A4D",
  "#5B4FCF",
  "#B45309",
  "#00843D",
  "#2563EB",
] as const;

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

/** Letterhead takes precedence — when present, logo is omitted (letterhead may already include it). */
export function resolveDocumentHeaderImages(company: CompanyBranding): {
  letterheadData: string | null;
  logoData: string | null;
} {
  if (company.letterheadData) {
    return { letterheadData: company.letterheadData, logoData: null };
  }
  return { letterheadData: null, logoData: resolveBusinessLogo(company) };
}

export function themeFamily(theme: Theme): ThemeFamily {
  return theme.startsWith("yellow-parrot") ? "yellow-parrot" : "red-white-black";
}

export function themeMode(theme: Theme): ThemeMode {
  return theme.endsWith("-dark") ? "dark" : "light";
}

export function composeTheme(family: ThemeFamily, mode: ThemeMode): Theme {
  if (family === "yellow-parrot") {
    return mode === "dark" ? "yellow-parrot-dark" : "yellow-parrot";
  }
  return mode === "dark" ? "red-white-black-dark" : "red-white-black";
}

export function parseTheme(value: unknown): Theme {
  const v = String(value || DEFAULT_THEME).toLowerCase();
  if (v === "light") return "red-white-black";
  if (v === "dark") return "red-white-black-dark";
  if (THEMES.includes(v as Theme)) return v as Theme;
  return DEFAULT_THEME;
}

/** Browser color-scheme hint. */
export function themeColorScheme(theme: Theme): "light" | "dark" {
  return themeMode(theme) === "dark" ? "dark" : "light";
}

export function parseInventoryViewMode(value: unknown): InventoryViewMode {
  return value === "list" ? "list" : "card";
}

export function parseLanguage(value: unknown): LanguageCode {
  const v = String(value || "en").toLowerCase();
  if (v === "es" || v === "fr") return v;
  return "en";
}

export function parseHomeLayout(value: unknown): HomeLayout {
  return value === "RETAIL_SERVICE" ? "RETAIL_SERVICE" : "RETAIL";
}

export function parseCategoryColor(value: unknown): string | null {
  const v = String(value || "").trim();
  if (!/^#[0-9A-Fa-f]{6}$/.test(v)) return null;
  return v.toUpperCase();
}

export function nextCategoryColor(existing: string[]): string {
  const used = new Set(existing.map((c) => c.toUpperCase()));
  for (const color of CATEGORY_COLOR_PALETTE) {
    if (!used.has(color)) return color;
  }
  return CATEGORY_COLOR_PALETTE[existing.length % CATEGORY_COLOR_PALETTE.length]!;
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

export type ReceiptBusinessDetails = {
  address?: string;
  contactNumber?: string;
  email?: string;
  registrationNumber?: string;
  stampData?: string;
};

export function visibleReceiptBusinessDetails(company: {
  businessAddress?: string | null;
  businessContactNumber?: string | null;
  businessEmail?: string | null;
  companyRegistrationNumber?: string | null;
  companyStampData?: string | null;
  receiptShowBusinessAddress?: boolean;
  receiptShowContactNumber?: boolean;
  receiptShowBusinessEmail?: boolean;
  receiptShowRegistrationNumber?: boolean;
  receiptShowCompanyStamp?: boolean;
}): ReceiptBusinessDetails {
  const details: ReceiptBusinessDetails = {};
  if (company.receiptShowBusinessAddress && company.businessAddress?.trim()) {
    details.address = company.businessAddress.trim();
  }
  if (company.receiptShowContactNumber && company.businessContactNumber?.trim()) {
    details.contactNumber = company.businessContactNumber.trim();
  }
  if (company.receiptShowBusinessEmail && company.businessEmail?.trim()) {
    details.email = company.businessEmail.trim();
  }
  if (company.receiptShowRegistrationNumber && company.companyRegistrationNumber?.trim()) {
    details.registrationNumber = company.companyRegistrationNumber.trim();
  }
  if (company.receiptShowCompanyStamp && company.companyStampData) {
    details.stampData = company.companyStampData;
  }
  return details;
}
