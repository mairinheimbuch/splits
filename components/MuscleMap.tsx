"use client";

import { useState } from "react";
import { fmt } from "@/lib/stats";

// Front and back body. Each muscle fills in by how many sets it got this week.
// One green, light to dark. 10–20 sets is the usual target for growth.
const LEVELS = [
  { min: 0, fill: "#D5D9DF", label: "0" },
  { min: 0.5, fill: "#BFE3CC", label: "1–4" },
  { min: 5, fill: "#7CC59A", label: "5–9" },
  { min: 10, fill: "#2E8B57", label: "10–20" },
  { min: 20.5, fill: "#1B5E3A", label: "20+" },
];
const BODY = "#EEF0F2"; // skin areas that aren't a tracked muscle

function fillFor(n: number) {
  return [...LEVELS].reverse().find((l) => n >= l.min)!.fill;
}

type Shape = { muscle: string; d: string };

// Paths are drawn on a 120 × 250 figure
const r = (x: number, y: number, w: number, h: number, rad = 6) =>
  `M${x + rad},${y}h${w - 2 * rad}a${rad},${rad} 0 0 1 ${rad},${rad}v${h - 2 * rad}a${rad},${rad} 0 0 1 -${rad},${rad}h-${w - 2 * rad}a${rad},${rad} 0 0 1 -${rad},-${rad}v-${h - 2 * rad}a${rad},${rad} 0 0 1 ${rad},-${rad}z`;
const ell = (cx: number, cy: number, rx: number, ry: number) =>
  `M${cx - rx},${cy}a${rx},${ry} 0 1 0 ${2 * rx},0a${rx},${ry} 0 1 0 -${2 * rx},0z`;

const SILHOUETTE = [
  ell(60, 18, 12, 14),        // head
  r(53, 30, 14, 10, 3),       // neck
  r(16, 96, 13, 42, 6),       // left forearm
  r(91, 96, 13, 42, 6),       // right forearm
  r(41, 118, 38, 16, 6),      // hips
  r(43, 196, 14, 8, 4),       // knees
  r(63, 196, 14, 8, 4),
];

const FRONT: Shape[] = [
  { muscle: "Shoulders", d: ell(32, 50, 11, 10) },
  { muscle: "Shoulders", d: ell(88, 50, 11, 10) },
  { muscle: "Chest", d: r(39, 41, 20, 28, 7) },
  { muscle: "Chest", d: r(61, 41, 20, 28, 7) },
  { muscle: "Biceps", d: r(19, 60, 13, 34, 6) },
  { muscle: "Biceps", d: r(88, 60, 13, 34, 6) },
  { muscle: "Core", d: r(44, 71, 32, 46, 8) },
  { muscle: "Quads", d: r(41, 136, 18, 58, 8) },
  { muscle: "Quads", d: r(61, 136, 18, 58, 8) },
  { muscle: "Calves", d: r(44, 206, 12, 40, 6) },
  { muscle: "Calves", d: r(64, 206, 12, 40, 6) },
];

const BACK: Shape[] = [
  { muscle: "Shoulders", d: ell(32, 50, 11, 10) },
  { muscle: "Shoulders", d: ell(88, 50, 11, 10) },
  { muscle: "Back", d: "M42,41 h36 l4,30 l-6,46 h-32 l-6,-46 z" },
  { muscle: "Triceps", d: r(19, 60, 13, 34, 6) },
  { muscle: "Triceps", d: r(88, 60, 13, 34, 6) },
  { muscle: "Glutes", d: r(41, 118, 18, 24, 9) },
  { muscle: "Glutes", d: r(61, 118, 18, 24, 9) },
  { muscle: "Hamstrings", d: r(41, 144, 18, 50, 8) },
  { muscle: "Hamstrings", d: r(61, 144, 18, 50, 8) },
  { muscle: "Calves", d: r(43, 206, 14, 40, 7) },
  { muscle: "Calves", d: r(63, 206, 14, 40, 7) },
];

export default function MuscleMap({ sets }: { sets: Record<string, number> }) {
  const [pick, setPick] = useState<string | null>(null);

  function figure(shapes: Shape[], dx: number, label: string) {
    return (
      <g transform={`translate(${dx},0)`}>
        {SILHOUETTE.map((d, i) => <path key={i} d={d} fill={BODY} />)}
        {shapes.map((s, i) => (
          <path key={i} d={s.d} fill={fillFor(sets[s.muscle] ?? 0)}
            stroke={pick === s.muscle ? "#1C2230" : "#E6E8EB"} strokeWidth={pick === s.muscle ? 2.5 : 2}
            className="cursor-pointer" onClick={() => setPick(pick === s.muscle ? null : s.muscle)}>
            <title>{`${s.muscle}: ${fmt(sets[s.muscle] ?? 0)} sets`}</title>
          </path>
        ))}
        <text x="60" y="262" textAnchor="middle" fontSize="11" fill="#5B6474">{label}</text>
      </g>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <svg viewBox="0 0 270 268" className="w-full max-w-sm mx-auto" role="img"
        aria-label={"Muscles trained this week: " + Object.entries(sets).map(([m, n]) => `${m} ${fmt(n)} sets`).join(", ")}>
        {figure(FRONT, 10, "Front")}
        {figure(BACK, 140, "Back")}
      </svg>
      <p className="text-center text-sm font-semibold min-h-5" aria-live="polite">
        {pick ? `${pick}: ${fmt(sets[pick] ?? 0)} sets this week` : "Tap a muscle to see its sets."}
      </p>
      <div className="flex justify-center gap-3 flex-wrap text-xs text-steel">
        {LEVELS.map((l) => (
          <span key={l.label} className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm border border-line" style={{ background: l.fill }} />{l.label} sets
          </span>
        ))}
      </div>
    </div>
  );
}