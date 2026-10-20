"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useUser } from "@/lib/useUser";
import { useTraining } from "@/lib/useTraining";
import { EXERCISES, MUSCLES } from "@/lib/program";
import { e1rm, fmt, shortDate, weekStart } from "@/lib/stats";
import { readiness, workoutScores } from "@/lib/insights";
import Login from "@/components/Login";
import MuscleMap from "@/components/MuscleMap";
import LineChart, { fmtNum } from "@/components/LineChart";

const VIEWS = ["Strength", "Volume", "Muscles", "Recovery"] as const;
type View = (typeof VIEWS)[number];
const DAY = 24 * 3600 * 1000;

export default function Analytics() {
  const { user, loading } = useUser();
  const { settings, workouts, sets, cardio, ready } = useTraining(user?.id);
  const [view, setView] = useState<View>("Strength");
  const [picked, setPicked] = useState<string | null>(null);

  // ---------- KPIs: last 14 days vs the 14 before ----------
  const kpis = useMemo(() => {
    if (!sets.length) return null;
    const now = Date.now();
    const inRange = (iso: string, from: number, to: number) => { const t = new Date(iso).getTime(); return t >= from && t < to; };
    const cur = [now - 14 * DAY, now + DAY] as const, prev = [now - 28 * DAY, now - 14 * DAY] as const;
    const sum = (r: readonly [number, number]) => {
      const w = workouts.filter((x) => inRange(x.started_at, r[0], r[1]));
      const s = sets.filter((x) => inRange(x.created_at, r[0], r[1]));
      const sleeps = w.map((x) => x.sleep_hours).filter((v): v is number => v != null);
      return {
        workouts: w.length, sets: s.length,
        volume: Math.round(s.reduce((v, x) => v + Number(x.weight) * x.reps, 0)),
        sleep: sleeps.length ? sleeps.reduce((a, b) => a + b, 0) / sleeps.length : null,
      };
    };
    return { cur: sum(cur), prev: sum(prev) };
  }, [workouts, sets]);

  // ---------- Strength ----------
  const lifts = useMemo(() => {
    const count: Record<string, number> = {};
    for (const s of sets) if (Number(s.weight) > 0) count[s.exercise] = (count[s.exercise] ?? 0) + 1;
    return Object.keys(count).sort((a, b) => count[b] - count[a]);
  }, [sets]);
  const lift = picked && lifts.includes(picked) ? picked : lifts[0];

  const strength = useMemo(() => {
    if (!lift) return null;
    const byWorkout: Record<string, { t: number; date: string; v: number; w: number; r: number }> = {};
    for (const s of sets) {
      if (s.exercise !== lift) continue;
      const v = e1rm(Number(s.weight), s.reps);
      const cur = byWorkout[s.workout_id];
      if (!cur || v > cur.v) byWorkout[s.workout_id] = { t: new Date(s.created_at).getTime(), date: s.created_at, v, w: Number(s.weight), r: s.reps };
    }
    const pts = Object.values(byWorkout).sort((a, b) => a.t - b.t);
    // Trend: least-squares slope over real time, in units per week
    let perWeek = 0;
    if (pts.length >= 3) {
      const mt = pts.reduce((a, p) => a + p.t, 0) / pts.length;
      const mv = pts.reduce((a, p) => a + p.v, 0) / pts.length;
      const sxy = pts.reduce((a, p) => a + (p.t - mt) * (p.v - mv), 0);
      const sxx = pts.reduce((a, p) => a + (p.t - mt) ** 2, 0);
      perWeek = sxx ? (sxy / sxx) * 7 * DAY : 0;
    }
    return { pts, perWeek };
  }, [sets, lift]);

  // ---------- Volume: last 8 weeks ----------
  const weekly = useMemo(() => {
    const start = weekStart().getTime();
    const all = Array.from({ length: 8 }, (_, i) => {
      const from = start - (7 - i) * 7 * DAY, to = from + 7 * DAY;
      const inWeek = (iso: string) => { const t = new Date(iso).getTime(); return t >= from && t < to; };
      const s = sets.filter((x) => inWeek(x.created_at));
      const c = cardio.filter((x) => inWeek(x.done_at));
      return {
        label: new Date(from).toLocaleDateString([], { month: "short", day: "numeric" }),
        volume: Math.round(s.reduce((v, x) => v + Number(x.weight) * x.reps, 0)),
        days: workouts.filter((w) => inWeek(w.started_at)).length,
        cardio: c.reduce((n, x) => n + x.minutes, 0),
        sets: s.length,
      };
    });
    // Start at your first week with anything logged, so empty weeks before you joined don't drag the trend
    const first = all.findIndex((w) => w.sets || w.days || w.cardio);
    return first < 0 ? all : all.slice(first);
  }, [sets, workouts, cardio]);

  // ---------- Muscles ----------
  const muscleSets = useMemo(() => {
    const out: Record<string, number> = Object.fromEntries(MUSCLES.map((m) => [m, 0]));
    const since = weekStart().getTime();
    for (const s of sets) {
      if (new Date(s.created_at).getTime() < since) continue;
      const ex = EXERCISES[s.exercise];
      if (!ex) continue;
      out[ex.muscle] += 1;
      for (const m of ex.also) out[m] += 0.5;
    }
    return out;
  }, [sets]);

  // Push vs pull over the last 14 days (main muscle only)
  const balance = useMemo(() => {
    const since = Date.now() - 14 * DAY;
    let push = 0, pull = 0;
    for (const s of sets) {
      if (new Date(s.created_at).getTime() < since) continue;
      const m = EXERCISES[s.exercise]?.muscle;
      if (m === "Chest" || m === "Shoulders" || m === "Triceps") push++;
      if (m === "Back" || m === "Biceps") pull++;
    }
    return { push, pull };
  }, [sets]);

  // ---------- Recovery ----------
  const findings = useMemo(() => readiness(workouts, sets), [workouts, sets]);
  const scatter = useMemo(() => {
    const sc = workoutScores(workouts, sets);
    return workouts
      .filter((w) => w.sleep_hours != null && sc[w.id] !== undefined)
      .map((w) => ({ sleep: w.sleep_hours!, energy: w.energy, pct: (sc[w.id] - 1) * 100, date: w.started_at }));
  }, [workouts, sets]);

  function exportCsv() {
    const byId = Object.fromEntries(workouts.map((w) => [w.id, w]));
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = [["date", "day", "exercise", "muscle", "set", "weight", "reps", "est_1rm", "sleep_hours", "energy"]];
    for (const s of sets) {
      const w = byId[s.workout_id];
      rows.push([s.created_at, w?.day_name ?? "", s.exercise, EXERCISES[s.exercise]?.muscle ?? "", String(s.set_no),
        String(s.weight), String(s.reps), String(e1rm(Number(s.weight), s.reps)), String(w?.sleep_hours ?? ""), String(w?.energy ?? "")]);
    }
    const blob = new Blob([rows.map((r) => r.map(esc).join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `splits-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  if (loading) return null;
  if (!user) return <Login />;
  if (!ready || !settings) return <p className="p-6 text-steel">Crunching your numbers...</p>;
  const unit = settings.unit;

  if (!sets.length) {
    return (
      <main className="px-5 pt-6 flex flex-col gap-4">
        <h1 className="font-cond text-5xl font-extrabold">Analytics</h1>
        <p className="text-lg text-steel">Charts need data. Log a few workouts on Today and your strength trends, volume and recovery patterns show up here.</p>
        <Link href="/" className="self-start rounded-xl bg-ink text-white px-5 py-3 font-bold">Go to Today</Link>
      </main>
    );
  }

  const delta = (a: number, b: number) => (b ? Math.round(((a - b) / b) * 100) : null);
  const kpiTiles = kpis ? [
    { label: "Workouts", value: String(kpis.cur.workouts), d: delta(kpis.cur.workouts, kpis.prev.workouts) },
    { label: "Sets", value: String(kpis.cur.sets), d: delta(kpis.cur.sets, kpis.prev.sets) },
    { label: `Volume (${unit})`, value: fmtNum(kpis.cur.volume), d: delta(kpis.cur.volume, kpis.prev.volume) },
    { label: "Avg sleep", value: kpis.cur.sleep != null ? `${kpis.cur.sleep.toFixed(1)}h` : "None", d: null },
  ] : [];

  return (
    <main className="px-5 pt-6 flex flex-col gap-6 pb-4">
      <div>
        <h1 className="font-cond text-5xl font-extrabold">Analytics</h1>
        <p className="text-steel">Last 2 weeks, compared with the 2 weeks before.</p>
      </div>

      {/* KPI tiles */}
      <dl className="grid grid-cols-2 gap-2">
        {kpiTiles.map((k) => (
          <div key={k.label} className="rounded-2xl bg-white border border-line p-3 flex flex-col-reverse">
            <dt className="text-sm font-semibold text-steel">
              {k.label}
              {k.d !== null && (
                <span className={"ml-1 font-bold " + (k.d >= 0 ? "text-good" : "text-[#B3132B]")}>{k.d >= 0 ? "+" : ""}{k.d}%</span>
              )}
            </dt>
            <dd className="font-cond text-4xl font-extrabold tabular leading-none">{k.value}</dd>
          </div>
        ))}
      </dl>

      {/* Pick a view */}
      <div className="grid grid-cols-4 gap-1 rounded-2xl bg-white border border-line p-1 sticky top-[3.6rem] z-30" role="tablist">
        {VIEWS.map((v) => (
          <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)}
            className={"rounded-xl py-2 text-sm font-bold " + (view === v ? "bg-ink text-white" : "text-steel")}>{v}</button>
        ))}
      </div>

      {view === "Strength" && strength && lift && (
        <section className="flex flex-col gap-4">
          <div className="flex gap-2 overflow-x-auto -mx-5 px-5 pb-1" role="group" aria-label="Pick a lift">
            {lifts.map((n) => (
              <button key={n} type="button" onClick={() => setPicked(n)} aria-pressed={n === lift}
                className={"shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold border " + (n === lift ? "bg-ink text-white border-ink" : "bg-white border-line")}>{n}</button>
            ))}
          </div>
          <div>
            <p className="text-steel">{lift}, estimated 1-rep max</p>
            <p className="font-cond text-6xl font-extrabold tabular leading-none">
              {strength.pts[strength.pts.length - 1].v}<span className="text-2xl text-steel"> {unit}</span>
            </p>
          </div>
          <LineChart trend unit={unit} ariaLabel={`${lift} estimated max over ${strength.pts.length} sessions`}
            points={strength.pts.map((p) => ({ label: shortDate(p.date), value: p.v, detail: `top set ${fmt(p.w)} × ${p.r}` }))} />
          {strength.pts.length >= 3 ? (
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-2xl bg-white border border-line p-3">
                <p className="text-sm font-semibold text-steel">Trend</p>
                <p className={"font-cond text-3xl font-bold tabular " + (strength.perWeek > 0.2 ? "text-good" : "")}>
                  {strength.perWeek >= 0 ? "+" : ""}{strength.perWeek.toFixed(1)} {unit}<span className="text-base text-steel"> / week</span>
                </p>
              </div>
              <div className="rounded-2xl bg-white border border-line p-3">
                <p className="text-sm font-semibold text-steel">In 4 weeks, at this pace</p>
                <p className="font-cond text-3xl font-bold tabular">~{Math.round(strength.pts[strength.pts.length - 1].v + strength.perWeek * 4)} {unit}</p>
              </div>
            </div>
          ) : (
            <p className="text-steel">Log this lift 3+ times to see its trend.</p>
          )}
          <details className="text-sm rounded-2xl bg-white border border-line p-3">
            <summary className="cursor-pointer font-semibold">How this is calculated</summary>
            <p className="mt-2">Each dot is your best set that day, turned into an estimated 1-rep max with the Epley formula: weight × (1 + reps ÷ 30). That lets a heavy 5 and a lighter 10 be compared fairly.</p>
            <p className="mt-2">The dashed line is a least-squares trend line. The 4-week number just extends it, so treat it as a rough guess. Progress slows as you get stronger.</p>
          </details>
        </section>
      )}

      {view === "Volume" && (
        <section className="flex flex-col gap-8">
          <div className="flex flex-col gap-2">
            <div>
              <h2 className="font-cond text-3xl font-bold">Weekly volume</h2>
              <p className="text-steel">Total weight moved (weight × reps, every set), per week. The dashed line is the trend. This week is still in progress.</p>
            </div>
            <LineChart trend zero unit={unit} ariaLabel="Weekly volume, last 8 weeks"
              points={weekly.map((w) => ({ label: w.label, value: w.volume, detail: `${w.sets} sets` }))} />
          </div>
          <div className="flex flex-col gap-2">
            <div>
              <h2 className="font-cond text-3xl font-bold">Lifting days per week</h2>
              <p className="text-steel">The green line is your goal of {settings.lift_goal}.</p>
            </div>
            <LineChart zero goal={settings.lift_goal} color="#1F5FBF" unit="days" height={150} ariaLabel="Lifting days per week, last 8 weeks"
              points={weekly.map((w) => ({ label: w.label, value: w.days }))} />
          </div>
          <div className="flex flex-col gap-2">
            <div>
              <h2 className="font-cond text-3xl font-bold">Walking and running</h2>
              <p className="text-steel">Minutes per week.</p>
            </div>
            <LineChart zero color="#2E8B57" unit="min" height={150} ariaLabel="Cardio minutes per week, last 8 weeks"
              points={weekly.map((w) => ({ label: w.label, value: w.cardio }))} />
          </div>
        </section>
      )}

      {view === "Muscles" && (
        <section className="flex flex-col gap-6">
          <div>
            <h2 className="font-cond text-3xl font-bold">Sets per muscle this week</h2>
            <p className="text-steel">Darker means more work. 10-20 hard sets a week (the green zone) is a common target for building muscle. Helper muscles count as half.</p>
          </div>
          <MuscleMap sets={muscleSets} />
          <div className="flex flex-col gap-2">
            {MUSCLES.map((m) => {
              const n = muscleSets[m], max = 24;
              return (
                <div key={m} className="grid grid-cols-[6.5rem_1fr_2.5rem] items-center gap-2">
                  <span className="text-sm font-semibold">{m}</span>
                  <div className="relative h-4 rounded bg-white">
                    <div className="absolute inset-y-0 bg-[#2E8B57]/15" style={{ left: `${(10 / max) * 100}%`, width: `${(10 / max) * 100}%` }} aria-hidden="true" />
                    <div className="absolute inset-y-0 left-0 rounded-r bg-ink" style={{ width: `${Math.min(100, (n / max) * 100)}%` }} />
                  </div>
                  <span className="text-sm tabular text-right">{fmt(n)}</span>
                </div>
              );
            })}
          </div>
          <div className="rounded-2xl bg-white border border-line p-4 flex flex-col gap-2">
            <h3 className="font-cond text-2xl font-bold">Push vs pull, last 2 weeks</h3>
            <div className="flex h-5 rounded overflow-hidden" aria-hidden="true">
              <div style={{ width: `${(balance.push / Math.max(1, balance.push + balance.pull)) * 100}%`, background: "#D7263D" }} />
              <div className="flex-1" style={{ background: "#1F5FBF" }} />
            </div>
            <p className="tabular"><strong>{balance.push}</strong> pushing sets (chest, shoulders, triceps) and <strong>{balance.pull}</strong> pulling sets (back, biceps).</p>
            <p className="text-sm text-steel">
              {balance.push + balance.pull === 0 ? "No upper-body sets yet."
                : balance.pull >= balance.push * 0.8 ? "Nicely balanced. Pulling about as much as you push is easier on your shoulders."
                : "You push a lot more than you pull. Adding a row or face pull helps keep shoulders healthy."}
            </p>
          </div>
        </section>
      )}

      {view === "Recovery" && (
        <section className="flex flex-col gap-5">
          <div>
            <h2 className="font-cond text-3xl font-bold">What helps you lift</h2>
            <p className="text-steel">Each workout is scored against your own trend line for every lift, so getting stronger over time doesn&apos;t skew it. 0% means right on trend.</p>
          </div>
          <SleepScatter points={scatter} />
          {findings.map((f) => f && (
            <div key={f.label} className="rounded-2xl bg-white border border-line p-4 flex flex-col gap-1">
              <p className="font-cond text-2xl font-bold">{f.label}</p>
              {Number.isNaN(f.diff) ? (
                <p className="text-steel">Need at least 3 workouts on each side to compare. So far: {f.nHigh} with {f.high}, {f.nLow} with {f.low}.</p>
              ) : (
                <p className="text-lg">
                  You lift <strong className="tabular">{Math.abs(f.diff).toFixed(1)}% {f.diff >= 0 ? "stronger" : "weaker"}</strong> with {f.high} than with {f.low}.
                  <span className="block text-sm text-steel">Based on {f.nHigh + f.nLow} workouts. It&apos;s a pattern in your own data, not proof of cause.</span>
                </p>
              )}
            </div>
          ))}
        </section>
      )}

      {/* Export */}
      <section className="mt-4 rounded-2xl bg-white border border-line p-4 flex flex-col gap-2">
        <h2 className="font-cond text-2xl font-bold">Take your data with you</h2>
        <p className="text-sm text-steel">Every set, with dates, sleep and energy. Opens in Excel, Google Sheets, Tableau or Python.</p>
        <button type="button" onClick={exportCsv} className="self-start rounded-xl border-2 border-ink px-4 py-2 font-bold">Download CSV ({sets.length} sets)</button>
      </section>
    </main>
  );
}

// Sleep (x) vs how strong the workout was compared with your trend (y)
function SleepScatter({ points }: { points: { sleep: number; pct: number; date: string }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length < 3) return <p className="rounded-2xl bg-white border border-line p-4 text-steel">Do the quick check-in before a few workouts and a sleep chart shows up here.</p>;
  const W = 340, H = 200, padL = 40, padR = 12, padT = 12, padB = 32;
  const lim = Math.max(3, Math.ceil(Math.max(...points.map((p) => Math.abs(p.pct)))));
  const x = (h: number) => padL + ((h - 4.5) / 5) * (W - padL - padR);
  const y = (v: number) => padT + (1 - (v + lim) / (2 * lim)) * (H - padT - padB);
  // spread out dots that share the same sleep value so they don't stack
  const seen: Record<number, number> = {};
  const placed = points.map((p) => { const k = (seen[p.sleep] = (seen[p.sleep] ?? 0) + 1); return { ...p, jx: ((k % 5) - 2) * 3 }; });
  const shown = hover !== null ? placed[hover] : null;
  return (
    <div className="rounded-2xl bg-white border border-line p-3 flex flex-col gap-1">
      <p className="font-semibold">Sleep vs workout strength</p>
      <p className="text-sm text-steel tabular h-5">
        {shown ? <>{shortDate(shown.date)}: {shown.sleep}h sleep, <strong className="text-ink">{shown.pct >= 0 ? "+" : ""}{shown.pct.toFixed(1)}%</strong> vs trend</> : "Tap a dot."}
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Scatter plot of hours of sleep against workout strength compared with trend">
        {[-lim, 0, lim].map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke={t === 0 ? "#5B6474" : "#CDD2D9"} strokeWidth="1" strokeDasharray={t === 0 ? "4 3" : undefined} />
            <text x={padL - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#5B6474">{t > 0 ? "+" : ""}{t}%</text>
          </g>
        ))}
        {[5, 6, 7, 8, 9].map((h) => (
          <text key={h} x={x(h)} y={H - 14} textAnchor="middle" fontSize="11" fill="#5B6474">{h === 5 ? "≤5h" : h === 9 ? "9h+" : `${h}h`}</text>
        ))}
        <text x={(W + padL) / 2} y={H - 1} textAnchor="middle" fontSize="11" fill="#5B6474">hours of sleep</text>
        {placed.map((p, i) => (
          <circle key={i} cx={x(p.sleep) + p.jx} cy={y(p.pct)} r={hover === i ? 7 : 5}
            fill={p.sleep >= 7 ? "#2E8B57" : "#D7263D"} fillOpacity="0.8" stroke="#fff" strokeWidth="1.5"
            onPointerEnter={() => setHover(i)} onClick={() => setHover(i)} />
        ))}
      </svg>
      <p className="text-xs text-steel">Green: 7+ hours. Red: under 7.</p>
    </div>
  );
}
