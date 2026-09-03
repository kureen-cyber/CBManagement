import Link from "next/link";
import { startOfDay, endOfDay, startOfMonth, endOfMonth } from "date-fns";
import { prisma } from "@/lib/prisma";
import { formatTTD } from "@/lib/money";
import { getBusinessType } from "@/lib/session-business";
import { requireCompany } from "@/lib/company";
import { crmCustomerCountWhere } from "@/lib/owner-drawings";
import { isRetailOnly, isServiceOnly } from "@/lib/business-type";
import { parseHomeLayout } from "@/lib/settings";
import { PageHeader, Panel } from "@/components/ui";
import { RetailDashboard } from "@/components/RetailDashboard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const businessType = await getBusinessType();
  const { company, companyId } = await requireCompany();
  const homeLayout = parseHomeLayout(company.homeLayout);

  // Pure retail keeps the focused POS home; BOTH / service get the dual overview.
  if (isRetailOnly(businessType) || (businessType === "BOTH" && homeLayout === "RETAIL")) {
    return <RetailDashboard />;
  }

  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const showPos = !isServiceOnly(businessType);
  const showService = businessType !== "RETAIL";

  const [
    posSalesMonth,
    posSalesToday,
    stockPurchasesMonth,
    stockPurchasesRows,
    equipmentExpensesMonth,
    allExpensesMonth,
    servicePaymentsMonth,
    outstandingInvoices,
    customerCount,
    employeeCount,
    products,
    posReceivableSales,
    supplierCount,
    activeJobs,
    quotationCountMonth,
  ] = await Promise.all([
    prisma.sale.aggregate({
      _sum: { total: true },
      where: {
        companyId,
        status: "COMPLETED",
        soldAt: { gte: monthStart, lte: monthEnd },
      },
    }),
    prisma.sale.aggregate({
      _sum: { total: true },
      where: {
        companyId,
        status: "COMPLETED",
        soldAt: { gte: todayStart, lte: todayEnd },
      },
    }),
    // POS expenses = stock purchases (supplier buys of materials / untyped catalog)
    prisma.supplierPurchase.findMany({
      where: {
        companyId,
        purchasedAt: { gte: monthStart, lte: monthEnd },
        OR: [
          { supplierItemId: null },
          { supplierItem: { supplyType: "MATERIAL" } },
        ],
      },
      select: { totalCost: true },
    }),
    prisma.supplierPurchase.count({
      where: {
        companyId,
        purchasedAt: { gte: monthStart, lte: monthEnd },
        OR: [
          { supplierItemId: null },
          { supplierItem: { supplyType: "MATERIAL" } },
        ],
      },
    }),
    // Service expenses = equipment purchases
    prisma.expense.aggregate({
      _sum: { amount: true },
      where: {
        companyId,
        date: { gte: monthStart, lte: monthEnd },
        OR: [
          { category: { in: ["Equipment", "Equipment rental"] } },
          { autoExpenseKind: { in: ["EQUIPMENT", "EQUIPMENT_RENTAL"] } },
        ],
      },
    }),
    // All operating expenses on the Expense ledger (equipment, labour-related, rentals, etc.)
    prisma.expense.aggregate({
      _sum: { amount: true },
      where: { companyId, date: { gte: monthStart, lte: monthEnd } },
    }),
    // Service income = payments applied to invoices this month
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        companyId,
        invoiceId: { not: null },
        paidAt: { gte: monthStart, lte: monthEnd },
      },
    }),
    prisma.invoice.findMany({
      where: { companyId, status: { in: ["SENT", "PARTIAL", "OVERDUE"] } },
      select: { total: true, amountPaid: true, dueDate: true },
    }),
    prisma.customer.count({ where: crmCustomerCountWhere(companyId) }),
    prisma.employee.count({ where: { companyId, active: true } }),
    prisma.product.findMany({ where: { companyId, trackStock: true, isService: false } }),
    prisma.sale.findMany({
      where: { companyId, status: "COMPLETED", isRefund: false },
      select: { total: true, amountPaid: true },
    }),
    prisma.supplier.count({ where: { companyId } }),
    prisma.job.count({ where: { companyId, status: "ACTIVE" } }),
    prisma.quotation.count({
      where: { companyId, createdAt: { gte: monthStart, lte: monthEnd } },
    }),
  ]);

  const posSales = Math.max(0, posSalesMonth._sum.total ?? 0);
  const posSalesTodayAmt = Math.max(0, posSalesToday._sum.total ?? 0);
  const stockSpend = stockPurchasesMonth.reduce((s, r) => s + r.totalCost, 0);
  const posProfit = posSales - stockSpend;
  const posMargin = posSales === 0 ? 0 : (posProfit / posSales) * 100;
  const lowStockCount = products.filter((p) => p.stockQty <= p.minStock).length;
  const inventoryCount = products.length;
  const posReceivableAmt = posReceivableSales.reduce(
    (sum, sale) => sum + Math.max(0, sale.total - sale.amountPaid),
    0,
  );

  const serviceIncome = servicePaymentsMonth._sum.amount ?? 0;
  const equipmentSpend = equipmentExpensesMonth._sum.amount ?? 0;
  const serviceProfit = serviceIncome - equipmentSpend;
  const serviceMargin = serviceIncome === 0 ? 0 : (serviceProfit / serviceIncome) * 100;

  const outstanding = outstandingInvoices.reduce(
    (sum, inv) => sum + (inv.total - inv.amountPaid),
    0,
  );

  const totalIncome = posSales + serviceIncome;
  const totalExpenses = stockSpend + (allExpensesMonth._sum.amount ?? 0);
  const grossProfit = totalIncome - totalExpenses;
  const profitMargin = totalIncome === 0 ? 0 : (grossProfit / totalIncome) * 100;

  return (
    <div className="stack">
      <PageHeader
        title="Business overview"
        description="POS and service standing for this month."
        actions={
          <>
            {showPos ? (
              <Link className="btn btn-secondary" href="/pos">
                Open POS
              </Link>
            ) : null}
            <Link className="btn btn-primary" href="/quotations">
              New quotation
            </Link>
            <Link className="btn btn-secondary" href="/settings">
              Settings
            </Link>
          </>
        }
      />

      <div className="dashboard-split">
        {showPos ? (
          <Panel className="dashboard-side-card" style={{ padding: "1.25rem" }}>
            <h2 style={{ margin: "0 0 0.35rem", fontSize: "1.15rem" }}>POS</h2>
            <p className="muted" style={{ margin: "0 0 1rem", fontSize: "0.85rem" }}>
              Retail sales this month. Expenses here are new stock purchased from suppliers.
            </p>
            <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
              <div className="report-stat sea">
                <div className="label">Sales</div>
                <div className="value money">{formatTTD(posSales)}</div>
                <div className="muted" style={{ fontSize: "0.75rem", marginTop: "0.25rem" }}>
                  Today {formatTTD(posSalesTodayAmt)}
                </div>
              </div>
              <div className="report-stat accent">
                <div className="label">Stock purchases</div>
                <div className="value money">{formatTTD(stockSpend)}</div>
                <div className="muted" style={{ fontSize: "0.75rem", marginTop: "0.25rem" }}>
                  {stockPurchasesRows} purchase{stockPurchasesRows === 1 ? "" : "s"}
                </div>
              </div>
              <div className="report-stat blue">
                <div className="label">Gross profit</div>
                <div className="value money">{formatTTD(posProfit)}</div>
              </div>
              <div className="report-stat purple">
                <div className="label">Margin</div>
                <div className="value">{posMargin.toFixed(1)}%</div>
              </div>
            </div>
            <div className="muted" style={{ marginTop: "0.85rem", fontSize: "0.82rem" }}>
              Low stock alerts: <strong>{lowStockCount}</strong>
              {" · "}
              Receivables:{" "}
              <Link href="/receivables">
                <strong className="money">{formatTTD(posReceivableAmt)}</strong>
              </Link>
              {" · "}
              <Link href="/inventory">Inventory {inventoryCount}</Link>
              {" · "}
              <Link href="/suppliers">Suppliers {supplierCount}</Link>
            </div>
          </Panel>
        ) : null}

        {showService ? (
          <Panel className="dashboard-side-card" style={{ padding: "1.25rem" }}>
            <h2 style={{ margin: "0 0 0.35rem", fontSize: "1.15rem" }}>Service</h2>
            <p className="muted" style={{ margin: "0 0 1rem", fontSize: "0.85rem" }}>
              Job and invoice income this month. Expenses here are equipment purchases.
            </p>
            <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
              <div className="report-stat sea">
                <div className="label">Income</div>
                <div className="value money">{formatTTD(serviceIncome)}</div>
                <div className="muted" style={{ fontSize: "0.75rem", marginTop: "0.25rem" }}>
                  Invoice payments received
                </div>
              </div>
              <div className="report-stat accent">
                <div className="label">Equipment purchases</div>
                <div className="value money">{formatTTD(equipmentSpend)}</div>
              </div>
              <div className="report-stat blue">
                <div className="label">Gross profit</div>
                <div className="value money">{formatTTD(serviceProfit)}</div>
              </div>
              <div className="report-stat purple">
                <div className="label">Margin</div>
                <div className="value">{serviceMargin.toFixed(1)}%</div>
              </div>
            </div>
            <div className="muted" style={{ marginTop: "0.85rem", fontSize: "0.82rem" }}>
              Active jobs: <strong>{activeJobs}</strong>
              {" · "}
              Quotations this month: <strong>{quotationCountMonth}</strong>
              {" · "}
              Customers owe: <strong className="money">{formatTTD(outstanding)}</strong>
            </div>
          </Panel>
        ) : null}
      </div>

      <Panel className="kpi" style={{ padding: "1.25rem" }}>
        <div className="label">Overall business standing</div>
        <p className="muted" style={{ margin: "0.35rem 0 1rem", fontSize: "0.85rem" }}>
          Combined POS + service view for this month.
        </p>
        <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
          <div>
            <div className="muted" style={{ fontSize: "0.8rem" }}>
              Customers
            </div>
            <div className="value" style={{ fontSize: "1.35rem" }}>
              {customerCount}
            </div>
          </div>
          <div>
            <div className="muted" style={{ fontSize: "0.8rem" }}>
              Employees
            </div>
            <div className="value" style={{ fontSize: "1.35rem" }}>
              {employeeCount}
            </div>
          </div>
          <div>
            <div className="muted" style={{ fontSize: "0.8rem" }}>
              Total income
            </div>
            <div className="value money" style={{ fontSize: "1.35rem" }}>
              {formatTTD(totalIncome)}
            </div>
          </div>
          <div>
            <div className="muted" style={{ fontSize: "0.8rem" }}>
              Total expenses
            </div>
            <div className="value money" style={{ fontSize: "1.35rem" }}>
              {formatTTD(totalExpenses)}
            </div>
            <div className="muted" style={{ fontSize: "0.72rem", marginTop: "0.2rem" }}>
              Stock + equipment + operating (labour, rentals, etc.)
            </div>
          </div>
          <div>
            <div className="muted" style={{ fontSize: "0.8rem" }}>
              Gross profit
            </div>
            <div className="value money" style={{ fontSize: "1.35rem" }}>
              {formatTTD(grossProfit)}
            </div>
          </div>
          <div>
            <div className="muted" style={{ fontSize: "0.8rem" }}>
              Profit margin
            </div>
            <div className="value" style={{ fontSize: "1.35rem" }}>
              {profitMargin.toFixed(1)}%
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );
}
