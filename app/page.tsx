"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase, getSettings, type Settings } from "@/lib/supabase";
import { useUser } from "@/lib/useUser";
import { EXERCISES, MUSCLES, getDay } from "@/lib/program";
import { e1rm, fmt, shortDate, weekStart, type SetRow } from "@/lib/stats";
import Login from "@/components/Login";
import Plate from "@/components/Plate";
import MuscleMap from "@/components/MuscleMap";
import { weekStreak, weekGains } from "@/lib/insights";

type Workout = { id: string; day_name: string; started_at: string; finished_at: string | null };
type Point = { date: string; best: number; weight: number; reps: number };

export default function Progress() {
  const { user, loading } = useUser();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [sets, setSets] = useState<SetRow[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const [cardio, setCardio] = useState<{ minutes: number; done_at: string }[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setSettings(await getSettings(user.id));
      const { data: w } = await supabase.from("workouts").select("*").not("finished_at", "is", null).order("started_at");
      const fin = (w ?? []) as Workout[];
      setWorkouts(fin);
      const { data: s } = await supabase.from("sets").select("*").order("created_at").limit(5000);
      const ids = new Set(fin.map((x) => x.id));
      setSets(((s ?? []) as SetRow[]).filter((x) => ids.has(x.workout_id)));
      const { data: c } = await supabase.from("cardio").select("minutes, done_at").gte("done_at", weekStart().toISOString());
      setCardio(c ?? []);
      setReady(true);
    })();
  }, [user]);

  // Lifts you've logged, most-logged first
  const lifts = useMemo(() => {
    const count: Record<string, number> = {};
    for (const s of sets) count[s.exercise] = (count[s.exercise] ?? 0) + 1;
    return Object.keys(count).sort((a, b) => count[b] - count[a]);
  }, [sets]);
  const lift = picked && lifts.includes(picked) ? picked : lifts[0];

  // Best estimated max per session for the chosen lift
  const points: Point[] = useMemo(() => {
    if (!lift) return [];
    const byWorkout: Record<string, Point> = {};
    for (const s of sets.filter((x) => x.exercise === lift)) {
      const v = e1rm(Number(s.weight), s.reps);
      const cur = byWorkout[s.workout_id];
      if (!cur || v > cur.best) byWorkout[s.workout_id] = { date: s.created_at, best: v, weight: Number(s.weight), reps: s.reps };
    }
    return Object.values(byWorkout).sort((a, b) => a.date.localeCompare(b.date));
  }, [sets, lift]);

  // Sets per muscle this week (main muscle = 1 set, helpers = half)
  const muscleSets = useMemo(() => {
    const out: Record<string, number> = Object.fromEntries(MUSCLES.map((m) => [m, 0]));
    if (!sets.length) return out;
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

  // Lifting days per week, last 8 weeks
  const weeks = useMemo(() => {
    if (!workouts.length) return [];
    const start = weekStart();
    return Array.from({ length: 8 }, (_, i) => {
      const from = new Date(start); from.setDate(from.getDate() - 7 * (7 - i));
      const to = new Date(from); to.setDate(to.getDate() + 7);
      const n = workouts.filter((w) => { const t = new Date(w.started_at); return t >= from && t < to; }).length;
      return { label: from.toLocaleDateString([], { month: "short", day: "numeric" }), n };
    });
  }, [workouts]);

  // Personal bests: your top set (by estimated max) on every lift
  const prs = useMemo(() => lifts.map((name) => {
    const mine = sets.filter((s) => s.exercise === name);
    const top = mine.reduce((a, b) => (e1rm(Number(b.weight), b.reps) > e1rm(Number(a.weight), a.reps) ? b : a));
    return { name, weight: Number(top.weight), reps: top.reps, date: top.created_at, est: e1rm(Number(top.weight), top.reps) };
  }), [sets, lifts]);

  // Weekly recap
  const recap = useMemo(() => {
    if (!workouts.length || !settings) return null;
    const start = weekStart().getTime();
    const lastStart = start - 7 * 24 * 3600 * 1000;
    const t = (w: Workout) => new Date(w.started_at).getTime();
    const thisWeek = workouts.filter((w) => t(w) >= start).length;
    const lastWeek = workouts.filter((w) => t(w) >= lastStart && t(w) < start).length;
    const weekSets = sets.filter((x) => new Date(x.created_at).getTime() >= start).length;
    return { thisWeek, lastWeek, weekSets, streak: weekStreak(workouts, settings.lift_goal), gains: weekGains(sets).slice(0, 3) };
  }, [workouts, sets, settings]);

  if (loading) return null;
  if (!user) return <Login />;
  if (!ready || !settings) return <p className="p-6 text-steel">Loading your progress...</p>;

  if (!workouts.length) {
    return (
      <main className="px-6 pt-12 flex flex-col gap-4">
        <h1 className="font-cond text-5xl font-extrabold">Progress</h1>
        <p className="text-lg text-steel">Finish your first workout and your strength charts, personal bests and weekly sets show up here.</p>
      </main>
    );
  }

  // Chart geometry
  const W = 340, H = 180, padL = 36, padR = 12, padT = 12, padB = 24;
  const vals = points.map((p) => p.best);
  const lo = Math.floor((Math.min(...vals) * 0.95) / 5) * 5;
  const hi = Math.ceil((Math.max(...vals) * 1.05) / 5) * 5 || lo + 10;
  const x = (i: number) => padL + (points.length === 1 ? (W - padL - padR) / 2 : (i / (points.length - 1)) * (W - padL - padR));
  const y = (v: number) => padT + (1 - (v - lo) / Math.max(1, hi - lo)) * (H - padT - padB);
  const ticks = [lo, Math.round((lo + hi) / 2), hi];
  const first = points[0], latest = points[points.length - 1];
  const change = latest && first ? latest.best - first.best : 0;
  const shown = hover !== null ? points[hover] : latest;

  const maxWeek = Math.max(settings.lift_goal, ...weeks.map((w) => w.n));
  const recent = [...workouts].reverse().slice(0, 8);

  return (
    <main className="px-5 pt-10 flex flex-col gap-10">
      <h1 className="font-cond text-5xl font-extrabold">Progress</h1>

      {/* Your week, in plain words */}
      {recap && (
        <section className="rounded-2xl bg-ink text-white p-5 flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-cond text-3xl font-bold leading-none">Your week</h2>
              <p className="mt-1 text-white/70">Since Monday</p>
            </div>
            <div className="text-right">
              <p className="font-cond text-5xl font-extrabold tabular leading-none">{recap.streak}</p>
              <p className="text-sm text-white/70">{recap.streak === 1 ? "week" : "weeks"} in a row<br />at {settings.lift_goal}+ lifts</p>
            </div>
          </div>
          <ul className="flex flex-col gap-2 text-lg">
            <li>
              You lifted <strong>{recap.thisWeek} {recap.thisWeek === 1 ? "time" : "times"}</strong>
              {recap.thisWeek >= settings.lift_goal
                ? ". Weekly goal hit."
                : `. ${settings.lift_goal - recap.thisWeek} to go for your goal.`}
              {recap.lastWeek > 0 && <span className="text-white/70"> Last week: {recap.lastWeek}.</span>}
            </li>
            <li><strong>{recap.weekSets}</strong> sets logged{cardio.length ? <>, plus <strong>{cardio.length} {cardio.length === 1 ? "walk or run" : "walks and runs"}</strong> ({cardio.reduce((n, c) => n + c.minutes, 0)} min)</> : null}.</li>
            {recap.gains.length > 0 ? recap.gains.map((g) => (
              <li key={g.name}><strong>{g.name}</strong> is up <strong>{g.up} {settings.unit}</strong> (estimated max).</li>
            )) : (
              <li className="text-white/70">No new bests yet this week. Beat last time by one rep to get one.</li>
            )}
          </ul>
          {recap.streak === 0 && (
            <p className="text-sm text-white/70">Hit {settings.lift_goal} lifts this week to start a streak.</p>
          )}
        </section>
      )}

      {/* Strength over time */}
      {lift && (
        <section className="flex flex-col gap-3">
          <div className="flex gap-2 overflow-x-auto -mx-5 px-5 pb-1" role="group" aria-label="Pick a lift">
            {lifts.map((n) => (
              <button key={n} type="button" onClick={() => { setPicked(n); setHover(null); }} aria-pressed={n === lift}
                className={"shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold border " + (n === lift ? "bg-ink text-white border-ink" : "bg-white border-line")}>
                {n}
              </button>
            ))}
          </div>
          <div>
            <p className="text-steel">{lift}, estimated 1-rep max</p>
            <p className="font-cond text-6xl font-extrabold tabular leading-none">{shown.best}<span className="text-2xl text-steel"> {settings.unit}</span></p>
            <p className="mt-1 text-steel tabular">
              {hover !== null
                ? `${shortDate(shown.date)}: top set ${fmt(shown.weight)} × ${shown.reps}`
                : points.length > 1
                  ? `${change >= 0 ? "Up" : "Down"} ${Math.abs(change)} ${settings.unit} since ${shortDate(first.date)}`
                  : "Log this lift again to see your trend."}
            </p>
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full touch-none" role="img"
            aria-label={`${lift} estimated max over ${points.length} sessions, from ${first.best} to ${latest.best} ${settings.unit}`}
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
                <text x={padL - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#5B6474">{t}</text>
              </g>
            ))}
            {points.length > 1 && (
              <polyline fill="none" stroke="#1C2230" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"
                points={points.map((p, i) => `${x(i)},${y(p.best)}`).join(" ")} />
            )}
            {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={padT} y2={H - padB} stroke="#5B6474" strokeWidth="1" strokeDasharray="3 3" />}
            {points.map((p, i) => (
              <circle key={i} cx={x(i)} cy={y(p.best)} r={hover === i ? 6 : 4} fill="#1C2230" stroke="#E6E8EB" strokeWidth="2" />
            ))}
            <text x={padL} y={H - 6} fontSize="11" fill="#5B6474">{shortDate(first.date)}</text>
            {points.length > 1 && <text x={W - padR} y={H - 6} fontSize="11" fill="#5B6474" textAnchor="end">{shortDate(latest.date)}</text>}
          </svg>
          <details className="text-sm">
            <summary className="cursor-pointer font-semibold text-steel">See the numbers</summary>
            <table className="mt-2 w-full tabular">
              <thead><tr className="text-left text-steel"><th className="py-1 font-semibold">Date</th><th className="font-semibold">Top set</th><th className="font-semibold text-right">Est. max</th></tr></thead>
              <tbody>
                {[...points].reverse().map((p) => (
                  <tr key={p.date} className="border-t border-line"><td className="py-1">{shortDate(p.date)}</td><td>{fmt(p.weight)} × {p.reps}</td><td className="text-right">{p.best}</td></tr>
                ))}
              </tbody>
            </table>
          </details>
        </section>
      )}

      {/* Weekly sets per muscle */}
      <section className="flex flex-col gap-3">
        <div>
          <h2 className="font-cond text-3xl font-bold">Sets per muscle this week</h2>
          <p className="text-steel">The darker the muscle, the more it&apos;s worked. 10–20 hard sets a week is a common target for building muscle. Helper muscles count as half a set.</p>
        </div>
        <MuscleMap sets={muscleSets} />
        <div className="flex flex-col gap-2">
          {MUSCLES.map((m) => {
            const n = muscleSets[m];
            const max = 24;
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
      </section>

      {/* Consistency */}
      <section className="flex flex-col gap-3">
        <div>
          <h2 className="font-cond text-3xl font-bold">Lifting days per week</h2>
          <p className="text-steel">Last 8 weeks. The dashed line is your goal of {settings.lift_goal}.</p>
        </div>
        <div className="relative h-36 flex items-end gap-2 border-b border-line">
          <div className="absolute inset-x-0 border-t-2 border-dashed border-steel/50" style={{ bottom: `${(settings.lift_goal / maxWeek) * 100}%` }} aria-hidden="true" />
          {weeks.map((w, i) => (
            <div key={i} className="flex-1 flex flex-col items-center justify-end h-full" title={`Week of ${w.label}: ${w.n}`}>
              <span className="text-xs font-semibold tabular">{w.n || ""}</span>
              <div className="w-full rounded-t" style={{ height: `${(w.n / maxWeek) * 100}%`, background: w.n >= settings.lift_goal ? "#2E8B57" : "#1C2230" }} />
            </div>
          ))}
        </div>
        <div className="flex gap-2 text-[11px] text-steel">
          {weeks.map((w, i) => <span key={i} className="flex-1 text-center">{i % 2 === 1 ? w.label : ""}</span>)}
        </div>
      </section>

      {/* Personal bests */}
      <section className="flex flex-col gap-2">
        <h2 className="font-cond text-3xl font-bold">Personal bests</h2>
        <ul className="divide-y divide-line border-y border-line">
          {prs.map((p) => (
            <li key={p.name} className="py-3 flex justify-between gap-3">
              <span className="font-semibold">{p.name}</span>
              <span className="tabular text-right">{fmt(p.weight)} × {p.reps}<span className="block text-xs text-steel">{shortDate(p.date)}</span></span>
            </li>
          ))}
        </ul>
      </section>

      {/* Recent sessions */}
      <section className="flex flex-col gap-2 pb-6">
        <h2 className="font-cond text-3xl font-bold">Recent workouts</h2>
        <ul className="flex flex-col gap-2">
          {recent.map((w) => {
            const d = getDay(w.day_name);
            const mine = sets.filter((s) => s.workout_id === w.id);
            const vol = Math.round(mine.reduce((v, s) => v + Number(s.weight) * s.reps, 0));
            return (
              <li key={w.id} className="flex items-center gap-3 rounded-2xl bg-white border border-line p-3">
                <Plate color={d.color} ink={d.ink} size={36} />
                <div className="flex-1">
                  <p className="font-bold">{d.name}</p>
                  <p className="text-sm text-steel">{new Date(w.started_at).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}</p>
                </div>
                <p className="text-right text-sm tabular">{mine.length} sets<span className="block text-steel">{vol.toLocaleString()} {settings.unit}</span></p>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}