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
}: {
  kind: Kind;
  documentId: string;
  defaultEmail?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(defaultEmail || "");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

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
        result = await emailQuotation({ quotationId: documentId, toEmail });
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
      setOpen(false);
    });
  }

  return (
    <div className="stack" style={{ gap: "0.35rem" }}>
      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => {
          setOpen((v) => !v);
          setError(null);
          setMessage(null);
        }}
      >
        {open ? "Cancel email" : "Email"}
      </button>
      {open ? (
        <form onSubmit={onSubmit} className="row" style={{ gap: "0.4rem", flexWrap: "wrap" }}>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="customer@email.com"
            style={{ minWidth: 200, flex: "1 1 180px" }}
            autoComplete="email"
          />
          <button className="btn btn-primary btn-sm" type="submit" disabled={pending}>
            {pending ? "Sending…" : "Send"}
          </button>
        </form>
      ) : null}
      {message ? <div className="badge badge-ok">{message}</div> : null}
      {error ? <div className="badge badge-danger">{error}</div> : null}
    </div>
  );
}
