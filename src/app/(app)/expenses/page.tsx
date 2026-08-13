import { prisma } from "@/lib/prisma";
import { formatTTD } from "@/lib/money";
import { EXPENSE_CATEGORIES } from "@/lib/constants";
import { createExpense } from "@/app/actions";
import { PageHeader, Panel } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  const [jobs, suppliers, expenses] = await Promise.all([
    prisma.job.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.supplier.findMany({ orderBy: { name: "asc" } }),
    prisma.expense.findMany({
      orderBy: { date: "desc" },
      include: { job: true, supplier: true },
      take: 100,
    }),
  ]);

  return (
    <div className="stack">
      <PageHeader title="Expenses" description="Simple expense entry — assign to a job for profitability." />
      <Panel style={{ padding: "1.25rem" }}>
        <form action={createExpense} className="form-grid">
          <label className="field">Category
            <select name="category" defaultValue="Materials">
              {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="field">Amount (TT$)<input name="amount" type="number" step="0.01" required /></label>
          <label className="field">Supplier
            <select name="supplierId" defaultValue="">
              <option value="">None</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label className="field">Job
            <select name="jobId" defaultValue="">
              <option value="">Not job-related</option>
              {jobs.map((j) => <option key={j.id} value={j.id}>{j.number}</option>)}
            </select>
          </label>
          <label className="field">Date<input name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} /></label>
          <label className="field">Payment method
            <select name="paymentMethod" defaultValue="CASH">
              <option value="CASH">Cash</option>
              <option value="BANK">Bank</option>
              <option value="CARD">Card</option>
            </select>
          </label>
          <label className="field full">Description<input name="description" /></label>
          <div className="full"><button className="btn btn-primary" type="submit">Save expense</button></div>
        </form>
      </Panel>
      <Panel className="table-wrap">
        <table className="data">
          <thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Job</th><th>Amount</th></tr></thead>
          <tbody>
            {expenses.map((e) => (
              <tr key={e.id}>
                <td>{e.date.toLocaleDateString("en-TT")}</td>
                <td>{e.category}</td>
                <td className="muted">{e.description ?? "—"}</td>
                <td className="muted">{e.job?.number ?? "—"}</td>
                <td className="money">{formatTTD(e.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
