"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { formatTTD } from "@/lib/money";
import { formatAppDate } from "@/lib/timezone";
import { MoneyMixDiagram } from "@/components/MoneyMixDiagram";
import { saveMoneyMixPlan } from "@/app/actions/financial-reports";
import type { BankLedger } from "@/lib/bank-ledger";
import type { MoneyMixPlan, MoneyMixSlice } from "@/lib/money-mix";
import { MONEY_MIX_LABELS, type MoneyMixBucket } from "@/lib/money-mix";

const BUCKETS: MoneyMixBucket[] = ["expenses", "materials", "growth", "reserve", "drawings"];

export function BankSection({
  businessName,
  ledger,
  plan,
  plannedSlices,
  actualSlices,
}: {
  businessName: string;
  ledger: BankLedger;
  plan: MoneyMixPlan;
  plannedSlices: MoneyMixSlice[];
  actualSlices: MoneyMixSlice[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bankTab = searchParams.get("bankTab") === "mix" ? "mix" : "ledger";
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function setBankTab(tab: "ledger" | "mix") {
    const params = new URLSearchParams(searchParams.toString());
    params.set("section", "bank");
    params.set("bankTab", tab);
    router.replace(`/financial-reports?${params.toString()}`);
  }

  function onSavePlan(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await saveMoneyMixPlan({
        expenses: Number(fd.get("expenses")),
        materials: Number(fd.get("materials")),
        growth: Number(fd.get("growth")),
        reserve: Number(fd.get("reserve")),
        drawings: Number(fd.get("drawings")),
      });
      if (result.error) {
        setMessage(result.error);
        return;
      }
      setMessage("Plan saved.");
      router.refresh();
    });
  }

  const mixTitle = `${businessName} personal money mix`;

  return (
    <div className="stack">
      <div className="financial-reports-nav" role="tablist" aria-label="Bank views">
        <button
          type="button"
          role="tab"
          aria-selected={bankTab === "ledger"}
          className={bankTab === "ledger" ? "settings-subtab active" : "settings-subtab"}
          onClick={() => setBankTab("ledger")}
        >
          Bank ledger
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={bankTab === "mix"}
          className={bankTab === "mix" ? "settings-subtab active" : "settings-subtab"}
          onClick={() => setBankTab("mix")}
        >
          {mixTitle}
        </button>
      </div>

      {bankTab === "ledger" ? (
        <>
          <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
            <div className="report-stat sea">
              <div className="label">Bank balance</div>
              <div className="value money">{formatTTD(ledger.balance)}</div>
            </div>
            <div className="report-stat accent">
              <div className="label">Total in</div>
              <div className="value money">{formatTTD(ledger.totalIn)}</div>
            </div>
            <div className="report-stat blue">
              <div className="label">Total out</div>
              <div className="value money">{formatTTD(ledger.totalOut)}</div>
            </div>
          </div>

          <div className="table-wrap list-dense">
            <table className="data">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Reference</th>
                  <th>In</th>
                  <th>Out</th>
                  <th>Balance</th>
                </tr>
              </thead>
              <tbody>
                {ledger.movements.map((m) => (
                  <tr key={m.id}>
                    <td>{formatAppDate(m.date)}</td>
                    <td>{m.description}</td>
                    <td className="muted">{m.reference}</td>
                    <td className="money">{m.type === "in" ? formatTTD(m.amount) : "—"}</td>
                    <td className="money">{m.type === "out" ? formatTTD(m.amount) : "—"}</td>
                    <td className="money">{formatTTD(m.runningBalance)}</td>
                  </tr>
                ))}
                {ledger.movements.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="muted">
                      No bank movements yet — payments received and expenses recorded will appear here.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          <p className="muted" style={{ margin: 0, fontSize: "0.88rem" }}>
            Set the percentage of your current bank balance you plan to allocate to each area. Compare
            your plan (left) with how money was actually spent (right).
          </p>

          <form className="money-mix-form" onSubmit={onSavePlan}>
            <div className="money-mix-inputs">
              {BUCKETS.map((bucket) => (
                <label key={bucket}>
                  {MONEY_MIX_LABELS[bucket]} (%)
                  <input
                    className="input"
                    type="number"
                    name={bucket}
                    min={0}
                    max={100}
                    step={1}
                    defaultValue={plan[bucket]}
                    required
                  />
                </label>
              ))}
            </div>
            <div className="row" style={{ gap: "0.5rem", alignItems: "center" }}>
              <button type="submit" className="btn btn-primary" disabled={pending}>
                {pending ? "Saving…" : "Save plan"}
              </button>
              {message ? <span className="muted" style={{ fontSize: "0.85rem" }}>{message}</span> : null}
            </div>
          </form>

          <div className="money-mix-compare">
            <MoneyMixDiagram
              title="Planned allocation"
              centerLabel="Bank balance"
              centerAmount={Math.max(0, ledger.balance)}
              slices={plannedSlices}
            />
            <MoneyMixDiagram
              title="Actual spending"
              centerLabel="Total outflows"
              centerAmount={actualSlices.reduce((s, sl) => s + sl.amount, 0)}
              slices={actualSlices}
            />
          </div>
        </>
      )}
    </div>
  );
}
