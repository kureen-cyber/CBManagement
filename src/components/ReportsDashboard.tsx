"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatTTD } from "@/lib/money";
import { REPORT_PERIODS } from "@/lib/tier";
import { Panel } from "@/components/ui";
import { DocumentBranding } from "@/components/DocumentBranding";
import type { CompanyBranding } from "@/lib/settings";

export type SaleLineReport = {
  id: string;
  description: string;
  category: string;
  isService: boolean;
  quantity: number;
  lineTotal: number;
  soldAt: string;
  saleNumber: string;
  method: string;
  isRefund?: boolean;
};

export type ReportsData = {
  income: number;
  expenses: number;
  receivables: number;
  pos: number;
  posRetail: number;
  posService: number;
  serviceIncome: number;
  otherIncome: number;
  profit: number;
  grossSales: number;
  refunds: number;
  discounts: number;
  netSales: number;
  cogs: number;
  grossProfit: number;
  expenseByCategory: { category: string; amount: number }[];
  paymentMethods: { method: string; amount: number }[];
  incomeByCategory: { category: string; amount: number; kind: string }[];
  salesByItem: {
    name: string;
    category: string;
    qty: number;
    netSales: number;
    cogs: number;
    grossProfit: number;
    isService: boolean;
  }[];
  salesByCategory: { category: string; qty: number; amount: number }[];
  saleLines: SaleLineReport[];
  weekly: { label: string; income: number; expenses: number }[];
  dailyEarnings: { label: string; amount: number; date: string }[];
};

type TabId =
  | "period"
  | "overview"
  | "income"
  | "expenses"
  | "receivables"
  | "pos"
  | "by-item"
  | "by-category"
  | "sales-summary";

const TABS: { id: TabId; label: string; color: string }[] = [
  { id: "period", label: "Period", color: "#0a6b6e" },
  { id: "overview", label: "Overview", color: "#0a6b6e" },
  { id: "income", label: "Income", color: "#1f7a4d" },
  { id: "expenses", label: "Expenses", color: "#c45c26" },
  { id: "receivables", label: "Receivables", color: "#5b4db8" },
  { id: "pos", label: "POS", color: "#0e7cc0" },
  { id: "by-item", label: "By item", color: "#db2777" },
  { id: "by-category", label: "By category", color: "#b45309" },
  { id: "sales-summary", label: "Sales summary", color: "#0f766e" },
];

const CHART_COLORS = ["#0a6b6e", "#c45c26", "#1f7a4d", "#5b4db8", "#0e7cc0", "#b45309", "#db2777", "#0f766e"];
const LINE_COLOR = "#0a6b6e";

function DonutChart({
  slices,
  size = 220,
}: {
  slices: { label: string; value: number; color: string }[];
  size?: number;
}) {
  const total = slices.reduce((s, x) => s + Math.max(0, x.value), 0);
  const r = size / 2 - 18;
  const c = size / 2;
  const stroke = 28;

  if (total <= 0) {
    return (
      <div className="chart-empty">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={c} cy={c} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
          <text x={c} y={c} textAnchor="middle" dominantBaseline="middle" fill="var(--muted)" fontSize="14">
            No data yet
          </text>
        </svg>
      </div>
    );
  }

  let angle = -90;
  const arcs = slices
    .filter((s) => s.value > 0)
    .map((s) => {
      const portion = (s.value / total) * 360;
      const start = angle;
      angle += portion;
      const end = angle;
      const large = portion > 180 ? 1 : 0;
      const startRad = (start * Math.PI) / 180;
      const endRad = (end * Math.PI) / 180;
      const x1 = c + r * Math.cos(startRad);
      const y1 = c + r * Math.sin(startRad);
      const x2 = c + r * Math.cos(endRad);
      const y2 = c + r * Math.sin(endRad);
      return {
        ...s,
        d: `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`,
        pct: Math.round((s.value / total) * 100),
      };
    });

  return (
    <div className="donut-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="donut-svg">
        {arcs.map((a) => (
          <path
            key={a.label}
            d={a.d}
            fill="none"
            stroke={a.color}
            strokeWidth={stroke}
            strokeLinecap="butt"
            className="donut-slice"
          />
        ))}
        <circle cx={c} cy={c} r={r - stroke / 2 - 4} fill="var(--surface)" />
        <text x={c} y={c - 8} textAnchor="middle" className="donut-center-label">
          Total
        </text>
        <text x={c} y={c + 14} textAnchor="middle" className="donut-center-value">
          {formatTTD(total)}
        </text>
      </svg>
      <div className="chart-legend">
        {arcs.map((a) => (
          <div key={a.label} className="legend-row">
            <span className="legend-swatch" style={{ background: a.color }} />
            <span>{a.label}</span>
            <strong>{a.pct}%</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function BarChart({
  bars,
}: {
  bars: { label: string; income: number; expenses: number }[];
}) {
  const max = Math.max(1, ...bars.flatMap((b) => [b.income, b.expenses]));
  return (
    <div className="bar-chart">
      {bars.map((b) => (
        <div key={b.label} className="bar-col">
          <div className="bar-pair">
            <div
              className="bar income"
              style={{ height: `${Math.max(4, (b.income / max) * 140)}px` }}
              title={`Income ${formatTTD(b.income)}`}
            />
            <div
              className="bar expense"
              style={{ height: `${Math.max(4, (b.expenses / max) * 140)}px` }}
              title={`Expenses ${formatTTD(b.expenses)}`}
            />
          </div>
          <div className="bar-label">{b.label}</div>
        </div>
      ))}
    </div>
  );
}

function LineChart({
  points,
}: {
  points: { label: string; amount: number; date: string }[];
}) {
  const width = 640;
  const height = 220;
  const padL = 36;
  const padR = 16;
  const padT = 28;
  const padB = 36;

  if (!points.length) {
    return (
      <div className="chart-empty line-chart">
        <svg width="100%" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Daily earnings">
          <text
            x={width / 2}
            y={height / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="var(--muted)"
            fontSize="14"
          >
            No data yet
          </text>
        </svg>
      </div>
    );
  }

  const amounts = points.map((p) => p.amount);
  const max = Math.max(1, ...amounts);
  const min = Math.min(0, ...amounts);
  const span = Math.max(1, max - min);
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const n = points.length;

  const coords = points.map((p, i) => {
    const x = padL + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
    const y = padT + innerH - ((p.amount - min) / span) * innerH;
    return { ...p, x, y };
  });

  const pathD = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(" ");

  // Show amount labels sparingly: first, last, and peaks / every ~N points
  const labelStep = Math.max(1, Math.ceil(n / 5));
  const showLabel = (i: number) => i === 0 || i === n - 1 || i % labelStep === 0;

  return (
    <div className="line-chart">
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Daily earnings">
        <line
          x1={padL}
          y1={padT + innerH}
          x2={width - padR}
          y2={padT + innerH}
          stroke="var(--line)"
          strokeWidth="1"
        />
        <path d={pathD} fill="none" stroke={LINE_COLOR} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {coords.map((c, i) => (
          <g key={c.date}>
            <circle cx={c.x} cy={c.y} r={3.5} fill={LINE_COLOR} />
            {showLabel(i) && c.amount > 0 ? (
              <text
                x={c.x}
                y={c.y - 10}
                textAnchor="middle"
                fill={LINE_COLOR}
                fontSize="10"
                fontWeight="700"
              >
                {formatTTD(c.amount)}
              </text>
            ) : null}
            {(i === 0 || i === n - 1 || i % Math.max(1, Math.ceil(n / 4)) === 0) ? (
              <text
                x={c.x}
                y={height - 10}
                textAnchor="middle"
                fill="var(--muted)"
                fontSize="10"
                fontWeight="600"
              >
                {c.label}
              </text>
            ) : null}
          </g>
        ))}
      </svg>
    </div>
  );
}

function MetricStrip({
  items,
}: {
  items: { label: string; value: string; tone: string }[];
}) {
  return (
    <div className="report-metric-strip">
      {items.map((item) => (
        <div key={item.label} className="report-metric" style={{ ["--tone" as string]: item.tone }}>
          <div className="label">{item.label}</div>
          <div className="value">{item.value}</div>
        </div>
      ))}
    </div>
  );
}

function SearchBar({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <input
      className="report-search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  );
}

export function ReportsDashboard({
  data,
  planTier: _planTier,
  periodId,
  periodLabel,
  periodClamped,
  freeMaxDays,
  isFree,
  branding,
}: {
  data: ReportsData;
  planTier: string;
  periodId: "7" | "14" | "31" | "90" | "month";
  periodLabel: string;
  periodClamped: boolean;
  freeMaxDays: number;
  isFree: boolean;
  branding?: CompanyBranding;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>("overview");
  const [itemQuery, setItemQuery] = useState("");
  const [categoryQuery, setCategoryQuery] = useState("");
  const [summaryQuery, setSummaryQuery] = useState("");

  const overviewSlices = useMemo(
    () => [
      { label: "POS retail", value: data.posRetail, color: "#0e7cc0" },
      { label: "POS / service sales", value: data.posService, color: "#5b4db8" },
      { label: "Other income", value: data.otherIncome, color: "#1f7a4d" },
      { label: "Expenses", value: data.expenses, color: "#c45c26" },
      { label: "Receivables", value: data.receivables, color: "#b45309" },
    ],
    [data],
  );

  const incomeSlices = useMemo(
    () =>
      data.incomeByCategory.map((e, i) => ({
        label: e.category,
        value: e.amount,
        color: CHART_COLORS[i % CHART_COLORS.length],
      })),
    [data.incomeByCategory],
  );

  const expenseSlices = useMemo(
    () =>
      data.expenseByCategory.map((e, i) => ({
        label: e.category,
        value: e.amount,
        color: CHART_COLORS[i % CHART_COLORS.length],
      })),
    [data.expenseByCategory],
  );

  const filteredItems = useMemo(() => {
    const q = itemQuery.trim().toLowerCase();
    if (!q) return data.salesByItem;
    return data.salesByItem.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q),
    );
  }, [data.salesByItem, itemQuery]);

  const filteredCategories = useMemo(() => {
    const q = categoryQuery.trim().toLowerCase();
    if (!q) return data.salesByCategory;
    return data.salesByCategory.filter((r) => r.category.toLowerCase().includes(q));
  }, [data.salesByCategory, categoryQuery]);

  const filteredLines = useMemo(() => {
    const q = summaryQuery.trim().toLowerCase();
    if (!q) return data.saleLines;
    return data.saleLines.filter(
      (r) =>
        r.description.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        r.saleNumber.toLowerCase().includes(q) ||
        r.method.toLowerCase().includes(q),
    );
  }, [data.saleLines, summaryQuery]);

  return (
    <div className="stack reports-dashboard">
      <Panel className="reports-hero">
        {branding ? (
          <div style={{ marginBottom: "1rem" }}>
            <DocumentBranding company={branding} documentTitle="Reports" />
          </div>
        ) : null}
        <div className="reports-hero-copy">
          <h2>{periodLabel} at a glance</h2>
          <p className="muted">
            POS retail + service income together, with search by item, category, and sales summary.
          </p>
        </div>
        <MetricStrip
          items={[
            { label: "Total income", value: formatTTD(data.income), tone: "#1f7a4d" },
            { label: "Expenses", value: formatTTD(data.expenses), tone: "#c45c26" },
            { label: "Profit", value: formatTTD(data.profit), tone: data.profit >= 0 ? "#0a6b6e" : "#b42318" },
            { label: "POS", value: formatTTD(data.pos), tone: "#0e7cc0" },
          ]}
        />

        <div className="reports-diagrams">
          <div className="diagram-card">
            <h3>Money mix</h3>
            <DonutChart slices={overviewSlices} />
          </div>
          <div className="diagram-card">
            <h3>Daily earnings</h3>
            <LineChart points={data.dailyEarnings} />
          </div>
        </div>
        {data.weekly.length > 0 ? (
          <div className="diagram-card" style={{ marginTop: "1rem" }}>
            <h3>Weekly flow</h3>
            <BarChart bars={data.weekly} />
            <div className="bar-key">
              <span>
                <i className="swatch income" /> Income
              </span>
              <span>
                <i className="swatch expense" /> Expenses
              </span>
            </div>
          </div>
        ) : null}
      </Panel>

      <div className="settings-tabs report-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={tab === t.id ? "settings-tab active" : "settings-tab"}
            style={tab === t.id ? { boxShadow: `inset 0 -2px 0 ${t.color}`, color: t.color } : undefined}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "period" ? (
        <Panel className="report-tab-panel">
          <h3>Period</h3>
          <p className="muted">
            Showing <strong>{periodLabel}</strong>. Choose a range to reload reports for this period.
          </p>
          {periodClamped ? (
            <div className="period-clamp-banner" role="status">
              Free tiers are capped at {freeMaxDays} days. Your selection was adjusted to fit that window.
            </div>
          ) : null}
          <div className="period-chooser" role="group" aria-label="Report period">
            {REPORT_PERIODS.map((p) => {
              const disabled = isFree && !p.freeAllowed;
              const active = periodId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  className={active ? "period-chip active" : "period-chip"}
                  disabled={disabled}
                  title={disabled ? `Upgrade to unlock ${p.label.toLowerCase()}` : undefined}
                  onClick={() => router.push(`/reports?period=${p.id}`)}
                >
                  {p.label}
                  {disabled ? <span className="period-chip-note">Standard+</span> : null}
                </button>
              );
            })}
          </div>
          {isFree ? (
            <p className="muted" style={{ marginTop: "0.85rem", fontSize: "0.85rem" }}>
              Last 90 days is available on Standard plans. Free tiers can view up to {freeMaxDays} days.
            </p>
          ) : null}
        </Panel>
      ) : null}

      {tab === "overview" ? (
        <Panel className="report-tab-panel">
          <h3>Overview</h3>
          <p className="muted">
            Estimated profit this period: <strong className="money">{formatTTD(data.profit)}</strong>
          </p>
          <div className="kpi-grid" style={{ marginTop: "1rem" }}>
            <div className="report-stat sea">
              <div className="label">Total income</div>
              <div className="value money">{formatTTD(data.income)}</div>
            </div>
            <div className="report-stat accent">
              <div className="label">Expenses</div>
              <div className="value money">{formatTTD(data.expenses)}</div>
            </div>
            <div className="report-stat purple">
              <div className="label">Receivables</div>
              <div className="value money">{formatTTD(data.receivables)}</div>
            </div>
            <div className="report-stat blue">
              <div className="label">POS sales</div>
              <div className="value money">{formatTTD(data.pos)}</div>
            </div>
          </div>
        </Panel>
      ) : null}

      {tab === "income" ? (
        <Panel className="report-tab-panel">
          <h3>Income</h3>
          <p className="muted">
            POS retail sales and service income are both included, broken down by category.
          </p>
          <div className="kpi-grid" style={{ marginTop: "0.75rem", gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
            <div className="report-stat blue">
              <div className="label">POS retail</div>
              <div className="value money">{formatTTD(data.posRetail)}</div>
            </div>
            <div className="report-stat purple">
              <div className="label">Service income</div>
              <div className="value money">{formatTTD(data.serviceIncome)}</div>
            </div>
            <div className="report-stat sea">
              <div className="label">Other payments</div>
              <div className="value money">{formatTTD(data.otherIncome)}</div>
            </div>
          </div>
          <div style={{ marginTop: "1rem" }}>
            <DonutChart
              slices={
                incomeSlices.length
                  ? incomeSlices
                  : [{ label: "No income", value: 0, color: "#ccc" }]
              }
            />
          </div>
          <div className="stack" style={{ marginTop: "1rem" }}>
            {data.incomeByCategory.map((row) => (
              <div key={`${row.kind}-${row.category}`} className="row" style={{ justifyContent: "space-between" }}>
                <span>
                  {row.category}
                  <span className="muted" style={{ marginLeft: "0.45rem", fontSize: "0.8rem" }}>
                    {row.kind}
                  </span>
                </span>
                <strong className="money">{formatTTD(row.amount)}</strong>
              </div>
            ))}
            {data.incomeByCategory.length === 0 ? (
              <div className="muted">No income recorded this period yet.</div>
            ) : null}
            <div
              className="row"
              style={{ justifyContent: "space-between", borderTop: "1px solid var(--line)", paddingTop: "0.75rem" }}
            >
              <strong>Total income</strong>
              <strong className="money">{formatTTD(data.income)}</strong>
            </div>
          </div>
        </Panel>
      ) : null}

      {tab === "expenses" ? (
        <Panel className="report-tab-panel">
          <h3>Expenses</h3>
          <p className="muted">Where money went this period.</p>
          <DonutChart
            slices={
              expenseSlices.length
                ? expenseSlices
                : [{ label: "No expenses", value: 0, color: "#ccc" }]
            }
          />
          <div className="stack" style={{ marginTop: "1rem" }}>
            {data.expenseByCategory.map((e) => (
              <div key={e.category} className="row" style={{ justifyContent: "space-between" }}>
                <span>{e.category}</span>
                <strong className="money">{formatTTD(e.amount)}</strong>
              </div>
            ))}
            {data.expenseByCategory.length === 0 ? (
              <div className="muted">No expenses recorded this period yet.</div>
            ) : null}
          </div>
        </Panel>
      ) : null}

      {tab === "receivables" ? (
        <Panel className="report-tab-panel">
          <h3>Accounts receivable</h3>
          <p className="muted">Money customers still owe you on open invoices.</p>
          <div className="report-stat purple" style={{ maxWidth: 320, marginTop: "0.75rem" }}>
            <div className="label">Outstanding</div>
            <div className="value money">{formatTTD(data.receivables)}</div>
          </div>
        </Panel>
      ) : null}

      {tab === "pos" ? (
        <Panel className="report-tab-panel">
          <h3>Point of sale</h3>
          <p className="muted">Counter sales this period, including fixed-price services sold on POS.</p>
          <div className="kpi-grid" style={{ marginTop: "0.75rem", gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
            <div className="report-stat blue">
              <div className="label">POS total</div>
              <div className="value money">{formatTTD(data.pos)}</div>
            </div>
            <div className="report-stat sea">
              <div className="label">Retail items</div>
              <div className="value money">{formatTTD(data.posRetail)}</div>
            </div>
            <div className="report-stat purple">
              <div className="label">Services on POS</div>
              <div className="value money">{formatTTD(data.posService)}</div>
            </div>
          </div>
        </Panel>
      ) : null}

      {tab === "by-item" ? (
        <Panel className="report-tab-panel">
          <h3>Sales by item</h3>
          <p className="muted">Item name, category, qty sold, net sales, cost of goods, and gross profit.</p>
          <SearchBar value={itemQuery} onChange={setItemQuery} placeholder="Search item name or category…" />
          <div className="table-wrap" style={{ marginTop: "1rem" }}>
            <table className="data">
              <thead>
                <tr>
                  <th>Item name</th>
                  <th>Category</th>
                  <th>Qty sold</th>
                  <th>Net sales</th>
                  <th>Cost of goods</th>
                  <th>Gross profit</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((r) => (
                  <tr key={`${r.name}-${r.category}`}>
                    <td>
                      <strong>{r.name}</strong>
                      <div className="muted" style={{ fontSize: "0.75rem" }}>
                        {r.isService ? "Service" : "Retail"}
                      </div>
                    </td>
                    <td>{r.category}</td>
                    <td>{r.qty}</td>
                    <td className="money">{formatTTD(r.netSales)}</td>
                    <td className="money">{formatTTD(r.cogs)}</td>
                    <td className="money">{formatTTD(r.grossProfit)}</td>
                  </tr>
                ))}
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="muted">
                      No matching items this period.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : null}

      {tab === "by-category" ? (
        <Panel className="report-tab-panel">
          <h3>Search by category</h3>
          <SearchBar value={categoryQuery} onChange={setCategoryQuery} placeholder="Search category…" />
          <div style={{ marginTop: "1rem" }}>
            <DonutChart
              slices={filteredCategories.map((c, i) => ({
                label: c.category,
                value: c.amount,
                color: CHART_COLORS[i % CHART_COLORS.length],
              }))}
            />
          </div>
          <div className="table-wrap" style={{ marginTop: "1rem" }}>
            <table className="data">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Qty sold</th>
                  <th>Sales</th>
                </tr>
              </thead>
              <tbody>
                {filteredCategories.map((r) => (
                  <tr key={r.category}>
                    <td>
                      <strong>{r.category}</strong>
                    </td>
                    <td>{r.qty}</td>
                    <td className="money">{formatTTD(r.amount)}</td>
                  </tr>
                ))}
                {filteredCategories.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="muted">
                      No matching categories this period.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : null}

      {tab === "sales-summary" ? (
        <Panel className="report-tab-panel">
          <h3>Sales summary</h3>
          <p className="muted">
            Gross sales, refunds, discounts, net sales, and gross profit for{" "}
            <strong>{periodLabel}</strong>.
          </p>
          <div className="kpi-grid sales-summary-kpis" style={{ marginTop: "0.85rem" }}>
            <div className="report-stat blue">
              <div className="label">Gross sales</div>
              <div className="value money">{formatTTD(data.grossSales)}</div>
            </div>
            <div className="report-stat accent">
              <div className="label">Refunds</div>
              <div className="value money">{formatTTD(data.refunds)}</div>
            </div>
            <div className="report-stat purple">
              <div className="label">Discounts</div>
              <div className="value money">{formatTTD(data.discounts)}</div>
            </div>
            <div className="report-stat sea">
              <div className="label">Net sales</div>
              <div className="value money">{formatTTD(data.netSales)}</div>
            </div>
            <div className="report-stat" style={{ borderColor: "rgba(31, 122, 77, 0.35)" }}>
              <div className="label">Gross profit</div>
              <div className="value money">{formatTTD(data.grossProfit)}</div>
              <div className="muted" style={{ fontSize: "0.75rem", marginTop: "0.25rem" }}>
                Net sales − COGS ({formatTTD(data.cogs)})
              </div>
            </div>
          </div>
          <SearchBar
            value={summaryQuery}
            onChange={setSummaryQuery}
            placeholder="Search receipt, item, category, or method…"
          />
          <div className="table-wrap" style={{ marginTop: "1rem" }}>
            <table className="data">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Receipt</th>
                  <th>Item</th>
                  <th>Category</th>
                  <th>Type</th>
                  <th>Qty</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {filteredLines.map((r) => (
                  <tr key={r.id}>
                    <td>{new Date(r.soldAt).toLocaleString("en-TT")}</td>
                    <td>
                      {r.saleNumber}
                      {r.isRefund ? (
                        <span className="muted" style={{ display: "block", fontSize: "0.75rem" }}>
                          Refund
                        </span>
                      ) : null}
                    </td>
                    <td>
                      <strong>{r.description}</strong>
                    </td>
                    <td>{r.category}</td>
                    <td>{r.isService ? "Service" : "Retail"}</td>
                    <td>{r.quantity}</td>
                    <td className="money">{formatTTD(r.lineTotal)}</td>
                  </tr>
                ))}
                {filteredLines.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="muted">
                      No sales lines this period.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
