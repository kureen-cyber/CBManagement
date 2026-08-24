"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addJobReceipt, deleteJobReceipt } from "@/app/actions";
import { Panel } from "@/components/ui";

type ReceiptRow = {
  id: string;
  label: string | null;
  receiptData: string;
  createdAt: string;
};

export function JobReceiptsPanel({
  jobId,
  receipts,
}: {
  jobId: string;
  receipts: ReceiptRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    router.refresh();
  }

  function onAdd(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("jobId", jobId);
    startTransition(async () => {
      try {
        await addJobReceipt(fd);
        (e.target as HTMLFormElement).reset();
        refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not upload receipt");
      }
    });
  }

  return (
    <div className="stack">
      {error ? (
        <div className="info-banner" style={{ borderColor: "var(--danger)", color: "var(--danger)" }}>
          {error}
        </div>
      ) : null}

      <Panel style={{ padding: "1.25rem" }}>
        <h2 style={{ marginTop: 0, fontSize: "1.15rem" }}>Add receipt</h2>
        <p className="muted" style={{ margin: "0 0 1rem", fontSize: "0.88rem" }}>
          Upload sales receipts, delivery notes, or other proof tied to this job. You can add as many
          as you need.
        </p>
        <form className="form-grid" onSubmit={onAdd} autoComplete="off">
          <label className="field">
            Label (optional)
            <input name="label" placeholder="e.g. Hardware store, Week 2 rental" />
          </label>
          <label className="field full">
            Receipt file
            <input name="receipt" type="file" accept="image/*,.pdf,application/pdf" required />
          </label>
          <div className="full">
            <button className="btn btn-primary" type="submit" disabled={pending}>
              {pending ? "Uploading…" : "Upload receipt"}
            </button>
          </div>
        </form>
      </Panel>

      <Panel className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Uploaded</th>
              <th>Label</th>
              <th>Preview</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {receipts.map((r) => (
              <tr key={r.id}>
                <td className="muted">
                  {new Date(r.createdAt).toLocaleDateString("en-TT", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </td>
                <td>{r.label || "—"}</td>
                <td>
                  {r.receiptData.startsWith("data:application/pdf") ? (
                    <a className="btn btn-secondary btn-sm" href={r.receiptData} download="receipt.pdf">
                      View PDF
                    </a>
                  ) : (
                    <a href={r.receiptData} target="_blank" rel="noopener noreferrer">
                      <img
                        src={r.receiptData}
                        alt={r.label || "Receipt"}
                        style={{ maxHeight: 48, maxWidth: 80, objectFit: "cover", borderRadius: 4 }}
                      />
                    </a>
                  )}
                </td>
                <td>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={pending}
                    onClick={() => {
                      const fd = new FormData();
                      fd.set("id", r.id);
                      startTransition(async () => {
                        await deleteJobReceipt(fd);
                        refresh();
                      });
                    }}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
            {receipts.length === 0 ? (
              <tr>
                <td colSpan={4} className="muted">
                  No receipts uploaded for this job yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
