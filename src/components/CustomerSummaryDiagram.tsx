import { formatTTD } from "@/lib/money";

const COUNT_COLORS = {
  visits: "#0e7cc0",
  quotes: "#5b4db8",
  jobs: "#0a6b6e",
  invoices: "#b45309",
} as const;

const MONEY_COLORS = {
  spent: "#1f7a4d",
  outstanding: "#c45c26",
} as const;

function CountBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const height = max > 0 ? Math.max(8, Math.round((value / max) * 140)) : 8;
  return (
    <div className="bar-col">
      <div className="bar-value">{value}</div>
      <div
        className="bar-fill"
        style={{
          height,
          background: color,
          width: "100%",
          borderRadius: "8px 8px 4px 4px",
          minHeight: 8,
        }}
        title={`${label}: ${value}`}
      />
      <div className="bar-label">{label}</div>
    </div>
  );
}

function MoneyDonut({
  spent,
  outstanding,
}: {
  spent: number;
  outstanding: number;
}) {
  const size = 180;
  const r = size / 2 - 18;
  const c = size / 2;
  const stroke = 26;
  const total = Math.max(0, spent) + Math.max(0, outstanding);

  if (total <= 0) {
    return (
      <div className="donut-wrap">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={c} cy={c} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
          <text x={c} y={c} textAnchor="middle" dominantBaseline="middle" fill="var(--muted)" fontSize="13">
            No money yet
          </text>
        </svg>
      </div>
    );
  }

  const circumference = 2 * Math.PI * r;
  const spentLen = (Math.max(0, spent) / total) * circumference;
  const outLen = (Math.max(0, outstanding) / total) * circumference;

  return (
    <div className="donut-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label="Money mix">
        <circle cx={c} cy={c} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
        <circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke={MONEY_COLORS.spent}
          strokeWidth={stroke}
          strokeDasharray={`${spentLen} ${circumference - spentLen}`}
          strokeDashoffset={0}
          strokeLinecap="butt"
          transform={`rotate(-90 ${c} ${c})`}
        />
        <circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke={MONEY_COLORS.outstanding}
          strokeWidth={stroke}
          strokeDasharray={`${outLen} ${circumference - outLen}`}
          strokeDashoffset={-spentLen}
          strokeLinecap="butt"
          transform={`rotate(-90 ${c} ${c})`}
        />
        <text x={c} y={c - 8} textAnchor="middle" className="donut-center-label">
          Balance
        </text>
        <text x={c} y={c + 12} textAnchor="middle" className="donut-center-value">
          {formatTTD(total)}
        </text>
      </svg>
      <div className="chart-legend">
        <div className="legend-row">
          <span className="legend-swatch" style={{ background: MONEY_COLORS.spent }} />
          <span>Total spent</span>
          <strong className="money">{formatTTD(spent)}</strong>
        </div>
        <div className="legend-row">
          <span className="legend-swatch" style={{ background: MONEY_COLORS.outstanding }} />
          <span>Outstanding</span>
          <strong className="money">{formatTTD(outstanding)}</strong>
        </div>
      </div>
    </div>
  );
}

export function CustomerSummaryDiagram({
  outstanding,
  visitCount,
  totalSpent,
  quotes,
  jobs,
  invoices,
}: {
  outstanding: number;
  visitCount: number;
  totalSpent: number;
  quotes: number;
  jobs: number;
  invoices: number;
}) {
  const counts = [
    { label: "Visits", value: visitCount, color: COUNT_COLORS.visits },
    { label: "Quotes", value: quotes, color: COUNT_COLORS.quotes },
    { label: "Jobs", value: jobs, color: COUNT_COLORS.jobs },
    { label: "Invoices", value: invoices, color: COUNT_COLORS.invoices },
  ];
  const maxCount = Math.max(1, ...counts.map((c) => c.value));

  return (
    <div className="reports-diagrams customer-summary-diagrams">
      <div className="diagram-card panel">
        <h3>Activity mix</h3>
        <p className="muted" style={{ margin: "0 0 0.75rem", fontSize: "0.85rem" }}>
          Visits, quotes, jobs, and invoices at a glance
        </p>
        <div className="bar-chart" style={{ minHeight: 180 }}>
          {counts.map((c) => (
            <CountBar
              key={c.label}
              label={c.label}
              value={c.value}
              max={maxCount}
              color={c.color}
            />
          ))}
        </div>
      </div>
      <div className="diagram-card panel">
        <h3>Money picture</h3>
        <p className="muted" style={{ margin: "0 0 0.75rem", fontSize: "0.85rem" }}>
          Total spent versus amount still outstanding
        </p>
        <MoneyDonut spent={totalSpent} outstanding={outstanding} />
      </div>
    </div>
  );
}
