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