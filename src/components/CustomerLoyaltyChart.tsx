"use client";

import type { CustomerLoyaltyData } from "@/lib/customer-loyalty";

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function pieSlicePath(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polar(cx, cy, r, startAngle);
  const end = polar(cx, cy, r, endAngle);
  const large = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${large} 1 ${end.x} ${end.y} Z`;
}

export function CustomerLoyaltyChart({ data }: { data: CustomerLoyaltyData }) {
  const size = 240;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 8;
  const total = data.slices.reduce((s, x) => s + x.count, 0);

  let angle = -90;
  const arcs =
    total > 0
      ? data.slices
          .filter((s) => s.count > 0)
          .map((s) => {
            const portion = (s.count / total) * 360;
            const start = angle;
            angle += portion;
            const end = angle;
            return {
              ...s,
              d: pieSlicePath(cx, cy, r, start, end),
              pct: Math.round((s.count / total) * 100),
            };
          })
      : [];

  return (
    <div className="stack" style={{ gap: "1rem" }}>
      <div>
        <h3 style={{ margin: 0 }}>Customer loyalty</h3>
        <p className="muted" style={{ margin: "0.35rem 0 0", fontSize: "0.88rem", lineHeight: 1.45 }}>
          Repeat visits from identified customers (completed POS sales in this period). Walk-ins
          without a customer profile are not included.
        </p>
      </div>

      <div className="donut-wrap" style={{ alignItems: "center", gap: "1.5rem" }}>
        <div style={{ position: "relative", width: size, height: size }}>
          <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            role="img"
            aria-label="Customer loyalty pie chart"
          >
            {total <= 0 ? (
              <>
                <circle cx={cx} cy={cy} r={r} fill="var(--line)" opacity={0.35} />
                <text
                  x={cx}
                  y={cy}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="var(--muted)"
                  fontSize="14"
                >
                  No visits yet
                </text>
              </>
            ) : (
              arcs.map((a) => (
                <path key={a.id} d={a.d} fill={a.color} className="donut-slice" />
              ))
            )}
          </svg>
          {total > 0 ? (
            <div
              style={{
                position: "absolute",
                inset: "28%",
                borderRadius: "50%",
                background: "var(--surface)",
                display: "grid",
                placeContent: "center",
                textAlign: "center",
                pointerEvents: "none",
                boxShadow: "0 0 0 1px var(--line)",
              }}
            >
              <div className="muted" style={{ fontSize: "0.72rem" }}>
                Repeat rate
              </div>
              <strong style={{ fontSize: "1.35rem" }}>{data.repeatRatePct}%</strong>
            </div>
          ) : null}
        </div>

        <div className="chart-legend" style={{ flex: 1, minWidth: 180 }}>
          {data.slices.map((s) => {
            const pct = total > 0 ? Math.round((s.count / total) * 100) : 0;
            return (
              <div key={s.id} className="legend-row">
                <span className="legend-swatch" style={{ background: s.color }} />
                <span>
                  {s.label}
                  <span className="muted" style={{ display: "block", fontSize: "0.75rem" }}>
                    {s.description}
                  </span>
                </span>
                <strong>
                  {s.count} · {pct}%
                </strong>
              </div>
            );
          })}
          <div className="muted" style={{ fontSize: "0.8rem", marginTop: "0.5rem" }}>
            {data.customersWithVisits} customer{data.customersWithVisits === 1 ? "" : "s"} ·{" "}
            {data.totalVisits} visit{data.totalVisits === 1 ? "" : "s"}
          </div>
        </div>
      </div>
    </div>
  );
}
