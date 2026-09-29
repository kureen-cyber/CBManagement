"use client";

import { FormEvent, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateInvoice } from "@/app/actions";
import { formatTTD, fromCents, toCents } from "@/lib/money";

type LineDraft = { key: string; description: string; quantity: string; unitPrice: string };

function newLine(partial?: Partial<LineDraft>): LineDraft {
  return {
    key: partial?.key || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    description: partial?.description ?? "",
    quantity: partial?.quantity ?? "1",
    unitPrice: partial?.unitPrice ?? "",
  };
}

export function EditInvoiceButton({
  invoice,
  size = "sm",
}: {
  invoice: {
    id: string;
    number: string;
    status: string;
    taxAmount: number;
    amountPaid: number;
    notes: string | null;
    dueDate: string | null;
    quotationNumber?: string | null;
    quotationTotal?: number | null;
    lines: { id: string; description: string; quantity: number; unitPrice: number }[];
  };
  size?: "sm" | "md";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [taxAmount, setTaxAmount] = useState(String(fromCents(invoice.taxAmount)));
  const [lines, setLines] = useState<LineDraft[]>(() =>
    invoice.lines.length
      ? invoice.lines.map((l) =>
          newLine({
            key: l.id,
            description: l.description,
            quantity: String(l.quantity),
            unitPrice: String(fromCents(l.unitPrice)),
          }),
        )
      : [newLine({ description: "Services" })],
  );

  const subtotal = useMemo(
    () =>
      lines.reduce((sum, line) => {
        const qty = Number(line.quantity) || 0;
        const price = toCents(Number(line.unitPrice) || 0);
        return sum + Math.round(price * qty);
      }, 0),
    [lines],
  );
  const taxCents = Math.max(0, toCents(Number(taxAmount) || 0));
  const total = subtotal + taxCents;

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set(
      "linesJson",
      JSON.stringify(
        lines.map((l) => ({
          description: l.description,
          quantity: Number(l.quantity) || 0,
          unitPrice: Number(l.unitPrice) || 0,
        })),
      ),
    );
    startTransition(async () => {
      try {
        await updateInvoice(fd);
        setOpen(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save invoice");
      }
    });
  }

  const quoted =
    invoice.quotationTotal != null && invoice.quotationTotal > 0 ? invoice.quotationTotal : null;

  return (
    <>
      <button
        type="button"
        className={size === "sm" ? "btn btn-secondary btn-sm" : "btn btn-secondary"}
        onClick={() => {
          setError(null);
          setTaxAmount(String(fromCents(invoice.taxAmount)));
          setLines(
            invoice.lines.length
              ? invoice.lines.map((l) =>
                  newLine({
                    key: l.id,
                    description: l.description,
                    quantity: String(l.quantity),
                    unitPrice: String(fromCents(l.unitPrice)),
                  }),
                )
              : [newLine({ description: "Services" })],
          );
          setOpen(true);
        }}
      >
        Edit
      </button>

      {open ? (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-invoice-title"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "grid",
            placeItems: "center",
            zIndex: 50,
            padding: "1rem",
          }}
          onClick={() => !pending && setOpen(false)}
        >
          <div
            className="panel add-entity-modal"
            style={{
              padding: "1.25rem",
              width: "min(640px, 100%)",
              maxHeight: "min(90vh, 760px)",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="row"
              style={{
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "0.75rem",
              }}
            >
              <h3 id="edit-invoice-title" style={{ margin: 0 }}>
                Edit invoice {invoice.number}
              </h3>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={pending}
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>

            <p className="muted" style={{ margin: "0 0 0.75rem", fontSize: "0.88rem" }}>
              Change line amounts when the billed figure differs from the quotation.
            </p>

            {quoted != null ? (
              <div className="info-banner" style={{ marginBottom: "0.75rem" }}>
                Quoted{invoice.quotationNumber ? ` (${invoice.quotationNumber})` : ""}:{" "}
                <strong>{formatTTD(quoted)}</strong>
                {total !== quoted ? (
                  <>
                    {" "}
                    · Invoice now <strong>{formatTTD(total)}</strong>
                  </>
                ) : null}
              </div>
            ) : null}

            {error ? (
              <div
                className="info-banner"
                style={{
                  borderColor: "var(--danger)",
                  color: "var(--danger)",
                  marginBottom: "0.75rem",
                }}
              >
                {error}
              </div>
            ) : null}

            <form className="stack" onSubmit={onSubmit} autoComplete="off" style={{ gap: "0.85rem" }}>
              <input type="hidden" name="invoiceId" value={invoice.id} />

              <div className="stack" style={{ gap: "0.5rem" }}>
                <strong style={{ fontSize: "0.88rem" }}>Lines</strong>
                {lines.map((line, i) => (
                  <div
                    key={line.key}
                    className="form-grid"
                    style={{
                      gap: "0.5rem",
                      padding: "0.5rem 0",
                      borderTop: i === 0 ? undefined : "1px solid var(--line)",
                    }}
                  >
                    <label className="field full">
                      Description
                      <input
                        value={line.description}
                        onChange={(e) =>
                          setLines((prev) =>
                            prev.map((l) =>
                              l.key === line.key ? { ...l, description: e.target.value } : l,
                            ),
                          )
                        }
                        required
                      />
                    </label>
                    <label className="field">
                      Qty
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={line.quantity}
                        onChange={(e) =>
                          setLines((prev) =>
                            prev.map((l) =>
                              l.key === line.key ? { ...l, quantity: e.target.value } : l,
                            ),
                          )
                        }
                        required
                      />
                    </label>
                    <label className="field">
                      Unit price (TT$)
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.unitPrice}
                        onChange={(e) =>
                          setLines((prev) =>
                            prev.map((l) =>
                              l.key === line.key ? { ...l, unitPrice: e.target.value } : l,
                            ),
                          )
                        }
                        required
                      />
                    </label>
                    {lines.length > 1 ? (
                      <div className="full">
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() =>
                            setLines((prev) => prev.filter((l) => l.key !== line.key))
                          }
                        >
                          Remove line
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))}
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setLines((prev) => [...prev, newLine()])}
                >
                  Add line
                </button>
              </div>

              <div className="form-grid">
                <label className="field">
                  Tax (TT$)
                  <input
                    name="taxAmount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={taxAmount}
                    onChange={(e) => setTaxAmount(e.target.value)}
                  />
                </label>
                <label className="field">
                  Due date
                  <input name="dueDate" type="date" defaultValue={invoice.dueDate ?? ""} />
                </label>
                <label className="field full">
                  Notes
                  <textarea name="notes" rows={2} defaultValue={invoice.notes ?? ""} />
                </label>
              </div>

              <div className="muted" style={{ fontSize: "0.88rem" }}>
                Subtotal {formatTTD(subtotal)} · Tax {formatTTD(taxCents)} ·{" "}
                <strong style={{ color: "var(--ink)" }}>Total {formatTTD(total)}</strong>
                {invoice.amountPaid > 0 ? ` · Paid ${formatTTD(invoice.amountPaid)}` : null}
              </div>

              <div className="row" style={{ gap: "0.5rem" }}>
                <button className="btn btn-primary" type="submit" disabled={pending}>
                  {pending ? "Saving…" : "Save changes"}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={pending}
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
