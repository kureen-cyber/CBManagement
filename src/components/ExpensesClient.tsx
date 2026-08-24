"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createExpense, updateExpense } from "@/app/actions";
import { CategoryInput } from "@/components/CategoryInput";
import { formatTTD } from "@/lib/money";
import { Panel } from "@/components/ui";

type ExpenseRow = {
  id: string;
  date: string;
  category: string;
  description: string | null;
  amount: number;
  jobNumber: string | null;
  receiptData: string | null;
};

export function ExpensesClient({
  jobs,
  expenses,
  categorySuggestions,
}: {
  jobs: { id: string; number: string }[];
  expenses: ExpenseRow[];
  categorySuggestions: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  function refresh() {
    router.refresh();
  }

  function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await createExpense(fd);
        (e.target as HTMLFormElement).reset();
        refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save expense");
      }
    });
  }

  function onUpdate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await updateExpense(fd);
        setEditingId(null);
        refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not update expense");
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
        <form className="form-grid" onSubmit={onCreate} autoComplete="off">
          <label className="field">
            Category
            <CategoryInput
              name="category"
              defaultValue="Materials"
              suggestions={categorySuggestions}
              listId="expense-category-suggestions"
              placeholder="e.g. Materials, Fuel, Packaging"
            />
          </label>
          <label className="field">
            Amount (TT$)
            <input name="amount" type="number" step="0.01" required />
          </label>
          <label className="field">
            Job
            <select name="jobId" defaultValue="">
              <option value="">Not job-related</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.number}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Purchase date
            <input
              name="date"
              type="date"
              defaultValue={new Date().toISOString().slice(0, 10)}
            />
          </label>
          <label className="field">
            Payment method
            <select name="paymentMethod" defaultValue="CASH">
              <option value="CASH">Cash</option>
              <option value="BANK">Bank</option>
              <option value="CARD">Card</option>
            </select>
          </label>
          <label className="field full">
            Description
            <input name="description" />
          </label>
          <label className="field full">
            Sales receipt
            <input name="receipt" type="file" accept="image/*,.pdf,application/pdf" />
            <span className="muted" style={{ fontSize: "0.78rem" }}>
              PNG, JPEG, WebP, or PDF
            </span>
          </label>
          <div className="full">
            <button className="btn btn-primary" type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save expense"}
            </button>
          </div>
        </form>
      </Panel>

      <Panel className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Purchase date</th>
              <th>Category</th>
              <th>Description</th>
              <th>Job</th>
              <th>Amount</th>
              <th>Receipt</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {expenses.map((e) =>
              editingId === e.id ? (
                <tr key={e.id}>
                  <td colSpan={7}>
                    <form className="form-grid" onSubmit={onUpdate} autoComplete="off">
                      <input type="hidden" name="id" value={e.id} />
                      <label className="field">
                        Purchase date
                        <input name="date" type="date" required defaultValue={e.date.slice(0, 10)} />
                      </label>
                      <label className="field full">
                        Replace receipt
                        <input name="receipt" type="file" accept="image/*,.pdf,application/pdf" />
                      </label>
                      {e.receiptData ? (
                        <label className="field full choice-card">
                          <input type="checkbox" name="removeReceipt" />
                          <span>Remove existing receipt</span>
                        </label>
                      ) : null}
                      <div className="full row" style={{ gap: "0.5rem" }}>
                        <button className="btn btn-primary btn-sm" type="submit" disabled={pending}>
                          Save
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => setEditingId(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </td>
                </tr>
              ) : (
                <tr key={e.id}>
                  <td>{new Date(e.date).toLocaleDateString("en-TT")}</td>
                  <td>{e.category}</td>
                  <td className="muted">{e.description ?? "—"}</td>
                  <td className="muted">{e.jobNumber ?? "—"}</td>
                  <td className="money">{formatTTD(e.amount)}</td>
                  <td>
                    {e.receiptData ? (
                      e.receiptData.startsWith("data:application/pdf") ? (
                        <a className="btn btn-secondary btn-sm" href={e.receiptData} download="receipt.pdf">
                          PDF
                        </a>
                      ) : (
                        <a href={e.receiptData} target="_blank" rel="noopener noreferrer">
                          <img
                            src={e.receiptData}
                            alt="Receipt"
                            style={{ maxHeight: 40, maxWidth: 64, objectFit: "cover", borderRadius: 4 }}
                          />
                        </a>
                      )
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setEditingId(e.id)}
                    >
                      Edit date / receipt
                    </button>
                  </td>
                </tr>
              ),
            )}
            {expenses.length === 0 ? (
              <tr>
                <td colSpan={7} className="muted">
                  No expenses yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
