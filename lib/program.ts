// Everything the app knows about lifting: the exercises, the split days, and the splits.

export type Muscle =
  | "Chest" | "Back" | "Shoulders" | "Biceps" | "Triceps"
  | "Quads" | "Hamstrings" | "Glutes" | "Calves" | "Core" | "Forearms";

export const MUSCLES: Muscle[] = ["Chest", "Back", "Shoulders", "Biceps", "Triceps", "Quads", "Hamstrings", "Glutes", "Calves", "Core", "Forearms"];

export type Gear = "barbell" | "dumbbell" | "machine" | "cable" | "bodyweight";
export type Joint = "knee" | "back" | "shoulder";

export type Exercise = {
  name: string;
  gear: Gear;           // what you need to do it
  stress: Joint[];      // joints it loads hard (used to steer around sore spots)
  muscle: Muscle;       // the main muscle (counts as a full set)
  also: Muscle[];       // helpers (count as half a set)
  sets: number;         // how many working sets
  reps: [number, number]; // rep range, e.g. 8–12
  step: number;         // how much weight to add when you beat the range (0 = bodyweight)
  rest: number;         // rest timer in seconds
};

function ex(name: string, muscle: Muscle, sets: number, lo: number, hi: number, step: number, rest: number, also: Muscle[] = []): Exercise {
  return { name, muscle, also, sets, reps: [lo, hi], step, rest, gear: "machine", stress: [] };
}

const LIST: Exercise[] = [
  // Push
  ex("Bench Press", "Chest", 4, 6, 8, 5, 150, ["Triceps", "Shoulders"]),
  ex("Overhead Press", "Shoulders", 3, 6, 10, 5, 120, ["Triceps"]),
  ex("Incline Dumbbell Press", "Chest", 3, 8, 12, 5, 90, ["Shoulders", "Triceps"]),
  ex("Lateral Raise", "Shoulders", 3, 12, 15, 2.5, 60),
  ex("Triceps Pushdown", "Triceps", 3, 10, 15, 5, 60),
  ex("Overhead Triceps Extension", "Triceps", 2, 10, 15, 5, 60),
  // Pull
  ex("Barbell Row", "Back", 4, 6, 10, 5, 120, ["Biceps", "Forearms"]),
  ex("Lat Pulldown", "Back", 3, 8, 12, 5, 90, ["Biceps"]),
  ex("Seated Cable Row", "Back", 3, 8, 12, 5, 90, ["Biceps"]),
  ex("Face Pull", "Shoulders", 3, 12, 15, 5, 60, ["Back"]),
  ex("Barbell Curl", "Biceps", 3, 8, 12, 5, 60),
  ex("Hammer Curl", "Biceps", 2, 10, 12, 5, 60, ["Forearms"]),
  // Legs
  ex("Back Squat", "Quads", 4, 5, 8, 5, 180, ["Glutes"]),
  ex("Romanian Deadlift", "Hamstrings", 3, 8, 10, 5, 120, ["Glutes", "Back"]),
  ex("Leg Press", "Quads", 3, 10, 12, 10, 120, ["Glutes"]),
  ex("Lying Leg Curl", "Hamstrings", 3, 10, 15, 5, 60),
  ex("Hip Thrust", "Glutes", 3, 8, 12, 10, 90, ["Hamstrings"]),
  ex("Standing Calf Raise", "Calves", 3, 10, 15, 5, 60),
  // Upper
  ex("Dumbbell Bench Press", "Chest", 3, 8, 12, 5, 90, ["Triceps", "Shoulders"]),
  ex("Pull-Up", "Back", 3, 6, 10, 0, 120, ["Biceps", "Forearms"]),
  ex("Seated Dumbbell Shoulder Press", "Shoulders", 3, 8, 12, 5, 90, ["Triceps"]),
  ex("Chest-Supported Row", "Back", 3, 8, 12, 5, 90, ["Biceps"]),
  ex("EZ-Bar Curl", "Biceps", 2, 10, 12, 5, 60),
  ex("Skull Crusher", "Triceps", 2, 10, 12, 5, 60),
  // Lower
  ex("Deadlift", "Hamstrings", 3, 3, 5, 10, 180, ["Glutes", "Back", "Forearms"]),
  ex("Bulgarian Split Squat", "Quads", 3, 8, 12, 5, 90, ["Glutes"]),
  ex("Leg Extension", "Quads", 3, 12, 15, 5, 60),
  ex("Seated Leg Curl", "Hamstrings", 3, 10, 15, 5, 60),
  ex("Hip Abduction", "Glutes", 3, 12, 20, 5, 60),
  ex("Hanging Leg Raise", "Core", 3, 10, 15, 0, 60),
  // Extras you can add to any day
  ex("Cable Fly", "Chest", 3, 12, 15, 5, 60),
  ex("Push-Up", "Chest", 3, 10, 20, 0, 60, ["Triceps"]),
  ex("Single-Arm Dumbbell Row", "Back", 3, 8, 12, 5, 60, ["Biceps", "Forearms"]),
  ex("Rear Delt Fly", "Shoulders", 3, 12, 15, 2.5, 60),
  ex("Dips", "Triceps", 3, 8, 12, 0, 90, ["Chest"]),
  ex("Goblet Squat", "Quads", 3, 10, 15, 5, 90, ["Glutes"]),
  ex("Walking Lunge", "Quads", 3, 10, 12, 5, 90, ["Glutes"]),
  ex("Cable Crunch", "Core", 3, 12, 15, 5, 60),
  ex("Plank (seconds)", "Core", 3, 30, 60, 0, 60),
  ex("Wrist Curl", "Forearms", 3, 12, 20, 2.5, 45),
  ex("Reverse Curl", "Forearms", 3, 10, 15, 5, 60, ["Biceps"]),
  ex("Farmer's Carry (seconds)", "Forearms", 3, 30, 60, 10, 90, ["Core"]),
  // Dumbbell and at-home options (used by the plan builder)
  ex("Dumbbell Fly", "Chest", 3, 10, 15, 5, 60),
  ex("Dumbbell Curl", "Biceps", 3, 8, 12, 5, 60),
  ex("Dumbbell Romanian Deadlift", "Hamstrings", 3, 8, 12, 5, 90, ["Glutes"]),
  ex("Step-Up", "Quads", 3, 8, 12, 5, 90, ["Glutes"]),
  ex("Glute Bridge", "Glutes", 3, 12, 20, 0, 60, ["Hamstrings"]),
  ex("Single-Leg Calf Raise", "Calves", 3, 10, 20, 0, 45),
  ex("Pike Push-Up", "Shoulders", 3, 6, 12, 0, 90, ["Triceps"]),
  ex("Inverted Row", "Back", 3, 8, 15, 0, 90, ["Biceps"]),
  ex("Wall Sit (seconds)", "Quads", 3, 30, 60, 0, 60),
  ex("Diamond Push-Up", "Triceps", 3, 8, 15, 0, 60, ["Chest"]),
  ex("Superman Hold (seconds)", "Back", 3, 20, 40, 0, 45, ["Glutes"]),
  ex("Bird Dog", "Core", 3, 8, 12, 0, 45),
  ex("Sliding Leg Curl", "Hamstrings", 3, 8, 12, 0, 60, ["Glutes"]),
];

// What each lift needs, and which joints it loads hard
const GEAR: Record<string, Gear> = {
  "Bench Press": "barbell", "Overhead Press": "barbell", "Incline Dumbbell Press": "dumbbell", "Lateral Raise": "dumbbell",
  "Triceps Pushdown": "cable", "Overhead Triceps Extension": "dumbbell", "Barbell Row": "barbell", "Lat Pulldown": "machine",
  "Seated Cable Row": "cable", "Face Pull": "cable", "Barbell Curl": "barbell", "Hammer Curl": "dumbbell",
  "Back Squat": "barbell", "Romanian Deadlift": "barbell", "Leg Press": "machine", "Lying Leg Curl": "machine",
  "Hip Thrust": "barbell", "Standing Calf Raise": "machine", "Dumbbell Bench Press": "dumbbell", "Pull-Up": "bodyweight",
  "Seated Dumbbell Shoulder Press": "dumbbell", "Chest-Supported Row": "dumbbell", "EZ-Bar Curl": "barbell", "Skull Crusher": "barbell",
  "Deadlift": "barbell", "Bulgarian Split Squat": "dumbbell", "Leg Extension": "machine", "Seated Leg Curl": "machine",
  "Hip Abduction": "machine", "Hanging Leg Raise": "bodyweight", "Cable Fly": "cable", "Push-Up": "bodyweight",
  "Single-Arm Dumbbell Row": "dumbbell", "Rear Delt Fly": "dumbbell", "Dips": "bodyweight", "Goblet Squat": "dumbbell",
  "Walking Lunge": "dumbbell", "Cable Crunch": "cable", "Plank (seconds)": "bodyweight", "Wrist Curl": "dumbbell",
  "Reverse Curl": "barbell", "Farmer's Carry (seconds)": "dumbbell", "Dumbbell Fly": "dumbbell", "Dumbbell Curl": "dumbbell",
  "Dumbbell Romanian Deadlift": "dumbbell", "Step-Up": "dumbbell", "Glute Bridge": "bodyweight", "Single-Leg Calf Raise": "bodyweight",
  "Pike Push-Up": "bodyweight", "Inverted Row": "bodyweight", "Wall Sit (seconds)": "bodyweight", "Diamond Push-Up": "bodyweight",
  "Superman Hold (seconds)": "bodyweight", "Bird Dog": "bodyweight", "Sliding Leg Curl": "bodyweight",
};
const STRESS: Record<string, Joint[]> = {
  "Back Squat": ["knee", "back"], "Deadlift": ["back"], "Romanian Deadlift": ["back"], "Barbell Row": ["back"],
  "Leg Press": ["knee"], "Bulgarian Split Squat": ["knee"], "Leg Extension": ["knee"], "Goblet Squat": ["knee"],
  "Walking Lunge": ["knee"], "Step-Up": ["knee"], "Wall Sit (seconds)": ["knee"],
  "Bench Press": ["shoulder"], "Overhead Press": ["shoulder"], "Dips": ["shoulder"], "Seated Dumbbell Shoulder Press": ["shoulder"],
  "Pike Push-Up": ["shoulder"], "Skull Crusher": ["shoulder"],
};
for (const e of LIST) { e.gear = GEAR[e.name] ?? "machine"; e.stress = STRESS[e.name] ?? []; }

export const EXERCISES: Record<string, Exercise> = Object.fromEntries(LIST.map((e) => [e.name, e]));
export const ALL_EXERCISES = LIST.map((e) => e.name);

// Each split day is a weight plate color, like bumper plates in a gym.
export type Day = { name: string; color: string; ink: string; exercises: string[] };

const RED = { color: "#D7263D", ink: "#FFFFFF" };
const BLUE = { color: "#1F5FBF", ink: "#FFFFFF" };
const YELLOW = { color: "#F2B705", ink: "#1C2230" };
const GREEN = { color: "#2E8B57", ink: "#FFFFFF" };
const BLACK = { color: "#1C2230", ink: "#FFFFFF" };
const PURPLE = { color: "#6A3FB5", ink: "#FFFFFF" };

export const DAYS: Record<string, Day> = {
  Push: { name: "Push", ...RED, exercises: ["Bench Press", "Overhead Press", "Incline Dumbbell Press", "Lateral Raise", "Triceps Pushdown", "Overhead Triceps Extension"] },
  Pull: { name: "Pull", ...BLUE, exercises: ["Barbell Row", "Lat Pulldown", "Seated Cable Row", "Face Pull", "Barbell Curl", "Hammer Curl"] },
  Legs: { name: "Legs", ...YELLOW, exercises: ["Back Squat", "Romanian Deadlift", "Leg Press", "Lying Leg Curl", "Hip Thrust", "Standing Calf Raise"] },
  Upper: { name: "Upper", ...GREEN, exercises: ["Dumbbell Bench Press", "Pull-Up", "Seated Dumbbell Shoulder Press", "Chest-Supported Row", "EZ-Bar Curl", "Skull Crusher"] },
  Lower: { name: "Lower", ...BLACK, exercises: ["Deadlift", "Bulgarian Split Squat", "Leg Extension", "Seated Leg Curl", "Hip Abduction", "Hanging Leg Raise"] },
  Chest: { name: "Chest", ...RED, exercises: ["Bench Press", "Incline Dumbbell Press", "Cable Fly", "Dips", "Push-Up"] },
  Back: { name: "Back", ...BLUE, exercises: ["Deadlift", "Pull-Up", "Barbell Row", "Lat Pulldown", "Single-Arm Dumbbell Row"] },
  Shoulders: { name: "Shoulders", ...PURPLE, exercises: ["Overhead Press", "Seated Dumbbell Shoulder Press", "Lateral Raise", "Rear Delt Fly", "Face Pull"] },
  Arms: { name: "Arms", ...GREEN, exercises: ["Barbell Curl", "Skull Crusher", "Hammer Curl", "Triceps Pushdown", "EZ-Bar Curl", "Overhead Triceps Extension", "Wrist Curl"] },
  "Full Body A": { name: "Full Body A", ...RED, exercises: ["Back Squat", "Bench Press", "Barbell Row", "Romanian Deadlift", "Lateral Raise", "Hanging Leg Raise"] },
  "Full Body B": { name: "Full Body B", ...BLUE, exercises: ["Deadlift", "Overhead Press", "Pull-Up", "Bulgarian Split Squat", "Barbell Curl", "Cable Crunch"] },
};

export type Split = { id: string; name: string; blurb: string; days: string[] };

export const SPLITS: Split[] = [
  { id: "ppl_ul", name: "Push / Pull / Legs / Upper / Lower", blurb: "5 days. Every muscle twice a week.", days: ["Push", "Pull", "Legs", "Upper", "Lower"] },
  { id: "ppl6", name: "Push / Pull / Legs, twice", blurb: "6 days. The classic high-volume split.", days: ["Push", "Pull", "Legs", "Push", "Pull", "Legs"] },
  { id: "bro5", name: "Body-part split", blurb: "5 days. One muscle group a day.", days: ["Chest", "Back", "Legs", "Shoulders", "Arms"] },
  { id: "ul4", name: "Upper / Lower", blurb: "4 days. Simple and balanced.", days: ["Upper", "Lower", "Upper", "Lower"] },
  { id: "full", name: "Full body", blurb: "2–3 days. Two workouts you alternate.", days: ["Full Body A", "Full Body B"] },
];

export function getSplit(id: string | null | undefined) {
  return SPLITS.find((s) => s.id === id) ?? SPLITS[0];
}

export function getDay(name: string) {
  return DAYS[name] ?? { name, ...BLACK, exercises: [] };
}

// The exercises for a day: yours if you've edited it, otherwise the default
export function dayList(name: string, custom?: Record<string, string[]> | null) {
  const mine = custom?.[name]?.filter((n) => EXERCISES[n]);
  return mine && mine.length ? mine : getDay(name).exercises;
}

// The day after the last one you finished, in your split's order
export function nextDay(split: Split, lastDayName: string | null) {
  if (!lastDayName) return split.days[0];
  const i = split.days.indexOf(lastDayName);
  return i < 0 ? split.days[0] : split.days[(i + 1) % split.days.length];
}
