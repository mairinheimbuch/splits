import { weekStart, e1rm, type SetRow } from "@/lib/stats";

type Dated = { started_at: string };

// How many weeks in a row you hit your lifting goal.
// This week counts once you hit it; until then it doesn't break the streak.
export function weekStreak(workouts: Dated[], goal: number) {
  const start = weekStart().getTime();
  const week = 7 * 24 * 3600 * 1000;
  const countIn = (i: number) => {
    const from = start - i * week, to = from + week;
    return workouts.filter((w) => { const t = new Date(w.started_at).getTime(); return t >= from && t < to; }).length;
  };
  let streak = countIn(0) >= goal ? 1 : 0;
  for (let i = 1; i < 104; i++) {
    if (countIn(i) >= goal) streak++;
    else break;
  }
  return streak;
}

export type Gain = { name: string; up: number };

// Lifts where this week's best beat everything before this week (by estimated max)
export function weekGains(sets: SetRow[]) {
  const start = weekStart().getTime();
  const before: Record<string, number> = {};
  const now: Record<string, number> = {};
  for (const s of sets) {
    const v = e1rm(Number(s.weight), s.reps);
    const bucket = new Date(s.created_at).getTime() >= start ? now : before;
    bucket[s.exercise] = Math.max(bucket[s.exercise] ?? 0, v);
  }
  return Object.entries(now)
    .filter(([name, v]) => before[name] && v > before[name])
    .map(([name, v]) => ({ name, up: v - before[name] }))
    .sort((a, b) => b.up - a.up);
}

// ---------- Plateau detector ----------
// A lift is stuck when your best in the last 3 weeks isn't better than your best before that.
export type Plateau = { name: string; best: number; since: string; sessions: number };

export function plateaus(sets: SetRow[]): { stuck: Plateau[]; checked: number } {
  if (!sets.length) return { stuck: [], checked: 0 };
  const windowStart = Date.now() - 21 * 24 * 3600 * 1000;
  const byLift: Record<string, SetRow[]> = {};
  for (const s of sets) (byLift[s.exercise] ??= []).push(s);
  const out: Plateau[] = [];
  let checked = 0;
  for (const [name, rows] of Object.entries(byLift)) {
    const sessions = new Set(rows.map((r) => r.workout_id)).size;
    const recent = rows.filter((r) => new Date(r.created_at).getTime() >= windowStart);
    const older = rows.filter((r) => new Date(r.created_at).getTime() < windowStart);
    const recentSessions = new Set(recent.map((r) => r.workout_id)).size;
    if (sessions < 4 || recentSessions < 2 || !older.length) continue;
    const bestOld = older.reduce((a, b) => (e1rm(Number(b.weight), b.reps) > e1rm(Number(a.weight), a.reps) ? b : a));
    const oldMax = e1rm(Number(bestOld.weight), bestOld.reps);
    if (!oldMax) continue; // bodyweight lifts with no added weight: progress is reps, not tracked here
    checked++;
    const newMax = Math.max(...recent.map((r) => e1rm(Number(r.weight), r.reps)));
    if (newMax <= oldMax) out.push({ name, best: oldMax, since: bestOld.created_at, sessions: recentSessions });
  }
  return { stuck: out, checked };
}

// ---------- Sleep and energy vs strength ----------
// Each workout gets a strength score: how your top sets compared with what your trend line expected that day.
// Using a trend line matters: you get stronger every week, so without it, later workouts would always look "better".
export type CheckinWorkout = { id: string; sleep_hours: number | null; energy: number | null };

function scores(workouts: CheckinWorkout[], sets: SetRow[]) {
  // Best estimated max per lift per workout, with the time it happened
  const best: Record<string, Record<string, { v: number; t: number }>> = {}; // lift -> workout -> best
  for (const s of sets) {
    const v = e1rm(Number(s.weight), s.reps);
    if (!v) continue;
    const t = new Date(s.created_at).getTime();
    (best[s.exercise] ??= {});
    const cur = best[s.exercise][s.workout_id];
    if (!cur || v > cur.v) best[s.exercise][s.workout_id] = { v, t };
  }
  // For each lift, fit a straight line through its sessions, then score each session against the line
  const ratios: Record<string, number[]> = {};
  for (const byWorkout of Object.values(best)) {
    const pts = Object.entries(byWorkout);
    if (pts.length < 3) continue;
    const n = pts.length;
    const mt = pts.reduce((a, [, p]) => a + p.t, 0) / n;
    const mv = pts.reduce((a, [, p]) => a + p.v, 0) / n;
    const cov = pts.reduce((a, [, p]) => a + (p.t - mt) * (p.v - mv), 0);
    const vt = pts.reduce((a, [, p]) => a + (p.t - mt) ** 2, 0);
    const slope = vt ? cov / vt : 0;
    for (const [wid, p] of pts) {
      const expected = mv + slope * (p.t - mt);
      if (expected > 0) (ratios[wid] ??= []).push(p.v / expected);
    }
  }
  const out: Record<string, number> = {};
  for (const w of workouts) {
    const r = ratios[w.id];
    if (r?.length) out[w.id] = r.reduce((a, b) => a + b, 0) / r.length;
  }
  return out;
}

export type Finding = { label: string; high: string; low: string; diff: number; nHigh: number; nLow: number } | null;

function compare(workouts: CheckinWorkout[], sc: Record<string, number>, pick: (w: CheckinWorkout) => boolean | null, label: string, high: string, low: string): Finding {
  const hi: number[] = [], lo: number[] = [];
  for (const w of workouts) {
    const side = pick(w);
    if (side === null || sc[w.id] === undefined) continue;
    (side ? hi : lo).push(sc[w.id]);
  }
  if (hi.length < 3 || lo.length < 3) return { label, high, low, diff: NaN, nHigh: hi.length, nLow: lo.length };
  const m = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  return { label, high, low, diff: (m(hi) / m(lo) - 1) * 100, nHigh: hi.length, nLow: lo.length };
}

export function readiness(workouts: CheckinWorkout[], sets: SetRow[]) {
  const sc = scores(workouts, sets);
  return [
    compare(workouts, sc, (w) => (w.sleep_hours == null ? null : w.sleep_hours >= 7), "Sleep", "7+ hours", "under 7 hours"),
    compare(workouts, sc, (w) => (w.energy == null ? null : w.energy >= 4), "Energy", "high energy (4-5)", "lower energy (1-3)"),
  ];
}
