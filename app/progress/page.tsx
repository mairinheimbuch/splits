"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useUser } from "@/lib/useUser";
import { useTraining, type Workout } from "@/lib/useTraining";
import { getDay } from "@/lib/program";
import { e1rm, fmt, shortDate, weekStart } from "@/lib/stats";
import { weekStreak, weekGains, plateaus } from "@/lib/insights";
import Login from "@/components/Login";
import Plate from "@/components/Plate";

// Recap: how this week went, what to fix, your bests and your history. Charts live on Analytics.
export default function Recap() {
  const { user, loading } = useUser();
  const { settings, workouts, sets, cardio, ready } = useTraining(user?.id);

  const recap = useMemo(() => {
    if (!workouts.length || !settings) return null;
    const start = weekStart().getTime();
    const lastStart = start - 7 * 24 * 3600 * 1000;
    const t = (w: Workout) => new Date(w.started_at).getTime();
    const weekCardio = cardio.filter((c) => new Date(c.done_at).getTime() >= start);
    return {
      thisWeek: workouts.filter((w) => t(w) >= start).length,
      lastWeek: workouts.filter((w) => t(w) >= lastStart && t(w) < start).length,
      weekSets: sets.filter((x) => new Date(x.created_at).getTime() >= start).length,
      cardioCount: weekCardio.length,
      cardioMin: weekCardio.reduce((n, c) => n + c.minutes, 0),
      streak: weekStreak(workouts, settings.lift_goal),
      gains: weekGains(sets).slice(0, 3),
    };
  }, [workouts, sets, cardio, settings]);

  const { stuck, checked } = useMemo(() => plateaus(sets), [sets]);

  // Your top set on every lift, by estimated max
  const prs = useMemo(() => {
    const top: Record<string, (typeof sets)[number]> = {};
    for (const s of sets) {
      const cur = top[s.exercise];
      if (!cur || e1rm(Number(s.weight), s.reps) > e1rm(Number(cur.weight), cur.reps)) top[s.exercise] = s;
    }
    return Object.values(top).sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [sets]);

  if (loading) return null;
  if (!user) return <Login />;
  if (!ready || !settings) return <p className="p-6 text-steel">Loading your recap...</p>;

  if (!workouts.length) {
    return (
      <main className="px-5 pt-6 flex flex-col gap-4">
        <h1 className="font-cond text-5xl font-extrabold">Recap</h1>
        <p className="text-lg text-steel">Finish your first workout on Today and your weekly recap and personal bests show up here.</p>
        <Link href="/" className="self-start rounded-xl bg-ink text-white px-5 py-3 font-bold">Go to Today</Link>
      </main>
    );
  }

  const recent = [...workouts].reverse().slice(0, 6);
  const topPrs = prs.slice(0, 6);

  return (
    <main className="px-5 pt-6 flex flex-col gap-9">
      <div>
        <h1 className="font-cond text-5xl font-extrabold">Recap</h1>
        <p className="text-steel">Your week in plain words. For charts and trends, open Analytics.</p>
      </div>

      {/* 1. Your week */}
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
              {recap.thisWeek >= settings.lift_goal ? ". Weekly goal hit." : `. ${settings.lift_goal - recap.thisWeek} to go for your goal.`}
              {recap.lastWeek > 0 && <span className="text-white/70"> Last week: {recap.lastWeek}.</span>}
            </li>
            <li>
              <strong>{recap.weekSets}</strong> sets logged
              {recap.cardioCount ? <>, plus <strong>{recap.cardioCount} {recap.cardioCount === 1 ? "walk or run" : "walks and runs"}</strong> ({recap.cardioMin} min)</> : null}.
            </li>
            {recap.gains.length > 0 ? recap.gains.map((g) => (
              <li key={g.name}><strong>{g.name}</strong> is up <strong>{g.up} {settings.unit}</strong> (estimated max).</li>
            )) : (
              <li className="text-white/70">No new bests yet this week. Beat last time by one rep to get one.</li>
            )}
          </ul>
        </section>
      )}

      {/* 2. What to fix */}
      <section className="flex flex-col gap-3">
        <div>
          <h2 className="font-cond text-3xl font-bold">Stuck lifts</h2>
          <p className="text-steel">A lift is stuck when your last 3 weeks didn&apos;t beat your best from before that.</p>
        </div>
        {checked === 0 ? (
          <p className="rounded-2xl bg-white border border-line p-4 text-steel">Needs about 4 sessions of a lift over 3+ weeks before it can tell. Keep logging and this fills in.</p>
        ) : stuck.length === 0 ? (
          <p className="rounded-2xl bg-white border border-line p-4">Nothing stuck. All {checked} lifts with enough history are still going up.</p>
        ) : stuck.map((p) => (
          <div key={p.name} className="rounded-2xl bg-white border-2 border-[#F2B705] p-4 flex flex-col gap-1">
            <p className="font-cond text-2xl font-bold">{p.name}</p>
            <p>Your best estimated max is <strong className="tabular">{p.best} {settings.unit}</strong>, set {shortDate(p.since)}. {p.sessions} sessions since haven&apos;t beaten it.</p>
            <p className="text-steel">Try this: drop the weight about 10% for one week, then build back up. Or switch rep ranges for 3 weeks (heavier for 4-6 reps, or lighter for 12-15).</p>
          </div>
        ))}
      </section>

      {/* 3. Personal bests */}
      <section className="flex flex-col gap-2">
        <h2 className="font-cond text-3xl font-bold">Personal bests</h2>
        <ul className="divide-y divide-line border-y border-line">
          {topPrs.map((p) => (
            <li key={p.exercise} className="py-3 flex justify-between gap-3">
              <span className="font-semibold">{p.exercise}</span>
              <span className="tabular text-right">{fmt(Number(p.weight))} × {p.reps}<span className="block text-xs text-steel">{shortDate(p.created_at)}</span></span>
            </li>
          ))}
        </ul>
        {prs.length > topPrs.length && (
          <details>
            <summary className="cursor-pointer font-semibold text-steel">See all {prs.length}</summary>
            <ul className="divide-y divide-line border-b border-line">
              {prs.slice(topPrs.length).map((p) => (
                <li key={p.exercise} className="py-3 flex justify-between gap-3">
                  <span className="font-semibold">{p.exercise}</span>
                  <span className="tabular text-right">{fmt(Number(p.weight))} × {p.reps}<span className="block text-xs text-steel">{shortDate(p.created_at)}</span></span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      {/* 4. History */}
      <section className="flex flex-col gap-2">
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

      <Link href="/analytics" className="mb-4 rounded-2xl bg-white border-2 border-ink p-4 flex items-center justify-between gap-3">
        <span>
          <span className="block font-cond text-2xl font-bold">See the charts</span>
          <span className="block text-sm text-steel">Strength trends, training volume, muscles and what helps you lift.</span>
        </span>
        <span className="text-2xl" aria-hidden="true">›</span>
      </Link>
    </main>
  );
}
