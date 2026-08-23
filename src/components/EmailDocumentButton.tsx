"use client";

import { FormEvent, useState, useTransition } from "react";
import {
  emailInvoice,
  emailPaymentReceipt,
  emailPosReceipt,
  emailQuotation,
} from "@/app/actions/email-documents";

type Kind = "receipt" | "quotation" | "invoice" | "payment";

export function EmailDocumentButton({
  kind,
  documentId,
  defaultEmail = "",
  hasNotes = false,
}: {
  kind: Kind;
  documentId: string;
  defaultEmail?: string | null;
  /** When true, quotation email shows option to include internal notes */
  hasNotes?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(defaultEmail || "");
  const [includeNotes, setIncludeNotes] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function closeModal() {
    setOpen(false);
    setError(null);
    setIncludeNotes(false);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const toEmail = email.trim();
      let result;
      if (kind === "receipt") {
        result = await emailPosReceipt({ saleId: documentId, toEmail });
      } else if (kind === "quotation") {
        result = await emailQuotation({
          quotationId: documentId,
          toEmail,
          includeNotesInCustomerView: includeNotes,
        });
      } else if (kind === "invoice") {
        result = await emailInvoice({ invoiceId: documentId, toEmail });
      } else {
        result = await emailPaymentReceipt({ paymentId: documentId, toEmail });
      }

      if (result && "error" in result && result.error) {
        setError(result.error);
        return;
      }
      setMessage(`Sent to ${result.to}`);
      closeModal();
    });
  }

  return (
    <div className="stack" style={{ gap: "0.35rem" }}>
      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => {
          setOpen(true);
          setError(null);
          setMessage(null);
          setIncludeNotes(false);
        }}
      >
        Email
      </button>
      {open ? (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="email-document-title"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "grid",
            placeItems: "center",
            zIndex: 50,
            padding: "1rem",
          }}
          onClick={closeModal}
        >
          <div
            className="panel"
            style={{ padding: "1.25rem", width: "min(440px, 100%)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="email-document-title" style={{ marginTop: 0 }}>
              Email {kind === "quotation" ? "quotation" : kind}
            </h3>
            <form onSubmit={onSubmit} className="stack" style={{ gap: "0.75rem" }}>
              <label className="field">
                Send to
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="customer@email.com"
                  autoComplete="email"
                  autoFocus
                />
              </label>
              {kind === "quotation" && hasNotes ? (
                <label className="choice-card" style={{ cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={includeNotes}
                    onChange={(e) => setIncludeNotes(e.target.checked)}
                  />
                  <span>
                    <strong>Include notes in customer quotation</strong>
                    <span className="muted" style={{ display: "block", fontSize: "0.82rem" }}>
                      Off by default — notes stay internal unless you check this
                    </span>
                  </span>
                </label>
              ) : null}
              {error ? <div className="badge badge-danger">{error}</div> : null}
              <div className="row" style={{ gap: "0.5rem", justifyContent: "flex-end" }}>
                <button type="button" className="btn btn-secondary" onClick={closeModal}>
                  Cancel
                </button>
                <button className="btn btn-primary" type="submit" disabled={pending}>
                  {pending ? "Sending…" : "Send email"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
      {message ? <div className="badge badge-ok">{message}</div> : null}
    </div>
  );
}
