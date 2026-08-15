"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useState, useTransition } from "react";
import {
  DEFAULT_RECEIPT_FOOTER,
  HOME_LAYOUTS,
  LANGUAGES,
  type HomeLayout,
  type LanguageCode,
  type Theme,
} from "@/lib/settings";
import {
  updateGeneralSettings,
  updatePosRegisters,
  updatePrinterSettings,
  updateReceiptSettings,
  updateTaxSettings,
} from "@/app/actions/settings";
import {
  FREE_RETAIL_MAX_POS_REGISTERS,
  FREE_TIER_MAX_TRANSACTION_DAYS,
  PLAN_TIER_LABELS,
  type PlanTier,
} from "@/lib/tier";
import { Panel } from "@/components/ui";

type Tab = "general" | "taxes" | "printers" | "receipts" | "pos";

const TABS: { id: Tab; label: string }[] = [
  { id: "general", label: "General" },
  { id: "taxes", label: "Taxes" },
  { id: "printers", label: "Printers" },
  { id: "receipts", label: "Receipts" },
  { id: "pos", label: "POS registers" },
];

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
  receiptHeader,
  receiptFooter,
  receiptShowCustomer,
  receiptShowComments,
  receiptLanguage,
  planTier,
  posRegisters,
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
  receiptHeader: string | null;
  receiptFooter: string | null;
  receiptShowCustomer: boolean;
  receiptShowComments: boolean;
  receiptLanguage: LanguageCode;
  planTier: PlanTier;
  posRegisters: { id: string; name: string }[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as Tab) || "general";
  const [tab, setTab] = useState<Tab>(
    TABS.some((t) => t.id === initialTab) ? initialTab : "general",
  );
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(receiptLogoData);
  const [removeLogo, setRemoveLogo] = useState(false);

  useEffect(() => {
    if (!removeLogo) setLogoPreview(receiptLogoData);
  }, [receiptLogoData, removeLogo]);

  function selectTab(next: Tab) {
    setTab(next);
    setSaved(null);
    setError(null);
    router.replace(`/settings?tab=${next}`, { scroll: false });
  }

  function onGeneral(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      await updateGeneralSettings(fd);
      setSaved("General settings saved");
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

  function onPosRegisters(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await updatePosRegisters(fd);
      if (result && "error" in result && result.error) {
        setError(result.error);
        return;
      }
      setSaved("POS registers saved");
      router.refresh();
    });
  }

  const reg1 = posRegisters[0]?.name ?? "";
  const reg2 = posRegisters[1]?.name ?? "";
  const headerDefault = receiptHeader?.trim() || businessName;
  const footerDefault = receiptFooter?.trim() || DEFAULT_RECEIPT_FOOTER;

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
          <form className="stack" onSubmit={onGeneral}>
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

            <h2 style={{ margin: "0.5rem 0 0", fontSize: "1.15rem" }}>Appearance</h2>
            <fieldset className="settings-fieldset">
              <legend>Theme</legend>
              <div className="row">
                <label className="choice-pill">
                  <input type="radio" name="theme" value="light" defaultChecked={theme === "light"} />
                  Light
                </label>
                <label className="choice-pill">
                  <input type="radio" name="theme" value="dark" defaultChecked={theme === "dark"} />
                  Dark
                </label>
              </div>
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
              </div>
            </fieldset>

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

      {tab === "pos" ? (
        <Panel style={{ padding: "1.25rem" }}>
          <form className="stack" onSubmit={onPosRegisters}>
            <h2 style={{ margin: 0, fontSize: "1.15rem" }}>POS registers</h2>
            <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
              Free Retail includes up to {FREE_RETAIL_MAX_POS_REGISTERS} named POS sign-ins
              (e.g. Front counter, Side till). Choose which register is active when ringing sales.
            </p>
            <label className="field">
              POS register 1 name
              <input
                name="register1"
                type="text"
                required
                defaultValue={reg1 || "Front counter"}
                placeholder="Front counter"
                autoComplete="off"
              />
            </label>
            <label className="field">
              POS register 2 name (optional)
              <input
                name="register2"
                type="text"
                defaultValue={reg2}
                placeholder="Side till"
                autoComplete="off"
              />
            </label>
            <button className="btn btn-primary" type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save POS registers"}
            </button>
          </form>
        </Panel>
      ) : null}
    </div>
  );
}
