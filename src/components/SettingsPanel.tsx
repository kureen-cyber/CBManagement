"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState, useTransition } from "react";
import {
  HOME_LAYOUTS,
  LANGUAGES,
  type HomeLayout,
  type LanguageCode,
  type Theme,
} from "@/lib/settings";
import {
  updateGeneralSettings,
  updatePrinterSettings,
  updateTaxSettings,
} from "@/app/actions/settings";
import { Panel } from "@/components/ui";

type Tab = "general" | "taxes" | "printers";

const TABS: { id: Tab; label: string }[] = [
  { id: "general", label: "General" },
  { id: "taxes", label: "Taxes" },
  { id: "printers", label: "Printers" },
];

export function SettingsPanel({
  businessName,
  theme,
  language,
  homeLayout,
  vatRate,
  receiptPrinting,
  printerName,
}: {
  businessName: string;
  theme: Theme;
  language: LanguageCode;
  homeLayout: HomeLayout;
  vatRate: number;
  receiptPrinting: boolean;
  printerName: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as Tab) || "general";
  const [tab, setTab] = useState<Tab>(
    TABS.some((t) => t.id === initialTab) ? initialTab : "general",
  );
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState<string | null>(null);

  function selectTab(next: Tab) {
    setTab(next);
    setSaved(null);
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
              Set the VAT rate applied to sales and invoices (Trinidad & Tobago standard is 12.5%).
            </p>
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
    </div>
  );
}
