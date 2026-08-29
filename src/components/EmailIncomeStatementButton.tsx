"use client";

import { FormEvent, useState, useTransition } from "react";
import { emailIncomeStatement } from "@/app/actions/financial-reports";

export function EmailIncomeStatementButton({
  year,
  month,
}: {
  year: number;
  month: number;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await emailIncomeStatement({ year, month, toEmail: email.trim() });
      if (result.error) {
        setError(result.error);
        return;
      }
      setMessage(`Sent to ${result.to}`);
      setOpen(false);
    });
  }

  return (
    <>
      <button type="button" className="btn btn-secondary" onClick={() => setOpen(true)}>
        Email
      </button>
      {open ? (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "grid",
            placeItems: "center",
            zIndex: 50,
            padding: "1rem",
          }}
          onClick={() => setOpen(false)}
        >
          <form
            className="panel"
            style={{ padding: "1.25rem", width: "min(420px, 100%)" }}
            onClick={(e) => e.stopPropagation()}
            onSubmit={onSubmit}
          >
            <h3 style={{ marginTop: 0 }}>Email income statement</h3>
            <label className="stack" style={{ gap: "0.35rem", marginBottom: "1rem" }}>
              Send to
              <input
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            {error ? <p style={{ color: "var(--danger, #b91c1c)" }}>{error}</p> : null}
            {message ? <p className="muted">{message}</p> : null}
            <div className="row" style={{ gap: "0.5rem" }}>
              <button type="submit" className="btn btn-primary" disabled={pending}>
                {pending ? "Sending…" : "Send"}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
