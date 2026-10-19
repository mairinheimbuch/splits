import type { Exercise } from "@/lib/program";

export type SetRow = { id: string; workout_id: string; exercise: string; set_no: number; weight: number; reps: number; created_at: string };

// Estimated one-rep max (Epley). Lets a heavy 5 and a lighter 10 be compared fairly.
export function e1rm(weight: number, reps: number) {
  if (!weight || !reps) return 0;
  return Math.round(weight * (1 + reps / 30));
}

export function fmt(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

// "Next time, try..." using double progression:
// fill the rep range on every set, then add weight. Every tip explains itself in `why`.
export function suggest(ex: Exercise, last: { weight: number; reps: number }[]) {
  const [lo, hi] = ex.reps;
  const range = `${lo}–${hi}`;
  if (!last.length) {
    return {
      weight: 0, reps: hi,
      note: ex.step
        ? `First time. Pick a weight you could do for ${hi} reps with 1–2 left in the tank.`
        : `First time. Do as many clean reps as you can, up to ${hi}.`,
      why: `Starting a little light on purpose gives you a clean baseline. "1–2 left in the tank" means you stop when you could still do 1 or 2 more good reps. That's hard enough to build muscle, without grinding out ugly reps.`,
    };
  }
  const w = last[0].weight;
  const done = last.map((s) => s.reps).join(", ");
  const minReps = Math.min(...last.map((s) => s.reps));
  if (last.length >= Math.min(ex.sets, 2) && last.every((s) => s.reps >= hi)) {
    if (!ex.step) return {
      weight: w, reps: hi,
      note: `You hit ${hi} on every set. Add weight (a belt or vest) or slow the reps down.`,
      why: `You reached the top of your ${range} range on every set (${done}), so this is getting easy. With bodyweight moves you make it harder by adding load, or by slowing each rep to about 3 seconds down.`,
    };
    return {
      weight: w + ex.step, reps: lo,
      note: `You hit ${hi} on every set. Go up to ${fmt(w + ex.step)} and aim for ${lo}+.`,
      why: `Last time you did ${done} at ${fmt(w)}, the top of your ${range} range on every set. That means you're stronger than this weight now. Adding the smallest jump (${fmt(ex.step)}) usually drops you to about ${lo} reps, so you build back up again. This is called double progression: reps first, then weight.`,
    };
  }
  if (minReps < lo) return {
    weight: w, reps: lo,
    note: `Stay at ${fmt(w)} and get every set to ${lo} reps.`,
    why: `At least one set (${done}) fell under ${lo}, the bottom of your ${range} range. Adding weight now would make that worse. Stay here until every set reaches ${lo}. If it doesn't happen in 2–3 sessions, drop the weight about 10%.`,
  };
  return {
    weight: w, reps: Math.min(hi, minReps + 1),
    note: `Stay at ${fmt(w)} and beat last time by one rep.`,
    why: `You're inside your ${range} range (${done}). One more rep on any set is progress. Once every set hits ${hi}, the app tells you to add weight.`,
  };
}

// Monday 12:00 AM of this week
export function weekStart(d = new Date()) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - day);
  return x;
}

export function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}
