"use client";

import type { MoneyMixSlice } from "@/lib/money-mix";
import { formatTTD } from "@/lib/money";

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function slicePath(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polar(cx, cy, r, endAngle);
  const end = polar(cx, cy, r, startAngle);
  const large = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${large} 0 ${end.x} ${end.y} Z`;
}

export function MoneyMixDiagram({
  title,
  centerLabel,
  centerAmount,
  slices,
}: {
  title: string;
  centerLabel: string;
  centerAmount: number;
  slices: MoneyMixSlice[];
}) {
  const cx = 120;
  const cy = 120;
  const r = 90;
  let angle = 0;
  const total = slices.reduce((s, sl) => s + sl.amount, 0) || 1;

  return (
    <div className="money-mix-diagram">
      <h4 style={{ margin: "0 0 0.75rem", textAlign: "center" }}>{title}</h4>
      <div className="money-mix-chart-wrap">
        <svg viewBox="0 0 240 240" className="money-mix-chart" aria-hidden>
          {slices.map((slice) => {
            const sweep = (slice.amount / total) * 360;
            const path = slicePath(cx, cy, r, angle, angle + sweep);
            angle += sweep;
            return <path key={slice.bucket} d={path} fill={slice.color} stroke="#fff" strokeWidth="1.5" />;
          })}
          <circle cx={cx} cy={cy} r={42} fill="var(--panel, #fff)" />
          <text x={cx} y={cy - 6} textAnchor="middle" fontSize="10" fill="#6b7280">
            {centerLabel}
          </text>
          <text x={cx} y={cy + 12} textAnchor="middle" fontSize="11" fontWeight="600" fill="#111">
            {formatTTD(centerAmount)}
          </text>
        </svg>
      </div>
      <ul className="money-mix-legend">
        {slices.map((slice) => (
          <li key={slice.bucket}>
            <span className="money-mix-swatch" style={{ background: slice.color }} />
            <span>
              {slice.label}: <strong className="money">{formatTTD(slice.amount)}</strong>
              <span className="muted"> ({slice.pct.toFixed(0)}%)</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
