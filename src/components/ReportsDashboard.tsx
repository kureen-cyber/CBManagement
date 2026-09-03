"use client";

import { Fragment, useMemo, useState } from "react";
import { PeriodSelector } from "@/components/PeriodSelector";
import type { ResolvedDateRange } from "@/lib/date-range";
import { formatTTD, fromCents } from "@/lib/money";
import { Panel } from "@/components/ui";
import { DocumentBranding } from "@/components/DocumentBranding";
import type { CompanyBranding } from "@/lib/settings";
import { formatAppDate, formatAppDateTime } from "@/lib/timezone";

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
  payables: number;
  pos: number;
  posRetail: number;
  posService: number;
  serviceIncome: number;
  otherIncome: number;
  posReceivables: number;
  serviceReceivables: number;
  totalRevenue: number;
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
    variant: string | null;
    category: string;
    qty: number;
    netSales: number;
    cogs: number;
    grossProfit: number;
    isService: boolean;
  }[];
  salesByCategory: { category: string; qty: number; amount: number }[];
  receipts: {
    id: string;
    soldAt: string;
    number: string;
    employeeName: string | null;
    customerName: string | null;
    type: string;
    total: number;
  }[];
  saleLines: SaleLineReport[];
  dailyEarnings: { label: string; amount: number; date: string }[];
  salesSummaryByDay: {
    date: string;
    grossSales: number;
    refunds: number;
    discounts: number;
    netSales: number;
    cogs: number;
    grossProfit: number;
  }[];
};

type TabId =
  | "period"
  | "overview"
  | "income"
  | "expenses"
  | "receivables"
  | "payables"
  | "pos"
  | "by-item"
  | "by-category"
  | "receipts"
  | "sales-summary"
  | "refunds";

const TABS: { id: TabId; label: string; color: string }[] = [
  { id: "period", label: "Period", color: "#0a6b6e" },
  { id: "overview", label: "Overview", color: "#0a6b6e" },
  { id: "income", label: "Income", color: "#1f7a4d" },
  { id: "expenses", label: "Expenses", color: "#c45c26" },
  { id: "receivables", label: "Receivables", color: "#5b4db8" },
  { id: "payables", label: "Payables", color: "#9333ea" },
  { id: "pos", label: "POS", color: "#0e7cc0" },
  { id: "by-item", label: "By item", color: "#db2777" },
  { id: "by-category", label: "By category", color: "#b45309" },
  { id: "receipts", label: "Receipts", color: "#475569" },
  { id: "sales-summary", label: "Sales summary", color: "#0f766e" },
  { id: "refunds", label: "Refunds", color: "#b42318" },
];

const CHART_COLORS = ["#0a6b6e", "#c45c26", "#1f7a4d", "#5b4db8", "#0e7cc0", "#b45309", "#db2777", "#0f766e"];
const LINE_COLOR = "#0a6b6e";
const EXPENSE_COLOR = "#b42318";

function formatAxisAmount(cents: number): string {
  const dollars = fromCents(cents);
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M`;
  if (dollars >= 1_000) return `$${(dollars / 1_000).toFixed(dollars >= 10_000 ? 0 : 1)}k`;
  return `$${Math.round(dollars)}`;
}

function axisTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0];
  const step = max / count;
  return Array.from({ length: count + 1 }, (_, i) => Math.round((step * i) / 100) * 100);
}

function DonutChart({
  slices,
  size = 220,
  showCenterTotal = true,
  centerLabel = "Total",
}: {
  slices: { label: string; value: number; color: string }[];
  size?: number;
  showCenterTotal?: boolean;
  centerLabel?: string;
}) {
  const total = slices.reduce((s, x) => s + Math.max(0, x.value), 0);
  const r = size / 2 - Math.max(12, size * 0.08);
  const c = size / 2;
  const stroke = Math.max(16, Math.round(size * 0.12));

  if (total <= 0) {
    return (
      <div className="chart-empty">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={c} cy={c} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
          <text x={c} y={c} textAnchor="middle" dominantBaseline="middle" fill="var(--muted)" fontSize="12">
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
        <circle cx={c} cy={c} r={r - stroke / 2 - 3} fill="var(--surface)" />
        {showCenterTotal ? (
          <>
            <text x={c} y={c - 6} textAnchor="middle" className="donut-center-label">
              {centerLabel}
            </text>
            <text x={c} y={c + 10} textAnchor="middle" className="donut-center-value">
              {formatTTD(total)}
            </text>
          </>
        ) : null}
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

function LineChart({
  points,
  height = 160,
  ariaLabel = "Line chart",
}: {
  points: { label: string; amount: number; date: string }[];
  height?: number;
  ariaLabel?: string;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const width = 640;
  const padL = 52;
  const padR = 12;
  const padT = 22;
  const padB = 28;

  if (!points.length) {
    return (
      <div className="chart-empty line-chart">
        <svg width="100%" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={ariaLabel}>
          <text
            x={width / 2}
            y={height / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="var(--muted)"
            fontSize="12"
          >
            No data yet
          </text>
        </svg>
      </div>
    );
  }

  const amounts = points.map((p) => p.amount);
  const max = Math.max(1, ...amounts);
  const min = 0;
  const span = Math.max(1, max - min);
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const n = points.length;
  const yTicks = axisTicks(max);

  const coords = points.map((p, i) => {
    const x = padL + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
    const y = padT + innerH - ((p.amount - min) / span) * innerH;
    return { ...p, x, y };
  });

  const pathD = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(" ");
  const labelStep = Math.max(1, Math.ceil(n / 4));
  const hovered = hoveredIndex != null ? coords[hoveredIndex] : null;

  return (
    <div className="line-chart">
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={ariaLabel}>
        {yTicks.map((tick) => {
          const y = padT + innerH - ((tick - min) / span) * innerH;
          return (
            <g key={tick}>
              <line
                x1={padL}
                y1={y}
                x2={width - padR}
                y2={y}
                stroke="var(--line)"
                strokeWidth="1"
                strokeDasharray={tick === 0 ? undefined : "2 3"}
                opacity={tick === 0 ? 1 : 0.55}
              />
              <text x={padL - 6} y={y + 3} textAnchor="end" fill="var(--muted)" fontSize="8" fontWeight="600">
                {formatAxisAmount(tick)}
              </text>
            </g>
          );
        })}
        <path
          d={pathD}
          fill="none"
          stroke={LINE_COLOR}
          strokeWidth="2.25"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {coords.map((c, i) => (
          <g key={c.date}>
            <circle
              cx={c.x}
              cy={c.y}
              r={hoveredIndex === i ? 5 : 8}
              fill="transparent"
              style={{ cursor: "pointer" }}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
            />
            <circle
              cx={c.x}
              cy={c.y}
              r={hoveredIndex === i ? 4.5 : 3}
              fill={LINE_COLOR}
              pointerEvents="none"
            />
            {i === 0 || i === n - 1 || i % labelStep === 0 ? (
              <text
                x={c.x}
                y={height - 8}
                textAnchor="middle"
                fill="var(--muted)"
                fontSize="9"
                fontWeight="600"
              >
                {c.label}
              </text>
            ) : null}
          </g>
        ))}
        {hovered ? (
          <g pointerEvents="none">
            <rect
              x={Math.min(Math.max(hovered.x - 54, padL), width - padR - 108)}
              y={Math.max(hovered.y - 34, padT)}
              width="108"
              height="24"
              rx="4"
              fill="var(--surface)"
              stroke="var(--line)"
            />
            <text
              x={Math.min(Math.max(hovered.x, padL + 54), width - padR - 54)}
              y={Math.max(hovered.y - 18, padT + 12)}
              textAnchor="middle"
              fill="var(--text)"
              fontSize="10"
              fontWeight="700"
            >
              {formatTTD(hovered.amount)}
            </text>
          </g>
        ) : null}
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
  periodLabel,
  periodClamped: _periodClamped,
  periodRange,
  freeMaxDays,
  isFree,
  branding,
}: {
  data: ReportsData;
  planTier: string;
  periodLabel: string;
  periodClamped: boolean;
  periodRange: ResolvedDateRange;
  freeMaxDays: number;
  isFree: boolean;
  branding?: CompanyBranding;
}) {
  const [tab, setTab] = useState<TabId>("overview");
  const [itemQuery, setItemQuery] = useState("");
  const [categoryQuery, setCategoryQuery] = useState("");
  const [refundQuery, setRefundQuery] = useState("");
  const [receiptQuery, setReceiptQuery] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  const overviewSlices = useMemo(
    () => [
      { label: "POS retail", value: data.posRetail, color: "#0e7cc0" },
      { label: "POS / service sales", value: data.posService, color: "#5b4db8" },
      { label: "Service income", value: data.otherIncome, color: "#1f7a4d" },
      { label: "Expenses", value: data.expenses, color: EXPENSE_COLOR },
      { label: "Receivables", value: data.receivables, color: "#b45309" },
    ],
    [data],
  );

  const incomeTabSlices = useMemo(
    () => [
      { label: "POS income", value: data.pos, color: "#0e7cc0" },
      { label: "Service income", value: data.otherIncome, color: "#1f7a4d" },
    ],
    [data],
  );

  const posRevenueWithAr = data.pos + data.posReceivables;
  const serviceRevenueWithAr = data.otherIncome + data.serviceReceivables;

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
        (r.variant || "").toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q),
    );
  }, [data.salesByItem, itemQuery]);

  const filteredCategories = useMemo(() => {
    const q = categoryQuery.trim().toLowerCase();
    if (!q) return data.salesByCategory;
    return data.salesByCategory.filter((r) => r.category.toLowerCase().includes(q));
  }, [data.salesByCategory, categoryQuery]);

  const itemsByCategory = useMemo(() => {
    const map = new Map<string, ReportsData["salesByItem"]>();
    for (const item of data.salesByItem) {
      const list = map.get(item.category) || [];
      list.push(item);
      map.set(item.category, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => b.netSales - a.netSales);
    }
    return map;
  }, [data.salesByItem]);

  function toggleCategory(category: string) {
    setExpandedCategories((prev) => ({ ...prev, [category]: !prev[category] }));
  }

  const refundLines = useMemo(
    () => data.saleLines.filter((r) => r.isRefund),
    [data.saleLines],
  );

  const filteredRefunds = useMemo(() => {
    const q = refundQuery.trim().toLowerCase();
    if (!q) return refundLines;
    return refundLines.filter(
      (r) =>
        r.description.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        r.saleNumber.toLowerCase().includes(q) ||
        r.method.toLowerCase().includes(q),
    );
  }, [refundLines, refundQuery]);

  const filteredReceipts = useMemo(() => {
    const q = receiptQuery.trim().toLowerCase();
    const rows = data.receipts.map((r) => ({
      ...r,
      employeeDisplay: r.employeeName?.trim() || "Manager",
      customerDisplay: r.customerName?.trim() || "Walk-in customer",
    }));
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.number.toLowerCase().includes(q) ||
        r.employeeDisplay.toLowerCase().includes(q) ||
        r.customerDisplay.toLowerCase().includes(q) ||
        r.type.toLowerCase().includes(q),
    );
  }, [data.receipts, receiptQuery]);

  const refundReceiptCount = useMemo(() => {
    const nums = new Set(refundLines.map((r) => r.saleNumber));
    return nums.size;
  }, [refundLines]);

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
            {
              label: "POS revenue (includes receivables)",
              value: formatTTD(posRevenueWithAr),
              tone: "#0e7cc0",
            },
            {
              label: "Service revenue (includes receivables)",
              value: formatTTD(serviceRevenueWithAr),
              tone: "#1f7a4d",
            },
            { label: "Total revenue", value: formatTTD(data.totalRevenue), tone: "#0a6b6e" },
            { label: "Expenses", value: formatTTD(data.expenses), tone: EXPENSE_COLOR },
          ]}
        />

        <div className="reports-diagrams reports-diagrams-compact">
          <div className="diagram-card diagram-card-compact">
            <h3>Money mix</h3>
            <DonutChart slices={overviewSlices} size={140} showCenterTotal={false} />
          </div>
          <div className="diagram-card diagram-card-compact">
            <h3>Daily earnings</h3>
            <LineChart points={data.dailyEarnings} height={140} ariaLabel="Daily earnings" />
          </div>
        </div>
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
          <PeriodSelector
            basePath="/reports"
            range={periodRange}
            isFree={isFree}
            freeMaxDays={freeMaxDays}
          />
        </Panel>
      ) : null}

      {tab === "overview" ? (
        <Panel className="report-tab-panel">
          <h3>Overview</h3>
          <p className="muted">
            Estimated net profit this period: <strong className="money">{formatTTD(data.profit)}</strong>
          </p>
          <div className="kpi-grid" style={{ marginTop: "1rem" }}>
            <div className="report-stat sea">
              <div className="label">Total revenue</div>
              <div className="value money">{formatTTD(data.totalRevenue)}</div>
            </div>
            <div className="report-stat purple">
              <div className="label">Receivables</div>
              <div className="value money">{formatTTD(data.receivables)}</div>
            </div>
            <div className="report-stat accent">
              <div className="label">Expenses</div>
              <div className="value money">{formatTTD(data.expenses)}</div>
            </div>
            <div className="report-stat blue">
              <div className="label">Net profit</div>
              <div className="value money">{formatTTD(data.profit)}</div>
            </div>
          </div>
        </Panel>
      ) : null}

      {tab === "income" ? (
        <Panel className="report-tab-panel">
          <h3>Income</h3>
          <p className="muted">POS and service income for this period.</p>
          <div className="kpi-grid" style={{ marginTop: "0.75rem", gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
            <div className="report-stat blue">
              <div className="label">POS income</div>
              <div className="value money">{formatTTD(data.pos)}</div>
            </div>
            <div className="report-stat sea">
              <div className="label">Service income</div>
              <div className="value money">{formatTTD(data.otherIncome)}</div>
            </div>
            <div className="report-stat purple">
              <div className="label">Total income</div>
              <div className="value money">{formatTTD(data.pos + data.otherIncome)}</div>
            </div>
          </div>
          <div style={{ marginTop: "1rem" }}>
            <DonutChart
              slices={
                incomeTabSlices.some((s) => s.value > 0)
                  ? incomeTabSlices
                  : [{ label: "No income", value: 0, color: "#ccc" }]
              }
              centerLabel="Total income"
            />
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

      {tab === "payables" ? (
        <Panel className="report-tab-panel">
          <h3>Accounts payable</h3>
          <p className="muted">Amounts owed to suppliers from purchase records.</p>
          <div className="report-stat purple" style={{ maxWidth: 320, marginTop: "0.75rem" }}>
            <div className="label">Outstanding</div>
            <div className="value money">{formatTTD(data.payables)}</div>
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
          <p className="muted">
            Item name, sold variant, category, qty sold, net sales, cost of goods, and gross profit.
          </p>
          <SearchBar
            value={itemQuery}
            onChange={setItemQuery}
            placeholder="Search item, variant, or category…"
          />
          <div className="table-wrap list-dense" style={{ marginTop: "1rem" }}>
            <table className="data">
              <thead>
                <tr>
                  <th>Item name</th>
                  <th>Variant</th>
                  <th>Category</th>
                  <th>Qty sold</th>
                  <th>Net sales</th>
                  <th>Cost of goods</th>
                  <th>Gross profit</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((r) => (
                  <tr key={`${r.name}-${r.variant || ""}-${r.category}`}>
                    <td>
                      <strong>{r.name}</strong>
                      <div className="muted" style={{ fontSize: "0.75rem" }}>
                        {r.isService ? "Service" : "Retail"}
                      </div>
                    </td>
                    <td>{r.variant || "—"}</td>
                    <td>{r.category}</td>
                    <td>{r.qty}</td>
                    <td className="money">{formatTTD(r.netSales)}</td>
                    <td className="money">{formatTTD(r.cogs)}</td>
                    <td className="money">{formatTTD(r.grossProfit)}</td>
                  </tr>
                ))}
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="muted">
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
          <p className="muted">
            Expand a category to see items sold, quantities, and sales for this period.
          </p>
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
          <div className="table-wrap list-dense" style={{ marginTop: "1rem" }}>
            <table className="data">
              <thead>
                <tr>
                  <th style={{ width: "2.25rem" }} aria-label="Expand" />
                  <th>Category / Item</th>
                  <th>Qty sold</th>
                  <th>Sales</th>
                  <th>Cost of goods</th>
                  <th>Gross profit</th>
                </tr>
              </thead>
              <tbody>
                {filteredCategories.map((r) => {
                  const open = Boolean(expandedCategories[r.category]);
                  const items = itemsByCategory.get(r.category) || [];
                  const categoryCogs = items.reduce((s, i) => s + i.cogs, 0);
                  const categoryGp = items.reduce((s, i) => s + i.grossProfit, 0);
                  return (
                    <Fragment key={r.category}>
                      <tr className="category-row-summary">
                        <td>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm report-expand-btn"
                            aria-expanded={open}
                            aria-label={open ? `Collapse ${r.category}` : `Expand ${r.category}`}
                            onClick={() => toggleCategory(r.category)}
                            disabled={items.length === 0}
                          >
                            <span
                              className={open ? "report-chevron open" : "report-chevron"}
                              aria-hidden
                            >
                              ▸
                            </span>
                          </button>
                        </td>
                        <td>
                          <strong>{r.category}</strong>
                          <div className="muted" style={{ fontSize: "0.72rem" }}>
                            {items.length} item{items.length === 1 ? "" : "s"}
                          </div>
                        </td>
                        <td>{r.qty}</td>
                        <td className="money">{formatTTD(r.amount)}</td>
                        <td className="money">{formatTTD(categoryCogs)}</td>
                        <td className="money">{formatTTD(categoryGp)}</td>
                      </tr>
                      {open
                        ? items.map((item) => (
                            <tr
                              key={`${r.category}-${item.name}-${item.variant || ""}`}
                              className="category-item-row"
                            >
                              <td />
                              <td style={{ paddingLeft: "1.25rem" }}>
                                <span>{item.name}</span>
                                <div className="muted" style={{ fontSize: "0.72rem" }}>
                                  {item.variant
                                    ? item.variant
                                    : item.isService
                                      ? "Service"
                                      : "Retail"}
                                </div>
                              </td>
                              <td>{item.qty}</td>
                              <td className="money">{formatTTD(item.netSales)}</td>
                              <td className="money">{formatTTD(item.cogs)}</td>
                              <td className="money">{formatTTD(item.grossProfit)}</td>
                            </tr>
                          ))
                        : null}
                      {open && items.length === 0 ? (
                        <tr className="category-item-row">
                          <td />
                          <td colSpan={5} className="muted" style={{ paddingLeft: "1.25rem" }}>
                            No item lines for this category.
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
                {filteredCategories.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="muted">
                      No matching categories this period.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : null}

      {tab === "receipts" ? (
        <Panel className="report-tab-panel">
          <h3>Receipts</h3>
          <p className="muted">
            Completed POS receipts for <strong>{periodLabel}</strong>. Missing employee defaults to
            Manager; missing customer defaults to Walk-in customer.
          </p>
          <SearchBar
            value={receiptQuery}
            onChange={setReceiptQuery}
            placeholder="Search receipt, employee, customer, or type…"
          />
          <div className="table-wrap list-dense" style={{ marginTop: "1rem" }}>
            <table className="data">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Receipt number</th>
                  <th>Employee</th>
                  <th>Customer</th>
                  <th>Type</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {filteredReceipts.map((r) => (
                  <tr key={r.id}>
                    <td>{formatAppDate(r.soldAt)}</td>
                    <td>
                      <strong>{r.number}</strong>
                    </td>
                    <td>{r.employeeDisplay}</td>
                    <td>{r.customerDisplay}</td>
                    <td>{r.type}</td>
                    <td className="money">{formatTTD(r.total)}</td>
                  </tr>
                ))}
                {filteredReceipts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="muted">
                      No receipts this period.
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
            Daily gross sales, refunds, discounts, net sales, cost of goods, and gross profit for{" "}
            <strong>{periodLabel}</strong>.
          </p>
          <div className="table-wrap list-dense" style={{ marginTop: "1rem" }}>
            <table className="data">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Gross sales</th>
                  <th>Refunds</th>
                  <th>Discounts</th>
                  <th>Net sales</th>
                  <th>Cost of goods</th>
                  <th>Gross profit</th>
                </tr>
              </thead>
              <tbody>
                {data.salesSummaryByDay.map((r) => (
                  <tr key={r.date}>
                    <td>{formatAppDate(`${r.date}T12:00:00`)}</td>
                    <td className="money">{formatTTD(r.grossSales)}</td>
                    <td className="money">{formatTTD(r.refunds)}</td>
                    <td className="money">{formatTTD(r.discounts)}</td>
                    <td className="money">{formatTTD(r.netSales)}</td>
                    <td className="money">{formatTTD(r.cogs)}</td>
                    <td className="money">{formatTTD(r.grossProfit)}</td>
                  </tr>
                ))}
                {data.salesSummaryByDay.length > 0 ? (
                  <tr className="sales-summary-total-row">
                    <td>
                      <strong>Total</strong>
                    </td>
                    <td className="money">
                      <strong>{formatTTD(data.grossSales)}</strong>
                    </td>
                    <td className="money">
                      <strong>{formatTTD(data.refunds)}</strong>
                    </td>
                    <td className="money">
                      <strong>{formatTTD(data.discounts)}</strong>
                    </td>
                    <td className="money">
                      <strong>{formatTTD(data.netSales)}</strong>
                    </td>
                    <td className="money">
                      <strong>{formatTTD(data.cogs)}</strong>
                    </td>
                    <td className="money">
                      <strong>{formatTTD(data.grossProfit)}</strong>
                    </td>
                  </tr>
                ) : (
                  <tr>
                    <td colSpan={7} className="muted">
                      No sales this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : null}

      {tab === "refunds" ? (
        <Panel className="report-tab-panel">
          <h3>Refunds</h3>
          <p className="muted">
            Refund receipts issued in <strong>{periodLabel}</strong>. Voided sales are excluded
            entirely (not listed here).
          </p>
          <div className="kpi-grid sales-summary-kpis" style={{ marginTop: "0.85rem" }}>
            <div className="report-stat accent">
              <div className="label">Refund total</div>
              <div className="value money">{formatTTD(data.refunds)}</div>
            </div>
            <div className="report-stat purple">
              <div className="label">Refund receipts</div>
              <div className="value">{refundReceiptCount}</div>
            </div>
            <div className="report-stat blue">
              <div className="label">Line items</div>
              <div className="value">{refundLines.length}</div>
            </div>
          </div>
          <SearchBar
            value={refundQuery}
            onChange={setRefundQuery}
            placeholder="Search refund receipt, item, category, or method…"
          />
          <div className="table-wrap list-dense" style={{ marginTop: "1rem" }}>
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
                {filteredRefunds.map((r) => (
                  <tr key={r.id}>
                    <td>{formatAppDateTime(new Date(r.soldAt))}</td>
                    <td>
                      <strong>{r.saleNumber}</strong>
                      <span className="muted" style={{ display: "block", fontSize: "0.75rem" }}>
                        Refund · {r.method}
                      </span>
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
                {filteredRefunds.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="muted">
                      No refunds this period.
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
