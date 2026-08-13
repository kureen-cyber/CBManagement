"use client";

import { useMemo, useState } from "react";
import { formatTTD } from "@/lib/money";
import { Panel } from "@/components/ui";

export type ReportsData = {
  income: number;
  expenses: number;
  receivables: number;
  pos: number;
  profit: number;
  expenseByCategory: { category: string; amount: number }[];
  paymentMethods: { method: string; amount: number }[];
  weekly: { label: string; income: number; expenses: number }[];
};

type TabId = "overview" | "income" | "expenses" | "receivables" | "pos";

const TABS: { id: TabId; label: string; color: string }[] = [
  { id: "overview", label: "Overview", color: "#0a6b6e" },
  { id: "income", label: "Income", color: "#1f7a4d" },
  { id: "expenses", label: "Expenses", color: "#c45c26" },
  { id: "receivables", label: "Receivables", color: "#5b4db8" },
  { id: "pos", label: "POS", color: "#0e7cc0" },
];

const CHART_COLORS = ["#0a6b6e", "#c45c26", "#1f7a4d", "#5b4db8", "#0e7cc0", "#b45309", "#db2777"];

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

export function ReportsDashboard({ data }: { data: ReportsData }) {
  const [tab, setTab] = useState<TabId>("overview");

  const overviewSlices = useMemo(
    () => [
      { label: "Income", value: data.income, color: "#1f7a4d" },
      { label: "Expenses", value: data.expenses, color: "#c45c26" },
      { label: "Receivables", value: data.receivables, color: "#5b4db8" },
      { label: "POS", value: data.pos, color: "#0e7cc0" },
    ],
    [data],
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

  const methodSlices = useMemo(
    () =>
      data.paymentMethods.map((m, i) => ({
        label: m.method,
        value: m.amount,
        color: CHART_COLORS[(i + 2) % CHART_COLORS.length],
      })),
    [data.paymentMethods],
  );

  return (
    <div className="stack reports-dashboard">
      <Panel className="reports-hero">
        <div className="reports-hero-copy">
          <h2>This month at a glance</h2>
          <p className="muted">
            Colourful charts of income, spend, receivables, and POS — switch tabs below for details.
          </p>
        </div>
        <MetricStrip
          items={[
            { label: "Income", value: formatTTD(data.income), tone: "#1f7a4d" },
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

      {tab === "overview" ? (
        <Panel className="report-tab-panel">
          <h3>Overview</h3>
          <p className="muted">
            Estimated profit this month: <strong className="money">{formatTTD(data.profit)}</strong>
          </p>
          <div className="kpi-grid" style={{ marginTop: "1rem" }}>
            <div className="report-stat sea">
              <div className="label">Income</div>
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
          <p className="muted">Payments received this month, by method.</p>
          <DonutChart slices={methodSlices.length ? methodSlices : [{ label: "No payments", value: 0, color: "#ccc" }]} />
          <div className="stack" style={{ marginTop: "1rem" }}>
            {data.paymentMethods.map((m) => (
              <div key={m.method} className="row" style={{ justifyContent: "space-between" }}>
                <span>{m.method}</span>
                <strong className="money">{formatTTD(m.amount)}</strong>
              </div>
            ))}
            {data.paymentMethods.length === 0 ? (
              <div className="muted">No income recorded this month yet.</div>
            ) : null}
            <div className="row" style={{ justifyContent: "space-between", borderTop: "1px solid var(--line)", paddingTop: "0.75rem" }}>
              <strong>Total income</strong>
              <strong className="money">{formatTTD(data.income)}</strong>
            </div>
          </div>
        </Panel>
      ) : null}

      {tab === "expenses" ? (
        <Panel className="report-tab-panel">
          <h3>Expenses</h3>
          <p className="muted">Where money went this month.</p>
          <DonutChart slices={expenseSlices.length ? expenseSlices : [{ label: "No expenses", value: 0, color: "#ccc" }]} />
          <div className="stack" style={{ marginTop: "1rem" }}>
            {data.expenseByCategory.map((e) => (
              <div key={e.category} className="row" style={{ justifyContent: "space-between" }}>
                <span>{e.category}</span>
                <strong className="money">{formatTTD(e.amount)}</strong>
              </div>
            ))}
            {data.expenseByCategory.length === 0 ? (
              <div className="muted">No expenses recorded this month yet.</div>
            ) : null}
            <div className="row" style={{ justifyContent: "space-between", borderTop: "1px solid var(--line)", paddingTop: "0.75rem" }}>
              <strong>Total expenses</strong>
              <strong className="money">{formatTTD(data.expenses)}</strong>
            </div>
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
          <p className="insight" style={{ marginTop: "1rem" }}>
            Collecting receivables improves cash flow without new sales.
          </p>
        </Panel>
      ) : null}

      {tab === "pos" ? (
        <Panel className="report-tab-panel">
          <h3>Point of sale</h3>
          <p className="muted">Counter and retail sales completed this month.</p>
          <div className="report-stat blue" style={{ maxWidth: 320, marginTop: "0.75rem" }}>
            <div className="label">POS total</div>
            <div className="value money">{formatTTD(data.pos)}</div>
          </div>
          <p className="insight" style={{ marginTop: "1rem" }}>
            POS totals include tax when tax is enabled in Settings.
          </p>
        </Panel>
      ) : null}
    </div>
  );
}
