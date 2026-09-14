"use client";

import { useState } from "react";
import { formatTTD } from "@/lib/money";
import type { SalesVolumeBar, SalesVolumePatterns } from "@/lib/sales-volume-patterns";

function VolumeBarChart({
  title,
  description,
  bars,
  ariaLabel,
  compactLabels = false,
}: {
  title: string;
  description: string;
  bars: SalesVolumeBar[];
  ariaLabel: string;
  compactLabels?: boolean;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const width = 640;
  const height = 200;
  const padL = 52;
  const padR = 12;
  const padT = 18;
  const padB = 36;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const max = Math.max(1, ...bars.map((b) => b.amount));
  const gap = bars.length > 12 ? 2 : 6;
  const barW = Math.max(4, (innerW - gap * (bars.length - 1)) / bars.length);
  const totalAmount = bars.reduce((s, b) => s + b.amount, 0);
  const totalCount = bars.reduce((s, b) => s + b.count, 0);
  const active = hovered != null ? bars[hovered] : null;

  const yTicks = [0, 0.5, 1].map((f) => Math.round(max * f));

  return (
    <div className="stack" style={{ gap: "0.75rem" }}>
      <div>
        <h3 style={{ margin: 0 }}>{title}</h3>
        <p className="muted" style={{ margin: "0.35rem 0 0", fontSize: "0.88rem", lineHeight: 1.45 }}>
          {description}
        </p>
      </div>

      <div className="line-chart">
        <svg width="100%" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={ariaLabel}>
          {yTicks.map((tick) => {
            const y = padT + innerH - (tick / max) * innerH;
            return (
              <g key={`yt-${tick}`}>
                <line
                  x1={padL}
                  x2={width - padR}
                  y1={y}
                  y2={y}
                  stroke="var(--line)"
                  strokeWidth={1}
                />
                <text
                  x={padL - 8}
                  y={y}
                  textAnchor="end"
                  dominantBaseline="middle"
                  fill="var(--muted)"
                  fontSize="10"
                >
                  {formatTTD(tick).replace("TT$", "").trim()}
                </text>
              </g>
            );
          })}

          {bars.map((bar, i) => {
            const x = padL + i * (barW + gap);
            const h = (bar.amount / max) * innerH;
            const y = padT + innerH - h;
            const isHot = hovered === i;
            const showLabel =
              !compactLabels || i % 2 === 0 || i === bars.length - 1 || isHot;
            return (
              <g
                key={bar.key}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                style={{ cursor: "default" }}
              >
                <rect
                  x={x}
                  y={padT}
                  width={barW}
                  height={innerH}
                  fill="transparent"
                />
                <rect
                  x={x}
                  y={y}
                  width={barW}
                  height={Math.max(bar.amount > 0 ? 2 : 0, h)}
                  rx={3}
                  fill={isHot ? "var(--accent)" : "var(--sea)"}
                  opacity={bar.amount > 0 ? 1 : 0.25}
                />
                {showLabel ? (
                  <text
                    x={x + barW / 2}
                    y={height - 12}
                    textAnchor="middle"
                    fill="var(--muted)"
                    fontSize={compactLabels ? "9" : "11"}
                  >
                    {bar.label}
                  </text>
                ) : null}
              </g>
            );
          })}

          {totalAmount <= 0 ? (
            <text
              x={width / 2}
              y={padT + innerH / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="var(--muted)"
              fontSize="12"
            >
              No sales in this period
            </text>
          ) : null}
        </svg>
      </div>

      <div className="muted" style={{ fontSize: "0.8rem" }}>
        {active ? (
          <>
            <strong style={{ color: "var(--ink)" }}>{active.label}</strong>
            {" · "}
            {formatTTD(active.amount)} · {active.count} sale{active.count === 1 ? "" : "s"}
          </>
        ) : (
          <>
            Period total · {formatTTD(totalAmount)} · {totalCount} sale
            {totalCount === 1 ? "" : "s"}
          </>
        )}
      </div>
    </div>
  );
}

export function SalesVolumeCharts({ data }: { data: SalesVolumePatterns }) {
  return (
    <div
      style={{
        display: "grid",
        gap: "1.5rem",
        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
      }}
    >
      <VolumeBarChart
        title="Sales by day of week"
        description="Completed POS sales totals by weekday in Trinidad & Tobago time."
        bars={data.byWeekday}
        ariaLabel="Sales volume by day of the week"
      />
      <VolumeBarChart
        title="Sales by time of day"
        description="Completed POS sales totals by hour of day in Trinidad & Tobago time."
        bars={data.byHour}
        ariaLabel="Sales volume by time of day"
        compactLabels
      />
    </div>
  );
}
