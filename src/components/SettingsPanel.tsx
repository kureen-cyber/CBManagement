"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useState, useTransition } from "react";
import {
  DEFAULT_RECEIPT_FOOTER,
  HOME_LAYOUTS,
  LANGUAGES,
  THEME_FAMILY_LABELS,
  THEME_FAMILIES,
  THEME_MODES,
  composeTheme,
  themeFamily,
  themeMode,
  type HomeLayout,
  type InventoryViewMode,
  type LanguageCode,
  type Theme,
  type ThemeFamily,
  type ThemeMode,
  CATEGORY_COLOR_PALETTE,
} from "@/lib/settings";
import {
  updateGeneralSettings,
  updatePosRegisters,
  updateInventoryViewMode,
  updatePrinterSettings,
  updateReceiptSettings,
  updateTaxSettings,
  updateFeatureSettings,
  addPaymentType,
  togglePaymentType,
  deletePaymentType,
  addInventoryCategory,
  deleteInventoryCategory,
  updateInventoryCategoryColor,
  addDiscountPreset,
  updateDiscountPreset,
  deleteDiscountPreset,
  createStore,
} from "@/app/actions/settings";
import {
  FREE_RETAIL_MAX_POS_REGISTERS,
  FREE_RETAIL_MAX_STORES,
  FREE_TIER_MAX_TRANSACTION_DAYS,
  maxPosRegistersForTier,
  PLAN_TIER_LABELS,
  STANDARD_MAX_POS_REGISTERS,
  STANDARD_MAX_STORES,
  type PlanTier,
} from "@/lib/tier";
import { maxStoresForTier } from "@/lib/store";
import { AddEntityTab } from "@/components/AddEntityTab";
import { Panel } from "@/components/ui";

type Tab =
  | "general"
  | "taxes"
  | "printers"
  | "receipts"
  | "payments"
  | "discounts"
  | "pos";

type PosSubTab = "registers" | "inventory-view" | "categories" | "features";

const TABS: { id: Tab; label: string }[] = [
  { id: "general", label: "General" },
  { id: "taxes", label: "Taxes" },
  { id: "printers", label: "Printers" },
  { id: "receipts", label: "Receipts" },
  { id: "payments", label: "Payment types" },
  { id: "discounts", label: "Discounts" },
  { id: "pos", label: "POS" },
];

function parsePosSubTab(value: string | null): PosSubTab {
  if (
    value === "inventory-view" ||
    value === "categories" ||
    value === "features"
  ) {
    return value;
  }
  return "registers";
}

export function SettingsPanel({
  businessName,
  theme,
  language,
  homeLayout,
  taxEnabled,
  vatRate,
  receiptPrinting,
  printerName,
  receiptLogoData,
  businessLogoData,
  letterheadData,
  receiptHeader,
  receiptFooter,
  receiptShowCustomer,
  receiptShowComments,
  receiptHoneyPersons = false,
  receiptShowApiaryNumber = false,
  receiptApiaryNumber = null,
  receiptShowOprNumber = false,
  receiptOprNumber = null,
  receiptLanguage,
  featureOpenTickets,
  featureLowStockEmail,
  featureOutOfStockWarn,
  paymentTypes,
  stores = [],
  activeStoreId: initialActiveStoreId = null,
  inventoryCategories,
  discountPresets = [],
  planTier,
  posRegisters,
  canEditDiscounts = true,
}: {
  businessName: string;
  theme: Theme;
  language: LanguageCode;
  homeLayout: HomeLayout;
  taxEnabled: boolean;
  vatRate: number;
  receiptPrinting: boolean;
  printerName: string | null;
  receiptLogoData: string | null;
  businessLogoData: string | null;
  letterheadData: string | null;
  receiptHeader: string | null;
  receiptFooter: string | null;
  receiptShowCustomer: boolean;
  receiptShowComments: boolean;
  receiptHoneyPersons?: boolean;
  receiptShowApiaryNumber?: boolean;
  receiptApiaryNumber?: string | null;
  receiptShowOprNumber?: boolean;
  receiptOprNumber?: string | null;
  receiptLanguage: LanguageCode;
  featureOpenTickets: boolean;
  featureLowStockEmail: boolean;
  featureOutOfStockWarn: boolean;
  paymentTypes: { id: string; code: string; label: string; active: boolean }[];
  stores?: { id: string; name: string; inventoryViewMode: InventoryViewMode }[];
  activeStoreId?: string | null;
  inventoryCategories: {
    id: string;
    name: string;
    color: string | null;
    storeId: string | null;
  }[];
  discountPresets?: { id: string; name: string; percent: number; active: boolean }[];
  planTier: PlanTier;
  posRegisters: { id: string; name: string; storeId: string | null }[];
  canEditDiscounts?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawTab = searchParams.get("tab");
  // Legacy ?tab=categories → POS → Categories; ?tab=features → POS → Features
  const initialTab: Tab =
    rawTab === "categories" || rawTab === "features"
      ? "pos"
      : TABS.some((t) => t.id === (rawTab as Tab))
        ? (rawTab as Tab)
        : "general";
  const [tab, setTab] = useState<Tab>(initialTab);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(receiptLogoData);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [businessLogoPreview, setBusinessLogoPreview] = useState<string | null>(businessLogoData);
  const [removeBusinessLogo, setRemoveBusinessLogo] = useState(false);
  const [letterheadPreview, setLetterheadPreview] = useState<string | null>(letterheadData);
  const [removeLetterhead, setRemoveLetterhead] = useState(false);
  const initialPosSub =
    rawTab === "categories"
      ? "categories"
      : rawTab === "features"
        ? "features"
        : parsePosSubTab(searchParams.get("posSub"));
  const [posSubTab, setPosSubTab] = useState<PosSubTab>(initialPosSub);
  const [selectedStoreId, setSelectedStoreId] = useState<string>(
    initialActiveStoreId || stores[0]?.id || "",
  );
  const [newStoreName, setNewStoreName] = useState("");
  const [showAddStore, setShowAddStore] = useState(false);
  const maxRegisters = maxPosRegistersForTier(planTier);
  const maxStores = maxStoresForTier(planTier);
  const activeStore = stores.find((s) => s.id === selectedStoreId) || stores[0];
  const storeRegisters = posRegisters.filter((r) => r.storeId === activeStore?.id);
  const storeCategories = inventoryCategories.filter((c) => c.storeId === activeStore?.id);
  const inventoryViewMode = activeStore?.inventoryViewMode ?? "card";
  const [registerCount, setRegisterCount] = useState(
    Math.max(storeRegisters.length || 1, 1),
  );
  const [newCategoryColor, setNewCategoryColor] = useState<string>(CATEGORY_COLOR_PALETTE[0]!);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [appearanceFamily, setAppearanceFamily] = useState<ThemeFamily>(() => themeFamily(theme));
  const [appearanceMode, setAppearanceMode] = useState<ThemeMode>(() => themeMode(theme));
  const composedTheme = composeTheme(appearanceFamily, appearanceMode);

  useEffect(() => {
    if (!removeLogo) setLogoPreview(receiptLogoData);
  }, [receiptLogoData, removeLogo]);

  useEffect(() => {
    if (!removeBusinessLogo) setBusinessLogoPreview(businessLogoData);
  }, [businessLogoData, removeBusinessLogo]);

  useEffect(() => {
    if (!removeLetterhead) setLetterheadPreview(letterheadData);
  }, [letterheadData, removeLetterhead]);

  useEffect(() => {
    setRegisterCount(Math.max(storeRegisters.length || 1, 1));
  }, [storeRegisters.length, selectedStoreId]);

  useEffect(() => {
    if (initialActiveStoreId && stores.some((s) => s.id === initialActiveStoreId)) {
      setSelectedStoreId(initialActiveStoreId);
    } else if (stores[0] && !stores.some((s) => s.id === selectedStoreId)) {
      setSelectedStoreId(stores[0].id);
    }
  }, [stores, initialActiveStoreId]); // eslint-disable-line react-hooks/exhaustive-deps

  function selectTab(next: Tab) {
    setTab(next);
    setSaved(null);
    setError(null);
    if (next === "pos") {
      router.replace(`/settings?tab=pos&posSub=${posSubTab}`, { scroll: false });
    } else {
      router.replace(`/settings?tab=${next}`, { scroll: false });
    }
  }

  function selectPosSub(next: PosSubTab) {
    setPosSubTab(next);
    setSaved(null);
    setError(null);
    router.replace(`/settings?tab=pos&posSub=${next}`, { scroll: false });
  }

  function onGeneral(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (removeBusinessLogo) fd.set("removeBusinessLogo", "on");
    if (removeLetterhead) fd.set("removeLetterhead", "on");
    startTransition(async () => {
      setError(null);
      const result = await updateGeneralSettings(fd);
      if (result && "error" in result && result.error) {
        setError(result.error);
        return;
      }
      setSaved("General settings saved");
      setRemoveBusinessLogo(false);
      setRemoveLetterhead(false);
      router.refresh();
    });
  }

  function onTaxes(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      await updateTaxSettings(fd);
      setSaved("Tax settings saved");
      router.refresh();
    });
  }

  function onPrinters(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      await updatePrinterSettings(fd);
      setSaved("Printer settings saved");
      router.refresh();
    });
  }

  function onReceipts(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    if (removeLogo) fd.set("removeLogo", "on");
    startTransition(async () => {
      const result = await updateReceiptSettings(fd);
      if (result && "error" in result && result.error) {
        setError(result.error);
        return;
      }
      setRemoveLogo(false);
      setSaved("Receipt settings saved");
      router.refresh();
    });
  }

  function onFeatures(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      await updateFeatureSettings(fd);
      setSaved("Feature settings saved");
      router.refresh();
    });
  }

  function onAddPayment(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await addPaymentType(fd);
      if (result && "error" in result && result.error) {
        setError(result.error);
        return;
      }
      (e.target as HTMLFormElement).reset();
      setSaved("Payment type added");
      router.refresh();
    });
  }

  function onAddCategory(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    if (activeStore?.id) fd.set("storeId", activeStore.id);
    startTransition(async () => {
      const result = await addInventoryCategory(fd);
      if (result && "error" in result && result.error) {
        setError(result.error);
        return;
      }
      (e.target as HTMLFormElement).reset();
      setSaved("Category added");
      router.refresh();
    });
  }

  function onPosRegisters(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    if (activeStore?.id) fd.set("storeId", activeStore.id);
    startTransition(async () => {
      const result = await updatePosRegisters(fd);
      if (result && "error" in result && result.error) {
        setError(result.error);
        return;
      }
      setSaved("POS settings saved");
      router.refresh();
    });
  }

  function onInventoryViewMode(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    if (activeStore?.id) fd.set("storeId", activeStore.id);
    startTransition(async () => {
      await updateInventoryViewMode(fd);
      setSaved("Inventory view saved");
      router.refresh();
    });
  }

  function onAddStore(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData();
    fd.set("name", newStoreName);
    fd.set("sourceStoreId", stores[0]?.id || activeStore?.id || "");
    startTransition(async () => {
      const result = await createStore(fd);
      if (result && "error" in result && result.error) {
        setError(result.error);
        return;
      }
      setNewStoreName("");
      setShowAddStore(false);
      if (result && "storeId" in result && result.storeId) {
        setSelectedStoreId(result.storeId);
      }
      setSaved("Store added — started from your pilot store (changes stay local)");
      router.refresh();
    });
  }

  function onAddDiscount(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await addDiscountPreset(fd);
      if (result && "error" in result && result.error) {
        setError(result.error);
        return;
      }
      setSaved("Discount added");
      (e.target as HTMLFormElement).reset();
      router.refresh();
    });
  }

  const headerDefault = receiptHeader?.trim() || businessName;
  const footerDefault = receiptFooter?.trim() || DEFAULT_RECEIPT_FOOTER;
  const registerDefaults = Array.from({ length: registerCount }, (_, i) => {
    if (storeRegisters[i]?.name) return storeRegisters[i]!.name;
    if (i === 0) return "Front counter";
    if (i === 1) return "";
    return "";
  });

  return (
    <div className="stack">
      <div className="settings-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={tab === t.id ? "settings-tab active" : "settings-tab"}
            onClick={() => selectTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {saved ? <div className="badge badge-ok">{saved}</div> : null}
      {error ? <div className="badge badge-danger">{error}</div> : null}

      {tab === "general" ? (
        <Panel style={{ padding: "1.25rem" }}>
          <form className="stack" encType="multipart/form-data" onSubmit={onGeneral}>
            <h2 style={{ margin: 0, fontSize: "1.15rem" }}>Business</h2>
            <label className="field">
              Business name
              <input
                name="businessName"
                type="text"
                defaultValue={businessName}
                required
                placeholder="Your business name"
              />
            </label>
            <div className="info-banner">
              Plan: <strong>{PLAN_TIER_LABELS[planTier]}</strong>
              {planTier === "FREE_RETAIL"
                ? ` · up to ${FREE_RETAIL_MAX_POS_REGISTERS} named POS registers · transactions visible ${FREE_TIER_MAX_TRANSACTION_DAYS} days`
                : null}
            </div>

            <h2 style={{ margin: "0.5rem 0 0", fontSize: "1.15rem" }}>Branding</h2>
            <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
              Logo and letterhead appear on invoices, quotations, and reports automatically.
            </p>

            <div className="panel" style={{ padding: "1rem" }}>
              <strong>Business logo</strong>
              <p className="muted" style={{ margin: "0.35rem 0 0.75rem", fontSize: "0.85rem" }}>
                Shown on invoices, quotations, reports, and POS receipts.
              </p>
              <label className="field">
                Upload logo
                <input
                  name="businessLogo"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setRemoveBusinessLogo(false);
                    setBusinessLogoPreview(URL.createObjectURL(file));
                  }}
                />
                <span className="muted" style={{ fontSize: "0.8rem" }}>
                  PNG, JPEG, WebP, or GIF · max 300KB
                </span>
              </label>
              {businessLogoPreview && !removeBusinessLogo ? (
                <div className="receipt-logo-preview">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={businessLogoPreview} alt="Business logo preview" />
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setRemoveBusinessLogo(true);
                      setBusinessLogoPreview(null);
                    }}
                  >
                    Remove logo
                  </button>
                </div>
              ) : null}
            </div>

            <div className="panel" style={{ padding: "1rem" }}>
              <strong>Letterhead</strong>
              <p className="muted" style={{ margin: "0.35rem 0 0.75rem", fontSize: "0.85rem" }}>
                Wide header image for branded documents and report printouts.
              </p>
              <label className="field">
                Upload letterhead
                <input
                  name="letterhead"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setRemoveLetterhead(false);
                    setLetterheadPreview(URL.createObjectURL(file));
                  }}
                />
                <span className="muted" style={{ fontSize: "0.8rem" }}>
                  PNG, JPEG, WebP, or GIF · max 800KB
                </span>
              </label>
              {letterheadPreview && !removeLetterhead ? (
                <div className="receipt-logo-preview">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={letterheadPreview} alt="Letterhead preview" className="document-letterhead" />
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setRemoveLetterhead(true);
                      setLetterheadPreview(null);
                    }}
                  >
                    Remove letterhead
                  </button>
                </div>
              ) : null}
            </div>

            <h2 style={{ margin: "0.5rem 0 0", fontSize: "1.15rem" }}>Appearance</h2>
            <fieldset className="settings-fieldset">
              <legend>Colour scheme</legend>
              <input type="hidden" name="theme" value={composedTheme} />
              <div className="stack" style={{ gap: "0.65rem" }}>
                {THEME_FAMILIES.map((family) => (
                  <label key={family} className="choice-card">
                    <input
                      type="radio"
                      name="themeFamily"
                      value={family}
                      checked={appearanceFamily === family}
                      onChange={() => setAppearanceFamily(family)}
                    />
                    <span>
                      <strong>{THEME_FAMILY_LABELS[family]}</strong>
                      <span className="row" style={{ gap: "0.35rem", marginTop: "0.35rem" }}>
                        {family === "red-white-black" ? (
                          <>
                            <span className="theme-swatch" style={{ background: "#C41E3A" }} />
                            <span
                              className="theme-swatch"
                              style={{ background: "#FFFFFF", border: "1px solid #ccc" }}
                            />
                            <span className="theme-swatch" style={{ background: "#1A1A1A" }} />
                          </>
                        ) : (
                          <>
                            <span className="theme-swatch" style={{ background: "#F4C430" }} />
                            <span className="theme-swatch" style={{ background: "#00843D" }} />
                            <span className="theme-swatch" style={{ background: "#FFF8E1", border: "1px solid #ccc" }} />
                          </>
                        )}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset className="settings-fieldset">
              <legend>Mode</legend>
              <div className="theme-mode-toggle" role="group" aria-label="Light or dark mode">
                {THEME_MODES.map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className={`btn btn-sm ${appearanceMode === mode ? "btn-primary" : "btn-secondary"}`}
                    onClick={() => setAppearanceMode(mode)}
                    aria-pressed={appearanceMode === mode}
                  >
                    {mode === "light" ? "Light" : "Dark"}
                  </button>
                ))}
              </div>
              <p className="muted" style={{ margin: "0.65rem 0 0", fontSize: "0.85rem" }}>
                Light and dark apply to the colour scheme selected above.
              </p>
            </fieldset>

            <h2 style={{ margin: "0.5rem 0 0", fontSize: "1.15rem" }}>Home screen</h2>
            <fieldset className="settings-fieldset">
              <legend>Item layout</legend>
              <div className="stack" style={{ gap: "0.65rem" }}>
                {HOME_LAYOUTS.map((layout) => (
                  <label key={layout.value} className="choice-card">
                    <input
                      type="radio"
                      name="homeLayout"
                      value={layout.value}
                      defaultChecked={homeLayout === layout.value}
                    />
                    <span>
                      <strong>{layout.label}</strong>
                      <span className="muted" style={{ display: "block", fontSize: "0.82rem" }}>
                        {layout.description}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <h2 style={{ margin: "0.5rem 0 0", fontSize: "1.15rem" }}>Language</h2>
            <label className="field">
              Display language
              <select name="language" defaultValue={language}>
                {LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.label}
                  </option>
                ))}
              </select>
            </label>

            <button className="btn btn-primary" type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save general"}
            </button>
          </form>
        </Panel>
      ) : null}

      {tab === "taxes" ? (
        <Panel style={{ padding: "1.25rem" }}>
          <form className="stack" onSubmit={onTaxes}>
            <h2 style={{ margin: 0, fontSize: "1.15rem" }}>VAT</h2>
            <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
              Turn tax on or off for sales. When enabled, VAT is applied at the rate below
              (Trinidad & Tobago standard is 12.5%).
            </p>
            <label className="choice-card">
              <input type="checkbox" name="taxEnabled" defaultChecked={taxEnabled} />
              <span>
                <strong>Enable tax / VAT</strong>
                <span className="muted" style={{ display: "block", fontSize: "0.82rem" }}>
                  When off, receipts and POS totals exclude VAT
                </span>
              </span>
            </label>
            <label className="field" style={{ maxWidth: 220 }}>
              VAT rate (%)
              <input
                name="vatPercent"
                type="number"
                min={0}
                max={100}
                step={0.1}
                defaultValue={(vatRate * 100).toFixed(1)}
                required
              />
            </label>
            <button className="btn btn-primary" type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save taxes"}
            </button>
          </form>
        </Panel>
      ) : null}

      {tab === "printers" ? (
        <Panel style={{ padding: "1.25rem" }}>
          <form className="stack" onSubmit={onPrinters}>
            <h2 style={{ margin: 0, fontSize: "1.15rem" }}>Receipt printing</h2>
            <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
              Enable printing receipts from the POS receipt screen. Uses your device’s print dialog
              (browser or connected printer).
            </p>
            <label className="choice-card">
              <input
                type="checkbox"
                name="receiptPrinting"
                defaultChecked={receiptPrinting}
              />
              <span>
                <strong>Allow printing receipts</strong>
                <span className="muted" style={{ display: "block", fontSize: "0.82rem" }}>
                  Show the Print receipt button on sale receipts
                </span>
              </span>
            </label>
            <label className="field">
              Preferred printer name (optional)
              <input
                name="printerName"
                type="text"
                defaultValue={printerName ?? ""}
                placeholder="e.g. Front counter receipt printer"
              />
            </label>
            <button className="btn btn-primary" type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save printers"}
            </button>
          </form>
        </Panel>
      ) : null}

      {tab === "receipts" ? (
        <Panel style={{ padding: "1.25rem" }}>
          <form className="stack" onSubmit={onReceipts} encType="multipart/form-data">
            <h2 style={{ margin: 0, fontSize: "1.15rem" }}>Receipts</h2>
            <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
              Control how your POS receipts look — logo, header, footer, and what details to include.
            </p>

            <label className="field">
              Business logo
              <input
                name="receiptLogo"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setRemoveLogo(false);
                  const url = URL.createObjectURL(file);
                  setLogoPreview(url);
                }}
              />
              <span className="muted" style={{ fontSize: "0.8rem" }}>
                PNG, JPEG, WebP, or GIF · max 300KB
              </span>
            </label>

            {logoPreview && !removeLogo ? (
              <div className="receipt-logo-preview">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoPreview} alt="Receipt logo preview" />
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setRemoveLogo(true);
                    setLogoPreview(null);
                  }}
                >
                  Remove logo
                </button>
              </div>
            ) : null}

            <label className="field">
              Header
              <input
                name="receiptHeader"
                type="text"
                defaultValue={headerDefault}
                placeholder={businessName || "Your business name"}
                maxLength={120}
              />
              <span className="muted" style={{ fontSize: "0.8rem" }}>
                Defaults to your business name
              </span>
            </label>

            <label className="field">
              Footer
              <input
                name="receiptFooter"
                type="text"
                defaultValue={footerDefault}
                placeholder={DEFAULT_RECEIPT_FOOTER}
                maxLength={200}
              />
              <span className="muted" style={{ fontSize: "0.8rem" }}>
                Defaults to “{DEFAULT_RECEIPT_FOOTER}”
              </span>
            </label>

            <fieldset className="settings-fieldset">
              <legend>Show on receipt</legend>
              <div className="stack" style={{ gap: "0.65rem" }}>
                <label className="choice-card">
                  <input
                    type="checkbox"
                    name="receiptShowCustomer"
                    defaultChecked={receiptShowCustomer}
                  />
                  <span>
                    <strong>Show customer info</strong>
                    <span className="muted" style={{ display: "block", fontSize: "0.82rem" }}>
                      Include the customer name (or Walk-in) on the receipt
                    </span>
                  </span>
                </label>
                <label className="choice-card">
                  <input
                    type="checkbox"
                    name="receiptShowComments"
                    defaultChecked={receiptShowComments}
                  />
                  <span>
                    <strong>Show comments</strong>
                    <span className="muted" style={{ display: "block", fontSize: "0.82rem" }}>
                      Include sale notes / comments when present
                    </span>
                  </span>
                </label>
                <label className="choice-card">
                  <input
                    type="checkbox"
                    name="receiptHoneyPersons"
                    defaultChecked={receiptHoneyPersons}
                  />
                  <span>
                    <strong>Persons involved (honey sales)</strong>
                    <span className="muted" style={{ display: "block", fontSize: "0.82rem" }}>
                      Enable a field on POS to record persons involved in the sale of honey
                    </span>
                  </span>
                </label>
                <label className="choice-card">
                  <input
                    type="checkbox"
                    name="receiptShowApiaryNumber"
                    defaultChecked={receiptShowApiaryNumber}
                  />
                  <span>
                    <strong>Apiary Number</strong>
                    <span className="muted" style={{ display: "block", fontSize: "0.82rem" }}>
                      Print the Apiary Number on receipts
                    </span>
                  </span>
                </label>
                <label className="choice-card">
                  <input
                    type="checkbox"
                    name="receiptShowOprNumber"
                    defaultChecked={receiptShowOprNumber}
                  />
                  <span>
                    <strong>OPR #</strong>
                    <span className="muted" style={{ display: "block", fontSize: "0.82rem" }}>
                      Print the OPR number on receipts
                    </span>
                  </span>
                </label>
              </div>
            </fieldset>

            <div className="form-grid">
              <label className="field">
                Apiary Number
                <input
                  name="receiptApiaryNumber"
                  type="text"
                  defaultValue={receiptApiaryNumber || ""}
                  placeholder="e.g. APY-001"
                  maxLength={80}
                />
              </label>
              <label className="field">
                OPR #
                <input
                  name="receiptOprNumber"
                  type="text"
                  defaultValue={receiptOprNumber || ""}
                  placeholder="e.g. OPR-12345"
                  maxLength={80}
                />
              </label>
            </div>

            <label className="field">
              Receipt language
              <select name="receiptLanguage" defaultValue={receiptLanguage}>
                {LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.label}
                  </option>
                ))}
              </select>
            </label>

            <button className="btn btn-primary" type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save receipts"}
            </button>
          </form>
        </Panel>
      ) : null}

      {tab === "payments" ? (
        <Panel style={{ padding: "1.25rem" }}>
          <div className="stack">
            <h2 style={{ margin: 0, fontSize: "1.15rem" }}>Payment types</h2>
            <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
              Add the payment methods available at checkout (cash, debit card, credit card, cheque,
              and more).
            </p>

            <ul className="settings-list">
              {paymentTypes.map((pt) => (
                <li key={pt.id} className="settings-list-row">
                  <div>
                    <strong>{pt.label}</strong>
                    <div className="muted" style={{ fontSize: "0.78rem" }}>
                      {pt.code} · {pt.active ? "Active" : "Disabled"}
                    </div>
                  </div>
                  <div className="row" style={{ gap: "0.4rem" }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={pending}
                      onClick={() => {
                        const fd = new FormData();
                        fd.set("id", pt.id);
                        if (!pt.active) fd.set("active", "on");
                        startTransition(async () => {
                          await togglePaymentType(fd);
                          setSaved(pt.active ? "Payment type disabled" : "Payment type enabled");
                          router.refresh();
                        });
                      }}
                    >
                      {pt.active ? "Disable" : "Enable"}
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={pending}
                      onClick={() => {
                        const fd = new FormData();
                        fd.set("id", pt.id);
                        startTransition(async () => {
                          await deletePaymentType(fd);
                          setSaved("Payment type removed");
                          router.refresh();
                        });
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
              {paymentTypes.length === 0 ? (
                <li className="muted">No payment types yet — use Add payment type.</li>
              ) : null}
            </ul>

            <AddEntityTab label="Add payment type">
              <form className="stack" onSubmit={onAddPayment}>
                <label className="field">
                  New payment method
                  <input
                    name="label"
                    type="text"
                    required
                    placeholder="e.g. Cash, Debit card, Cheque"
                    autoComplete="off"
                  />
                </label>
                <button className="btn btn-primary" type="submit" disabled={pending}>
                  {pending ? "Saving…" : "Add payment type"}
                </button>
              </form>
            </AddEntityTab>
          </div>
        </Panel>
      ) : null}

      {tab === "discounts" ? (
        <Panel style={{ padding: "1.25rem" }}>
          <div className="stack">
            <h2 style={{ margin: 0, fontSize: "1.15rem" }}>Percentage discounts</h2>
            <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
              Presets appear in the POS discount dropdown. Only POS register 1 can add or edit
              these.
            </p>
            {!canEditDiscounts ? (
              <div className="info-banner">
                Switch to POS register 1 to edit discount presets. Register 2 can still apply
                existing discounts at checkout.
              </div>
            ) : null}
            <div className="stack" style={{ gap: "0.65rem" }}>
              {discountPresets.map((d) => (
                <div key={d.id} className="settings-list-row">
                  {canEditDiscounts ? (
                    <form
                      className="row"
                      style={{ gap: "0.5rem", flexWrap: "wrap", flex: 1 }}
                      onSubmit={(e) => {
                        e.preventDefault();
                        setError(null);
                        const fd = new FormData(e.currentTarget);
                        startTransition(async () => {
                          const result = await updateDiscountPreset(fd);
                          if (result && "error" in result && result.error) {
                            setError(result.error);
                            return;
                          }
                          setSaved("Discount updated");
                          router.refresh();
                        });
                      }}
                    >
                      <input type="hidden" name="id" value={d.id} />
                      <input name="name" defaultValue={d.name} required style={{ flex: "1 1 120px" }} />
                      <input
                        name="percent"
                        type="number"
                        step="0.01"
                        min="0.01"
                        max="100"
                        defaultValue={d.percent}
                        required
                        style={{ width: 88 }}
                      />
                      <span className="muted">%</span>
                      <button className="btn btn-secondary btn-sm" type="submit" disabled={pending}>
                        Save
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        type="button"
                        disabled={pending}
                        onClick={() => {
                          const fd = new FormData();
                          fd.set("id", d.id);
                          startTransition(async () => {
                            const result = await deleteDiscountPreset(fd);
                            if (result && "error" in result && result.error) {
                              setError(result.error);
                              return;
                            }
                            setSaved("Discount removed");
                            router.refresh();
                          });
                        }}
                      >
                        Delete
                      </button>
                    </form>
                  ) : (
                    <div>
                      <strong>{d.name}</strong>
                      <span className="muted"> · {d.percent}%</span>
                    </div>
                  )}
                </div>
              ))}
              {discountPresets.length === 0 ? (
                <div className="muted">No discount presets yet — use Add discount.</div>
              ) : null}
            </div>
            {canEditDiscounts ? (
              <AddEntityTab label="Add discount">
                <form className="form-grid" onSubmit={onAddDiscount}>
                  <label className="field">
                    Name
                    <input name="name" required placeholder="Staff discount" />
                  </label>
                  <label className="field">
                    Percent
                    <input name="percent" type="number" step="0.01" min="0.01" max="100" required placeholder="10" />
                  </label>
                  <div className="full">
                    <button className="btn btn-primary" type="submit" disabled={pending}>
                      {pending ? "Saving…" : "Add discount"}
                    </button>
                  </div>
                </form>
              </AddEntityTab>
            ) : null}
          </div>
        </Panel>
      ) : null}

      {tab === "pos" ? (
        <Panel style={{ padding: "1.25rem" }}>
          <div className="stack">
            <h2 style={{ margin: 0, fontSize: "1.15rem" }}>POS</h2>

            <div className="store-bar">
              <label className="field" style={{ margin: 0, flex: "1 1 200px" }}>
                Store
                <select
                  value={activeStore?.id || ""}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSelectedStoreId(id);
                    setSelectedCategoryId(null);
                    const fd = new FormData();
                    fd.set("storeId", id);
                    startTransition(async () => {
                      const { setActiveStore } = await import("@/app/actions/settings");
                      await setActiveStore(fd);
                      router.refresh();
                    });
                  }}
                >
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              {stores.length < maxStores ? (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ alignSelf: "flex-end" }}
                  onClick={() => setShowAddStore((v) => !v)}
                >
                  + Add store
                </button>
              ) : null}
            </div>
            <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
              Your first store is the pilot. New stores start with its inventory view, registers,
              and category list so you don’t re-enter setup — then each store’s changes stay
              local.
              {planTier === "FREE_RETAIL"
                ? ` Free Retail includes ${FREE_RETAIL_MAX_STORES} store.`
                : ` Standard allows up to ${STANDARD_MAX_STORES} stores.`}
            </p>

            {showAddStore ? (
              <form className="stack" onSubmit={onAddStore} style={{ maxWidth: 420 }}>
                <label className="field">
                  New store name
                  <input
                    value={newStoreName}
                    onChange={(e) => setNewStoreName(e.target.value)}
                    required
                    placeholder="e.g. Branch 2"
                    autoComplete="off"
                  />
                </label>
                <p className="muted" style={{ margin: 0, fontSize: "0.82rem" }}>
                  Will copy inventory view, registers, and categories from pilot store{" "}
                  <strong>{stores[0]?.name || "Main store"}</strong>. Edits after that apply
                  only to the new store.
                </p>
                <div className="row" style={{ gap: "0.5rem" }}>
                  <button className="btn btn-primary" type="submit" disabled={pending}>
                    {pending ? "Adding…" : "Create store"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowAddStore(false)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : null}

            <div className="settings-subtabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={posSubTab === "registers"}
                className={posSubTab === "registers" ? "settings-subtab active" : "settings-subtab"}
                onClick={() => selectPosSub("registers")}
              >
                Registers
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={posSubTab === "inventory-view"}
                className={
                  posSubTab === "inventory-view" ? "settings-subtab active" : "settings-subtab"
                }
                onClick={() => selectPosSub("inventory-view")}
              >
                Inventory View
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={posSubTab === "categories"}
                className={posSubTab === "categories" ? "settings-subtab active" : "settings-subtab"}
                onClick={() => selectPosSub("categories")}
              >
                Categories
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={posSubTab === "features"}
                className={posSubTab === "features" ? "settings-subtab active" : "settings-subtab"}
                onClick={() => selectPosSub("features")}
              >
                Features
              </button>
            </div>

            {posSubTab === "registers" ? (
              <form
                key={`registers-${activeStore?.id || "none"}`}
                className="stack"
                onSubmit={onPosRegisters}
              >
                <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
                  {planTier === "FREE_RETAIL"
                    ? `Free Retail includes up to ${FREE_RETAIL_MAX_POS_REGISTERS} named POS sign-ins.`
                    : `Standard plan supports up to ${STANDARD_MAX_POS_REGISTERS} named POS sign-ins.`}{" "}
                  Choose which register is active when ringing sales
                  {activeStore ? ` at ${activeStore.name}` : ""}.
                </p>
                <div className="info-banner">
                  <strong>Register 1</strong> — full access (inventory, settings, void tickets,
                  edit discounts). <strong>Register 2+</strong> — POS + stock levels only; can save
                  and edit tickets and issue refunds, but cannot delete tickets.
                </div>
                {registerDefaults.map((name, i) => (
                  <label key={i} className="field">
                    POS register {i + 1} name{i === 0 ? " (full access)" : " (POS + stock only)"}
                    <input
                      name={`register${i + 1}`}
                      type="text"
                      required={i === 0}
                      defaultValue={name}
                      placeholder={i === 0 ? "Front counter" : "Side till"}
                      autoComplete="off"
                    />
                  </label>
                ))}
                {registerCount < maxRegisters ? (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ alignSelf: "flex-start" }}
                    onClick={() => setRegisterCount((c) => Math.min(c + 1, maxRegisters))}
                  >
                    + Add register
                  </button>
                ) : null}
                <button className="btn btn-primary" type="submit" disabled={pending}>
                  {pending ? "Saving…" : "Save registers"}
                </button>
              </form>
            ) : null}

            {posSubTab === "inventory-view" ? (
              <form
                key={`view-${activeStore?.id || "none"}-${inventoryViewMode}`}
                className="stack"
                onSubmit={onInventoryViewMode}
              >
                <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
                  Choose how items appear on both Inventory and POS
                  {activeStore ? ` for ${activeStore.name}` : ""}.
                </p>
                <fieldset className="settings-fieldset">
                  <legend>Default layout</legend>
                  <div className="row">
                    <label className="choice-pill">
                      <input
                        type="radio"
                        name="inventoryViewMode"
                        value="card"
                        defaultChecked={inventoryViewMode === "card"}
                      />
                      Card view
                    </label>
                    <label className="choice-pill">
                      <input
                        type="radio"
                        name="inventoryViewMode"
                        value="list"
                        defaultChecked={inventoryViewMode === "list"}
                      />
                      List view
                    </label>
                  </div>
                </fieldset>
                <button className="btn btn-primary" type="submit" disabled={pending}>
                  {pending ? "Saving…" : "Save inventory view"}
                </button>
              </form>
            ) : null}

            {posSubTab === "categories" ? (
              <div key={`cats-${activeStore?.id || "none"}`} className="stack">
                <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
                  Category list for{" "}
                  {activeStore ? <strong>{activeStore.name}</strong> : "this store"}. New
                  stores inherit the pilot store’s list; changes here stay local. Click a
                  category to assign a colour.
                </p>

                <ul className="settings-list">
                  {storeCategories.map((cat) => {
                    const selected = selectedCategoryId === cat.id;
                    const color = cat.color || "#5C6B6E";
                    return (
                      <li key={cat.id} className="stack" style={{ gap: "0.55rem" }}>
                        <div
                          className={
                            selected
                              ? "settings-list-row category-row selected"
                              : "settings-list-row category-row"
                          }
                          role="button"
                          tabIndex={0}
                          onClick={() =>
                            setSelectedCategoryId((id) => (id === cat.id ? null : cat.id))
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setSelectedCategoryId((id) => (id === cat.id ? null : cat.id));
                            }
                          }}
                        >
                          <div className="row" style={{ gap: "0.65rem", alignItems: "center" }}>
                            <span
                              className="category-swatch"
                              style={{ background: color }}
                              aria-hidden
                            />
                            <strong>{cat.name}</strong>
                            <span className="muted" style={{ fontSize: "0.8rem" }}>
                              {selected ? "Pick a colour below" : "Click to set colour"}
                            </span>
                          </div>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            disabled={pending}
                            onClick={(e) => {
                              e.stopPropagation();
                              const fd = new FormData();
                              fd.set("id", cat.id);
                              startTransition(async () => {
                                await deleteInventoryCategory(fd);
                                if (selectedCategoryId === cat.id) setSelectedCategoryId(null);
                                setSaved("Category removed");
                                router.refresh();
                              });
                            }}
                          >
                            Delete
                          </button>
                        </div>

                        {selected ? (
                          <div
                            className="category-color-picker"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div
                              className="row"
                              style={{ gap: "0.45rem", flexWrap: "wrap", alignItems: "center" }}
                            >
                              {CATEGORY_COLOR_PALETTE.map((c) => (
                                <button
                                  key={c}
                                  type="button"
                                  className="category-swatch pick"
                                  style={{
                                    background: c,
                                    outline:
                                      color.toUpperCase() === c.toUpperCase()
                                        ? "2px solid var(--ink)"
                                        : "none",
                                    outlineOffset: 2,
                                  }}
                                  aria-label={`Set ${cat.name} to ${c}`}
                                  disabled={pending}
                                  onClick={() => {
                                    const fd = new FormData();
                                    fd.set("id", cat.id);
                                    fd.set("color", c);
                                    startTransition(async () => {
                                      const result = await updateInventoryCategoryColor(fd);
                                      if (result && "error" in result && result.error) {
                                        setError(result.error);
                                        return;
                                      }
                                      setSaved(`Colour updated for ${cat.name}`);
                                      router.refresh();
                                    });
                                  }}
                                />
                              ))}
                              <label className="category-custom-color">
                                <span className="muted" style={{ fontSize: "0.8rem" }}>
                                  Custom
                                </span>
                                <input
                                  type="color"
                                  value={/^#[0-9A-Fa-f]{6}$/.test(color) ? color : "#0A6B6E"}
                                  disabled={pending}
                                  aria-label={`Custom colour for ${cat.name}`}
                                  onChange={(e) => {
                                    const fd = new FormData();
                                    fd.set("id", cat.id);
                                    fd.set("color", e.target.value);
                                    startTransition(async () => {
                                      const result = await updateInventoryCategoryColor(fd);
                                      if (result && "error" in result && result.error) {
                                        setError(result.error);
                                        return;
                                      }
                                      setSaved(`Colour updated for ${cat.name}`);
                                      router.refresh();
                                    });
                                  }}
                                />
                              </label>
                            </div>
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                  {storeCategories.length === 0 ? (
                    <li className="muted">No categories yet — use Add category.</li>
                  ) : null}
                </ul>

                <AddEntityTab label="Add category">
                  <form className="stack" onSubmit={onAddCategory}>
                    <label className="field">
                      New category
                      <input
                        name="name"
                        type="text"
                        required
                        placeholder="e.g. Grocery, Gift items"
                        autoComplete="off"
                      />
                    </label>
                    <label className="field">
                      Colour code
                      <div className="row" style={{ gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                        <input
                          name="color"
                          type="color"
                          value={newCategoryColor}
                          onChange={(e) => setNewCategoryColor(e.target.value)}
                        />
                        {CATEGORY_COLOR_PALETTE.map((c) => (
                          <button
                            key={c}
                            type="button"
                            className="category-swatch pick"
                            style={{
                              background: c,
                              outline:
                                newCategoryColor.toUpperCase() === c.toUpperCase()
                                  ? "2px solid var(--ink)"
                                  : "none",
                              outlineOffset: 2,
                            }}
                            aria-label={`Use ${c}`}
                            onClick={() => setNewCategoryColor(c)}
                          />
                        ))}
                      </div>
                    </label>
                    <button className="btn btn-primary" type="submit" disabled={pending}>
                      {pending ? "Saving…" : "Add category"}
                    </button>
                  </form>
                </AddEntityTab>
              </div>
            ) : null}

            {posSubTab === "features" ? (
              <form className="stack" onSubmit={onFeatures}>
                <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
                  Turn optional POS and inventory behaviours on or off for your business.
                </p>

                <label className="choice-card">
                  <input
                    type="checkbox"
                    name="featureOpenTickets"
                    defaultChecked={featureOpenTickets}
                  />
                  <span>
                    <strong>Open Ticket</strong>
                    <span className="muted" style={{ display: "block", fontSize: "0.82rem" }}>
                      Save and edit orders before completing payment. Shows a Saved Tickets tab on
                      POS.
                    </span>
                  </span>
                </label>

                <label className="choice-card">
                  <input
                    type="checkbox"
                    name="featureLowStockEmail"
                    defaultChecked={featureLowStockEmail}
                  />
                  <span>
                    <strong>Low stock notification</strong>
                    <span className="muted" style={{ display: "block", fontSize: "0.82rem" }}>
                      Weekly email of items at or below minimum stock, plus alerts when stock drops
                      after a sale. Sent to your account email (requires RESEND_API_KEY on the
                      server).
                    </span>
                  </span>
                </label>

                <label className="choice-card">
                  <input
                    type="checkbox"
                    name="featureOutOfStockWarn"
                    defaultChecked={featureOutOfStockWarn}
                  />
                  <span>
                    <strong>Out of stock</strong>
                    <span className="muted" style={{ display: "block", fontSize: "0.82rem" }}>
                      Warn cashiers when they try to sell unavailable stock, and email your account.
                    </span>
                  </span>
                </label>

                <button className="btn btn-primary" type="submit" disabled={pending}>
                  {pending ? "Saving…" : "Save features"}
                </button>
              </form>
            ) : null}
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
