"use client";

import { FormEvent, useState, useTransition } from "react";
import { setIncomeStatement } from "@/app/actions/financial-reports";
import { formatTTD } from "@/lib/money";

export function IncomeStatementSetupForm({
  startMonthLabel,
  openingInventoryCents,
}: {
  startMonthLabel: string;
  openingInventoryCents: number;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const cashOnHand = Number(form.cashOnHand.value);
    const reserveEscrow = Number(form.reserveEscrow.value);
    startTransition(async () => {
      const result = await setIncomeStatement({ cashOnHand, reserveEscrow });
      if (result.error) setError(result.error);
    });
  }

  return (
    <form className="stack income-statement-setup" onSubmit={onSubmit}>
      <div>
        <h3 style={{ margin: "0 0 0.35rem" }}>Set your income statement</h3>
        <p className="muted" style={{ margin: 0, fontSize: "0.88rem", maxWidth: "36rem" }}>
          Enter cash on hand and reserve/escrow as they stand today. Calculations start from
          the <strong>1st of {startMonthLabel}</strong>. All inventory already in the app —
          including stock logged since that date — becomes opening inventory. After you set
          this, only stock quantity increases count as purchases.
        </p>
      </div>

      <div className="form-grid" style={{ maxWidth: "28rem" }}>
        <label className="field">
          Cash on hand (TT$)
          <input
            className="input"
            name="cashOnHand"
            type="number"
            step="0.01"
            min="0"
            required
            defaultValue="0"
          />
        </label>
        <label className="field">
          Reserve / escrow (TT$)
          <input
            className="input"
            name="reserveEscrow"
            type="number"
            step="0.01"
            min="0"
            required
            defaultValue="0"
          />
        </label>
      </div>

      <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
        Opening inventory (including stock logged from the 1st of this month):{" "}
        <strong>{formatTTD(openingInventoryCents)}</strong>
      </p>

      {error ? <p style={{ color: "var(--danger, #b91c1c)", margin: 0 }}>{error}</p> : null}

      <div>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Saving…" : "Set income statement"}
        </button>
      </div>
    </form>
  );
}
