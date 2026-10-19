// Builds a split and exercise list from your answers. Every choice comes with a plain-English reason.
import { EXERCISES, DAYS, SPLITS, getSplit, type Muscle, type Gear, type Joint } from "@/lib/program";

export type Answers = {
  days: number;                                   // lifting days a week you can really do
  goal: "muscle" | "strength" | "fitness";
  experience: "new" | "some" | "lots";            // under 6 months / 6 months–2 years / 2+ years
  equipment: "gym" | "dumbbells" | "home";
  minutes: 45 | 60 | 75;
  focus: Muscle[];                                // muscles you want more of
  avoid: Joint[];                                 // sore spots to go easy on
};

export type Plan = {
  splitId: string;
  days: Record<string, string[]>;                 // day name -> exercises
  reasons: string[];                              // why this split
  swaps: string[];                                // what got swapped and why
};

const GEAR_FOR: Record<Answers["equipment"], Gear[]> = {
  gym: ["barbell", "dumbbell", "machine", "cable", "bodyweight"],
  dumbbells: ["dumbbell", "bodyweight"],
  home: ["bodyweight"],
};

// Which muscles each kind of day trains, so focus lifts land on the right days
const DAY_MUSCLES: Record<string, Muscle[]> = {
  Push: ["Chest", "Shoulders", "Triceps"],
  Pull: ["Back", "Biceps", "Forearms"],
  Legs: ["Quads", "Hamstrings", "Glutes", "Calves", "Core"],
  Upper: ["Chest", "Back", "Shoulders", "Biceps", "Triceps", "Forearms"],
  Lower: ["Quads", "Hamstrings", "Glutes", "Calves", "Core"],
  "Full Body A": ["Chest", "Back", "Shoulders", "Biceps", "Triceps", "Quads", "Hamstrings", "Glutes", "Calves", "Core", "Forearms"],
  "Full Body B": ["Chest", "Back", "Shoulders", "Biceps", "Triceps", "Quads", "Hamstrings", "Glutes", "Calves", "Core", "Forearms"],
};

const MAX_LIFTS: Record<Answers["minutes"], number> = { 45: 4, 60: 5, 75: 6 };

function pickSplit(a: Answers) {
  const reasons: string[] = [];
  let id: string;
  if (a.days <= 3) {
    id = "full";
    reasons.push(`With ${a.days} days, full-body workouts let you train every muscle ${a.days >= 3 ? "about 3" : "2"} times a week. Research suggests hitting each muscle at least twice a week builds more than once.`);
  } else if (a.days === 4) {
    id = "ul4";
    reasons.push("With 4 days, Upper / Lower hits every muscle twice a week with a rest day between hard sessions for the same muscles.");
  } else if (a.days === 5) {
    id = "ppl_ul";
    reasons.push("With 5 days, Push / Pull / Legs / Upper / Lower trains every muscle twice a week and spreads the work so no session runs too long.");
  } else {
    id = "ppl6";
    reasons.push("With 6 days, Push / Pull / Legs twice through hits every muscle twice a week with lots of total volume.");
  }
  if (a.experience === "new" && a.days >= 5) {
    reasons.push("You're newer to lifting, so 5–6 days is a lot to recover from. It's fine if you can, but 3–4 days builds almost as much while you learn the lifts. Drop your days anytime and the plan adjusts.");
  }
  if (a.days >= 5) reasons.push("A body-part split (chest day, back day...) trains each muscle once a week, so it wasn't picked. It can work, but twice a week tends to do better for most people.");
  if (a.goal === "strength") reasons.push("For strength, keep the big lifts first in each day and use the low end of each rep range on them.");
  if (a.goal === "fitness") reasons.push("For general fitness, it's fine to stay in the middle of each rep range and pair lifting with your walks and runs.");
  return { id, reasons };
}

function allowed(name: string, a: Answers) {
  const e = EXERCISES[name];
  return !!e && GEAR_FOR[a.equipment].includes(e.gear) && !e.stress.some((j) => a.avoid.includes(j));
}

// Best stand-in for a lift: same main muscle first, then one of its helper muscles
function substitute(name: string, a: Answers, taken: Set<string>) {
  const orig = EXERCISES[name];
  for (const muscle of [orig.muscle, ...orig.also]) {
    const hit = Object.values(EXERCISES).find((e) => e.muscle === muscle && !taken.has(e.name) && allowed(e.name, a));
    if (hit) return hit.name;
  }
  return null;
}

const JOINT_WORD: Record<Joint, string> = { knee: "knees", back: "lower back", shoulder: "shoulders" };

export function buildPlan(a: Answers): Plan {
  const { id, reasons } = pickSplit(a);
  const split = getSplit(id);
  const swaps: string[] = [];
  const days: Record<string, string[]> = {};
  const max = MAX_LIFTS[a.minutes];

  for (const dayName of Array.from(new Set(split.days))) {
    const taken = new Set<string>();
    const list: string[] = [];
    // 1. Start from the default day, swapping anything you can't or shouldn't do
    for (const name of DAYS[dayName].exercises) {
      if (allowed(name, a)) { list.push(name); taken.add(name); continue; }
      const sub = substitute(name, a, taken);
      const e = EXERCISES[name];
      const why = !GEAR_FOR[a.equipment].includes(e.gear)
        ? `it needs a ${e.gear}`
        : `it's hard on your ${e.stress.filter((j) => a.avoid.includes(j)).map((j) => JOINT_WORD[j]).join(" and ")}`;
      if (sub) { list.push(sub); taken.add(sub); swaps.push(`${dayName}: ${sub} instead of ${name}, because ${why}.`); }
      else swaps.push(`${dayName}: dropped ${name}, because ${why} and there's no good stand-in.`);
    }
    // 2. Add a lift for each focus muscle this day trains
    const extras: string[] = [];
    for (const m of a.focus) {
      if (!DAY_MUSCLES[dayName]?.includes(m)) continue;
      const add = Object.values(EXERCISES).find((e) => e.muscle === m && !taken.has(e.name) && allowed(e.name, a));
      if (add) { extras.push(add.name); taken.add(add.name); }
    }
    // 3. Fit your time: keep focus-muscle lifts, then the rest in order (big lifts come first)
    const room = Math.max(2, max - extras.length);
    const isFocus = (n: string) => a.focus.includes(EXERCISES[n].muscle);
    const keep = new Set([...list.filter(isFocus), ...list.filter((n) => !isFocus(n))].slice(0, room));
    const kept = list.filter((n) => keep.has(n));
    const cut = list.filter((n) => !keep.has(n));
    if (cut.length) swaps.push(`${dayName}: left out ${cut.join(", ")} to fit ${a.minutes} minutes.`);
    days[dayName] = [...kept, ...extras];
  }

  if (a.focus.length) reasons.push(`Extra lifts for ${a.focus.join(", ").toLowerCase()} are added to the days that train ${a.focus.length > 1 ? "them" : "it"}, so they get more weekly sets.`);
  if (a.avoid.length) reasons.push(`Lifts that load your ${a.avoid.map((j) => JOINT_WORD[j]).join(" and ")} hard were swapped out. If something hurts, stop and check with a doctor or physical therapist. This app can't tell you why.`);
  if (a.equipment !== "gym") reasons.push(a.equipment === "home"
    ? "Everything here uses just your bodyweight. Pull-ups and inverted rows need a bar or a sturdy table."
    : "Everything here uses dumbbells or your bodyweight. Pull-ups need a bar.");
  return { splitId: id, days, reasons, swaps };
}

// From your history: muscles getting far fewer sets than the rest over the last 2 weeks
export function underworked(sets: { exercise: string; created_at: string }[]) {
  const since = Date.now() - 14 * 24 * 3600 * 1000;
  const count: Record<string, number> = {};
  for (const s of sets) {
    if (new Date(s.created_at).getTime() < since) continue;
    const e = EXERCISES[s.exercise];
    if (!e) continue;
    count[e.muscle] = (count[e.muscle] ?? 0) + 1;
    for (const m of e.also) count[m] = (count[m] ?? 0) + 0.5;
  }
  const big: Muscle[] = ["Chest", "Back", "Shoulders", "Quads", "Hamstrings", "Glutes"];
  const vals = big.map((m) => count[m] ?? 0);
  const avg = vals.reduce((a, b) => a + b, 0) / big.length;
  if (avg < 4) return [];
  return big.filter((m) => (count[m] ?? 0) < avg * 0.5);
}

export const SPLIT_NAME = (id: string) => SPLITS.find((s) => s.id === id)?.name ?? id;
