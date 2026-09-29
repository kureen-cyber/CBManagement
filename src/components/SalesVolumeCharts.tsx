"use client";

import { useState } from "react";
import { formatTTD } from "@/lib/money";
import type { SalesVolumeBar, SalesVolumePatterns } from "@/lib/sales-volume-patterns";

function truncateLabel(label: string, max = 16) {
  const t = label.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function VolumeBarChart({
  title,
  description,
  bars,
  ariaLabel,
  compactLabels = false,
  rotateLabels = false,
  fill = "var(--sea)",
  fillHot = "var(--accent)",
  emptyMessage = "No sales in this period",
}: {
  title: string;
  description: string;
  bars: SalesVolumeBar[];
  ariaLabel: string;
  compactLabels?: boolean;
  rotateLabels?: boolean;
  fill?: string;
  fillHot?: string;
  emptyMessage?: string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const width = 640;
  const padL = rotateLabels ? 64 : 52;
  const padR = rotateLabels ? 36 : 12;
  const padT = 18;
  const padB = rotateLabels ? 118 : 36;
  const height = rotateLabels ? 282 : 200;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const max = Math.max(1, ...bars.map((b) => b.amount));
  const gap = bars.length > 12 ? 2 : 6;
  const barW = Math.max(4, bars.length ? (innerW - gap * (bars.length - 1)) / bars.length : innerW);
  const totalAmount = bars.reduce((s, b) => s + b.amount, 0);
  const totalCount = bars.reduce((s, b) => s + b.count, 0);
  const active = hovered != null ? bars[hovered] : null;

  const yTicks = [0, 0.5, 1].map((f) => Math.round(max * f));

  return (
    <div className="stack" style={{ gap: "0.75rem" }}>
      <div>
        <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span
            aria-hidden
            style={{
              width: 12,
              height: 12,
              borderRadius: 3,
              background: fill,
              flexShrink: 0,
            }}
          />
          {title}
        </h3>
        <p className="muted" style={{ margin: "0.35rem 0 0", fontSize: "0.88rem", lineHeight: 1.45 }}>
          {description}
        </p>
      </div>

      <div className="line-chart">
        <svg
          width="100%"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={ariaLabel}
          overflow="visible"
        >
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
              rotateLabels ||
              !compactLabels ||
              i % 2 === 0 ||
              i === bars.length - 1 ||
              isHot;
            const label = rotateLabels ? truncateLabel(bar.label, 22) : bar.label;
            return (
              <g
                key={bar.key}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                style={{ cursor: "default" }}
              >
                <rect x={x} y={padT} width={barW} height={innerH} fill="transparent" />
                <rect
                  x={x}
                  y={y}
                  width={barW}
                  height={Math.max(bar.amount > 0 ? 2 : 0, h)}
                  rx={3}
                  fill={isHot ? fillHot : fill}
                  opacity={bar.amount > 0 ? 1 : 0.25}
                />
                {showLabel ? (
                  rotateLabels ? (
                    <text
                      x={x + barW / 2}
                      y={height - 16}
                      transform={`rotate(-50 ${x + barW / 2} ${height - 16})`}
                      textAnchor="end"
                      dominantBaseline="middle"
                      fill="var(--ink)"
                      fontSize="11"
                    >
                      {label}
                    </text>
                  ) : (
                    <text
                      x={x + barW / 2}
                      y={height - 12}
                      textAnchor="middle"
                      fill="var(--muted)"
                      fontSize={compactLabels ? "9" : "11"}
                    >
                      {label}
                    </text>
                  )
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
              {emptyMessage}
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
            {rotateLabels && bars.length ? (
              <>
                {" "}
                · {bars.length} customer{bars.length === 1 ? "" : "s"}
              </>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

export function SalesVolumeCharts({ data }: { data: SalesVolumePatterns }) {
  return (
    <div className="stack" style={{ gap: "1.5rem" }}>
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
          fill="var(--chart-time)"
          fillHot="var(--chart-time-hot)"
        />
      </div>
      <VolumeBarChart
        title="Sales by customer"
        description="Completed POS sales totals for customers who bought in this period. Unnamed tickets are grouped as Walk-in."
        bars={data.byCustomer}
        ariaLabel="Sales volume by customer"
        rotateLabels={data.byCustomer.length > 0}
        fill="var(--chart-customer)"
        fillHot="var(--chart-customer-hot)"
        emptyMessage="No customer sales in this period"
      />
    </div>
  );
}
