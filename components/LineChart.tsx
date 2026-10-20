"use client";

import { useState } from "react";

export type ChartPoint = { label: string; value: number; detail?: string };

// A line chart you can drag across. Optional dashed trend line (least squares) and goal line.
export default function LineChart({
  points, unit = "", color = "#1C2230", trend = false, goal, height = 180, zero = false, ariaLabel,
}: {
  points: ChartPoint[]; unit?: string; color?: string; trend?: boolean; goal?: number;
  height?: number; zero?: boolean; ariaLabel: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  if (!points.length) return null;

  const W = 340, H = height, padL = 40, padR = 12, padT = 14, padB = 24;
  const vals = points.map((p) => p.value).concat(goal !== undefined ? [goal] : []);
  const rawLo = zero ? 0 : Math.min(...vals) * 0.95;
  const rawHi = Math.max(...vals) * 1.05 || 10;
  const step = niceStep((rawHi - rawLo) / 3);
  const lo = Math.floor(rawLo / step) * step;
  const hi = Math.max(lo + step, Math.ceil(rawHi / step) * step);
  const x = (i: number) => padL + (points.length === 1 ? (W - padL - padR) / 2 : (i / (points.length - 1)) * (W - padL - padR));
  const y = (v: number) => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB);
  const ticks = [lo, lo + (hi - lo) / 2, hi];

  // Least-squares trend line through the points
  let fit: [number, number] | null = null;
  if (trend && points.length >= 3) {
    const n = points.length;
    const mx = (n - 1) / 2;
    const my = points.reduce((a, p) => a + p.value, 0) / n;
    const sxy = points.reduce((a, p, i) => a + (i - mx) * (p.value - my), 0);
    const sxx = points.reduce((a, _, i) => a + (i - mx) ** 2, 0);
    const slope = sxx ? sxy / sxx : 0;
    fit = [my - slope * mx, my + slope * (n - 1 - mx)];
  }

  const shown = hover !== null ? points[hover] : null;
  return (
    <div className="flex flex-col gap-1">
      <p className="text-sm text-steel tabular h-5">
        {shown ? <><strong className="text-ink">{fmtNum(shown.value)} {unit}</strong> · {shown.label}{shown.detail ? ` · ${shown.detail}` : ""}</> : "Drag across the chart to see each point."}
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full touch-none select-none" role="img" aria-label={ariaLabel}
        onPointerLeave={() => setHover(null)}
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * W;
          let best = 0;
          points.forEach((_, i) => { if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i; });
          setHover(best);
        }}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="#CDD2D9" strokeWidth="1" />
            <text x={padL - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#5B6474">{fmtNum(t)}</text>
          </g>
        ))}
        {goal !== undefined && (
          <>
            <line x1={padL} x2={W - padR} y1={y(goal)} y2={y(goal)} stroke="#2E8B57" strokeWidth="2" strokeDasharray="6 4" />
            <text x={W - padR} y={y(goal) - 5} textAnchor="end" fontSize="11" fontWeight="600" fill="#2E8B57">goal {goal}</text>
          </>
        )}
        {fit && (
          <line x1={x(0)} x2={x(points.length - 1)} y1={y(fit[0])} y2={y(fit[1])} stroke={color} strokeOpacity="0.45" strokeWidth="2" strokeDasharray="5 5" />
        )}
        {points.length > 1 && (
          <polyline fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"
            points={points.map((p, i) => `${x(i)},${y(p.value)}`).join(" ")} />
        )}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={padT} y2={H - padB} stroke="#5B6474" strokeWidth="1" strokeDasharray="3 3" />}
        {points.map((p, i) => (
          <circle key={i} cx={x(i)} cy={y(p.value)} r={hover === i ? 6 : 3.5} fill={color} stroke="#E6E8EB" strokeWidth="2" />
        ))}
        <text x={padL} y={H - 6} fontSize="11" fill="#5B6474">{points[0].label}</text>
        {points.length > 1 && <text x={W - padR} y={H - 6} fontSize="11" fill="#5B6474" textAnchor="end">{points[points.length - 1].label}</text>}
      </svg>
    </div>
  );
}

function niceStep(raw: number) {
  if (raw <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

export function fmtNum(n: number) {
  if (Math.abs(n) >= 10000) return `${(n / 1000).toFixed(0)}k`;
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
