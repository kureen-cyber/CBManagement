import Link from "next/link";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { formatTTD } from "@/lib/money";
import { PageHeader, Panel, StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function DemoPage() {
  const cookieStore = await cookies();
  const demo = cookieStore.get("cbm_demo")?.value === "1";

  const [customers, quotes, jobs, invoices, products, sales, payments] = await Promise.all([
    prisma.customer.findMany({ take: 5, orderBy: { name: "asc" } }),
    prisma.quotation.findMany({ take: 5, orderBy: { createdAt: "desc" }, include: { customer: true } }),
    prisma.job.findMany({ take: 5, orderBy: { createdAt: "desc" }, include: { customer: true } }),
    prisma.invoice.findMany({ take: 5, orderBy: { createdAt: "desc" }, include: { customer: true } }),
    prisma.product.findMany({ take: 6, orderBy: { name: "asc" } }),
    prisma.sale.findMany({ take: 5, orderBy: { soldAt: "desc" } }),
    prisma.payment.findMany({ take: 5, orderBy: { paidAt: "desc" }, include: { customer: true } }),
  ]);

  return (
    <div className="stack">
      <PageHeader
        title="Demo"
        description="Browse sample Caribbean business data — no signup required."
        actions={
          <>
            <EnterDemoButton active={demo} />
            <Link className="btn btn-primary" href="/pos">
              Try POS
            </Link>
            <Link className="btn btn-secondary" href="/login">
              Sign in
            </Link>
          </>
        }
      />

      <div className="demo-banner">
        Follow the flow: <strong>Customers → Quotes → Jobs → Inventory → Invoices → Payments → Profit</strong>.
        Use the sidebar to open each module. Demo mode sets a cookie so you can explore freely.
      </div>

      <div className="kpi-grid">
        <Panel className="kpi">
          <div className="label">Sample customers</div>
          <div className="value">{customers.length}</div>
          <div className="hint"><Link href="/customers">Open customers →</Link></div>
        </Panel>
        <Panel className="kpi">
          <div className="label">Active jobs</div>
          <div className="value">{jobs.filter((j) => j.status === "ACTIVE").length}</div>
          <div className="hint"><Link href="/jobs">Open jobs →</Link></div>
        </Panel>
        <Panel className="kpi">
          <div className="label">Products for POS</div>
          <div className="value">{products.length}</div>
          <div className="hint"><Link href="/pos">Ring up a sale →</Link></div>
        </Panel>
        <Panel className="kpi">
          <div className="label">Recent POS sales</div>
          <div className="value">{sales.length}</div>
        </Panel>
      </div>

      <div className="kpi-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <Panel className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Quotes</th>
                <th>Customer</th>
                <th>Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((q) => (
                <tr key={q.id}>
                  <td><Link href="/quotations"><strong>{q.number}</strong></Link></td>
                  <td>{q.customer.name}</td>
                  <td className="money">{formatTTD(q.total)}</td>
                  <td><StatusBadge status={q.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Invoices</th>
                <th>Customer</th>
                <th>Due</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td><Link href="/invoices"><strong>{inv.number}</strong></Link></td>
                  <td>{inv.customer.name}</td>
                  <td className="money">{formatTTD(inv.total - inv.amountPaid)}</td>
                  <td><StatusBadge status={inv.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>

      <Panel className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Tour stops</th>
              <th>What to try</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><Link href="/customers"><strong>Customers</strong></Link></td>
              <td className="muted">Open ABC Construction Ltd. — balance, quotes, jobs in one profile.</td>
            </tr>
            <tr>
              <td><Link href="/quotations"><strong>Quotations</strong></Link></td>
              <td className="muted">Accept a quote to create a Job + Invoice automatically.</td>
            </tr>
            <tr>
              <td><Link href="/jobs"><strong>Jobs</strong></Link></td>
              <td className="muted">Check JOB-2026-0145 profitability: contract vs labour/materials/expenses.</td>
            </tr>
            <tr>
              <td><Link href="/pos"><strong>POS</strong></Link></td>
              <td className="muted">Add cable or labour to the cart and complete a cash sale.</td>
            </tr>
            <tr>
              <td><Link href="/inventory"><strong>Inventory</strong></Link></td>
              <td className="muted">See stock drop after POS usage and low-stock flags.</td>
            </tr>
            <tr>
              <td><Link href="/payments"><strong>Payments</strong></Link></td>
              <td className="muted">
                Latest: {payments[0] ? `${payments[0].customer.name} ${formatTTD(payments[0].amount)}` : "none yet"}
              </td>
            </tr>
          </tbody>
        </table>
      </Panel>
    </div>
  );
}

function EnterDemoButton({ active }: { active: boolean }) {
  return (
    <form
      action={async () => {
        "use server";
        const { cookies } = await import("next/headers");
        const { redirect } = await import("next/navigation");
        const store = await cookies();
        store.set("cbm_demo", "1", {
          httpOnly: true,
          sameSite: "lax",
          path: "/",
          maxAge: 60 * 60 * 24 * 7,
        });
        redirect("/demo");
      }}
    >
      <button className="btn btn-accent" type="submit">
        {active ? "Demo active" : "Enter Demo mode"}
      </button>
    </form>
  );
}
