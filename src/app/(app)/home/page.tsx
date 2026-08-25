import Link from "next/link";
import { startOfDay, endOfDay, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { prisma } from "@/lib/prisma";
import { formatTTD } from "@/lib/money";
import { getBusinessType } from "@/lib/session-business";
import { requireCompany } from "@/lib/company";
import { isRetailOnly } from "@/lib/business-type";
import { parseHomeLayout } from "@/lib/settings";
import { PageHeader, Panel } from "@/components/ui";
import { RetailDashboard } from "@/components/RetailDashboard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const businessType = await getBusinessType();
  const { company, companyId } = await requireCompany();
  const homeLayout = parseHomeLayout(company.homeLayout);

  if (isRetailOnly(businessType) || (businessType === "BOTH" && homeLayout === "RETAIL")) {
    return <RetailDashboard />;
  }

  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const prevMonthStart = startOfMonth(subMonths(now, 1));
  const prevMonthEnd = endOfMonth(subMonths(now, 1));

  const [
    expensesToday,
    outstandingInvoices,
    customerCount,
    employeeCount,
    activeJobs,
    monthSales,
    monthExpenses,
    prevMonthSales,
    overdueInvoices,
    dueThisWeek,
    products,
    salesToday,
  ] = await Promise.all([
    prisma.expense.aggregate({
      _sum: { amount: true },
      where: { companyId, date: { gte: todayStart, lte: todayEnd } },
    }),
    prisma.invoice.findMany({
      where: { companyId, status: { in: ["SENT", "PARTIAL", "OVERDUE"] } },
      select: { total: true, amountPaid: true, dueDate: true },
    }),
    prisma.customer.count({ where: { companyId } }),
    prisma.employee.count({ where: { companyId, active: true } }),
    prisma.job.count({ where: { companyId, status: "ACTIVE" } }),
    // COMPLETED only (excludes VOID open/voided tickets); refunds are negative → net sales
    prisma.sale.aggregate({
      _sum: { total: true },
      where: {
        companyId,
        status: "COMPLETED",
        soldAt: { gte: monthStart, lte: monthEnd },
      },
    }),
    prisma.expense.aggregate({
      _sum: { amount: true },
      where: { companyId, date: { gte: monthStart, lte: monthEnd } },
    }),
    prisma.sale.aggregate({
      _sum: { total: true },
      where: {
        companyId,
        status: "COMPLETED",
        soldAt: { gte: prevMonthStart, lte: prevMonthEnd },
      },
    }),
    prisma.invoice.count({
      where: {
        companyId,
        status: { in: ["SENT", "PARTIAL", "OVERDUE"] },
        dueDate: { lt: todayStart },
      },
    }),
    prisma.invoice.findMany({
      where: {
        companyId,
        status: { in: ["SENT", "PARTIAL", "OVERDUE"] },
        dueDate: {
          gte: todayStart,
          lte: new Date(todayStart.getTime() + 7 * 24 * 60 * 60 * 1000),
        },
      },
      select: { total: true, amountPaid: true },
    }),
    prisma.product.findMany({ where: { companyId, trackStock: true, isService: false } }),
    prisma.sale.aggregate({
      _sum: { total: true },
      where: {
        companyId,
        status: "COMPLETED",
        soldAt: { gte: todayStart, lte: todayEnd },
      },
    }),
  ]);

  const lowStockCount = products.filter((p) => p.stockQty <= p.minStock).length;
  const salesTodayAmt = Math.max(0, salesToday._sum.total ?? 0);
  const expensesTodayAmt = expensesToday._sum.amount ?? 0;
  const grossToday = salesTodayAmt - expensesTodayAmt;

  const outstanding = outstandingInvoices.reduce(
    (sum, inv) => sum + (inv.total - inv.amountPaid),
    0,
  );
  const overdueAmt = outstandingInvoices
    .filter((inv) => inv.dueDate && inv.dueDate < todayStart)
    .reduce((sum, inv) => sum + (inv.total - inv.amountPaid), 0);
  const dueWeekAmt = dueThisWeek.reduce(
    (sum, inv) => sum + (inv.total - inv.amountPaid),
    0,
  );
  const notYetDue = Math.max(0, outstanding - overdueAmt - dueWeekAmt);

  const salesMonth = Math.max(0, monthSales._sum.total ?? 0);
  const expensesMonth = monthExpenses._sum.amount ?? 0;
  const profitMonth = salesMonth - expensesMonth;
  const margin = salesMonth === 0 ? 0 : (profitMonth / salesMonth) * 100;
  const prevSales = Math.max(0, prevMonthSales._sum.total ?? 0);
  const salesChange =
    prevSales === 0 ? (salesMonth > 0 ? 100 : 0) : ((salesMonth - prevSales) / prevSales) * 100;

  return (
    <div className="stack">
      <PageHeader
        title="Today's Business"
        description="Plain numbers. No accounting jargon."
        actions={
          <>
            {businessType !== "SERVICE" ? (
              <Link className="btn btn-secondary" href="/pos">
                Open POS
              </Link>
            ) : null}
            <Link className="btn btn-primary" href="/invoices">
              New invoice
            </Link>
            <Link className="btn btn-secondary" href="/settings">
              Settings
            </Link>
          </>
        }
      />

      <div className="kpi-grid">
        <Panel className="kpi">
          <div className="label">Sales today</div>
          <div className="value money">{formatTTD(salesTodayAmt)}</div>
        </Panel>
        <Panel className="kpi">
          <div className="label">Expenses today</div>
          <div className="value money">{formatTTD(expensesTodayAmt)}</div>
        </Panel>
        <Panel className="kpi">
          <div className="label">Gross profit</div>
          <div className="value money">{formatTTD(grossToday)}</div>
        </Panel>
        <Panel className="kpi">
          <div className="label">Money customers owe you</div>
          <div className="value money">{formatTTD(outstanding)}</div>
          <div className="hint">
            Overdue {formatTTD(overdueAmt)} · Due this week {formatTTD(dueWeekAmt)} · Not yet due{" "}
            {formatTTD(notYetDue)}
          </div>
        </Panel>
      </div>

      <div className="kpi-grid">
        <Panel className="kpi">
          <div className="label">Low stock items</div>
          <div className="value">{lowStockCount}</div>
        </Panel>
        <Panel className="kpi">
          <div className="label">Customers</div>
          <div className="value">{customerCount}</div>
        </Panel>
        <Panel className="kpi">
          <div className="label">Employees</div>
          <div className="value">{employeeCount}</div>
        </Panel>
        <Panel className="kpi">
          <div className="label">Active jobs</div>
          <div className="value">{activeJobs}</div>
        </Panel>
      </div>

      <Panel className="kpi">
        <div className="label">Your business this month</div>
        <div className="row" style={{ marginTop: "0.75rem", gap: "2rem" }}>
          <div>
            <div className="muted" style={{ fontSize: "0.8rem" }}>Sales</div>
            <div className="value money" style={{ fontSize: "1.4rem" }}>{formatTTD(salesMonth)}</div>
          </div>
          <div>
            <div className="muted" style={{ fontSize: "0.8rem" }}>Expenses</div>
            <div className="value money" style={{ fontSize: "1.4rem" }}>{formatTTD(expensesMonth)}</div>
          </div>
          <div>
            <div className="muted" style={{ fontSize: "0.8rem" }}>Estimated profit</div>
            <div className="value money" style={{ fontSize: "1.4rem" }}>{formatTTD(profitMonth)}</div>
          </div>
          <div>
            <div className="muted" style={{ fontSize: "0.8rem" }}>Profit margin</div>
            <div className="value" style={{ fontSize: "1.4rem" }}>{margin.toFixed(1)}%</div>
          </div>
        </div>
        <div className="insight" style={{ marginTop: "1rem" }}>
          Your sales are {Math.abs(salesChange).toFixed(0)}%{" "}
          {salesChange >= 0 ? "higher" : "lower"} than last month
          {overdueInvoices > 0 ? ` · ${overdueInvoices} overdue invoice(s)` : ""}.
        </div>
      </Panel>
    </div>
  );
}
