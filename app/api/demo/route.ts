import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { DAYS, EXERCISES } from "@/lib/program";

// Makes a brand-new private demo account filled with 5 weeks of realistic training,
// so every chart and insight has something to show. Old demo accounts are deleted after a day.

// Starting weights (lb) for the demo lifter
const START: Record<string, number> = {
  "Bench Press": 95, "Overhead Press": 55, "Incline Dumbbell Press": 30, "Lateral Raise": 12.5, "Triceps Pushdown": 35,
  "Overhead Triceps Extension": 25, "Barbell Row": 85, "Lat Pulldown": 80, "Seated Cable Row": 75, "Face Pull": 30,
  "Barbell Curl": 45, "Hammer Curl": 20, "Back Squat": 115, "Romanian Deadlift": 95, "Leg Press": 180, "Lying Leg Curl": 50,
  "Hip Thrust": 135, "Standing Calf Raise": 90, "Dumbbell Bench Press": 35, "Pull-Up": 0, "Seated Dumbbell Shoulder Press": 25,
  "Chest-Supported Row": 30, "EZ-Bar Curl": 40, "Skull Crusher": 40, "Deadlift": 155, "Bulgarian Split Squat": 20,
  "Leg Extension": 60, "Seated Leg Curl": 55, "Hip Abduction": 80, "Hanging Leg Raise": 0,
};

// Simple repeatable random numbers so every demo looks the same
function rng(seed: number) {
  return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
}

export async function POST() {
  const secret = process.env.SUPABASE_SECRET_KEY ?? "";
  if (!secret.startsWith("sb_secret_")) {
    return NextResponse.json({ error: "Demo isn't set up on the server yet" }, { status: 500 });
  }
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Clean up demo accounts older than a day (their workouts and sets delete with them)
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 200 });
  const dayAgo = Date.now() - 24 * 3600 * 1000;
  for (const u of list?.users ?? []) {
    if (u.user_metadata?.demo && new Date(u.created_at).getTime() < dayAgo) await admin.auth.admin.deleteUser(u.id);
  }

  const tag = randomUUID().slice(0, 8);
  const password = randomUUID() + "Aa1!";
  const { data: made, error } = await admin.auth.admin.createUser({
    email: `demo-${tag}@example.com`, password, email_confirm: true, user_metadata: { demo: true },
  });
  if (error || !made.user) return NextResponse.json({ error: error?.message ?? "Couldn't make the demo" }, { status: 500 });
  const uid = made.user.id;

  await admin.from("settings").insert({ user_id: uid, split: "ppl_ul", lift_goal: 5, cardio_goal: 3, unit: "lb", bodyweight: 150,
    plan_answers: { days: 5, goal: "muscle", experience: "some", equipment: "gym", minutes: 60, focus: [], avoid: [] },
  });

  // 5 weeks of Push / Pull / Legs / Upper / Lower, Monday to Friday, ending yesterday
  const rand = rng(42);
  const order = ["Push", "Pull", "Legs", "Upper", "Lower"];
  const today = new Date(); today.setHours(18, 0, 0, 0);
  const sessions: { day: string; at: Date }[] = [];
  for (let back = 35; back >= 1; back--) {
    const d = new Date(today); d.setDate(d.getDate() - back);
    const dow = d.getDay();
    if (dow === 0 || dow === 6) continue;          // weekends off
    if (back > 7 && rand() < 0.08) continue;       // the odd missed day, like real life
    sessions.push({ day: order[sessions.length % 5], at: d });
  }

  const weekIndex = (d: Date) => Math.floor((today.getTime() - d.getTime()) / (7 * 24 * 3600 * 1000));
  for (const s of sessions) {
    const sleep = [5, 6, 7, 7, 8, 8, 9][Math.floor(rand() * 7)];
    const energy = Math.max(1, Math.min(5, Math.round(sleep - 3 + (rand() - 0.5) * 2)));
    const finished = new Date(s.at.getTime() + 65 * 60 * 1000);
    const { data: w } = await admin.from("workouts").insert({
      user_id: uid, day_name: s.day, started_at: s.at.toISOString(), finished_at: finished.toISOString(), sleep_hours: sleep, energy,
    }).select("id").single();
    if (!w) continue;

    const weeksIn = Math.max(0, 4 - weekIndex(s.at)); // 0 at the start, about 4 by now
    const rows = DAYS[s.day].exercises.flatMap((name, i) => {
      const ex = EXERCISES[name];
      // Most lifts climb about one step every week. Bench Press stalls for the last 3 weeks (so the plateau detector has something to find).
      const climb = name === "Bench Press" ? Math.min(weeksIn, 1) : weeksIn;
      const weight = (START[name] ?? 20) + (ex.step || 0) * climb;
      const sleepHit = sleep < 7 ? -1 : 0;         // a little weaker on short sleep
      const stalled = name === "Bench Press" && weeksIn >= 1;
      return Array.from({ length: ex.sets }, (_, k) => ({
        workout_id: w.id, user_id: uid, exercise: name, set_no: k + 1, weight,
        reps: stalled ? Math.max(6, 8 - k) : Math.max(ex.reps[0] - 1, ex.reps[1] - k - (rand() < 0.4 ? 1 : 0) + sleepHit),
        created_at: new Date(s.at.getTime() + (i * 8 + k * 2) * 60 * 1000).toISOString(),
      }));
    });
    await admin.from("sets").insert(rows);
  }

  // Walks and runs: 2-3 a week for 5 weeks, slowly getting longer
  const cardioRows: { user_id: string; kind: string; minutes: number; miles: number; done_at: string }[] = [];
  for (let back = 34; back >= 1; back--) {
    const d = new Date(today); d.setDate(d.getDate() - back); d.setHours(8, 0, 0, 0);
    const dow = d.getDay();
    if (![0, 2, 4, 6].includes(dow) || rand() < 0.3) continue;
    const run = dow === 6;
    const minutes = Math.round((run ? 22 : 30) + (34 - back) * 0.3 + rand() * 8);
    cardioRows.push({ user_id: uid, kind: run ? "run" : "walk", minutes, miles: Number((minutes / (run ? 10 : 19)).toFixed(1)), done_at: d.toISOString() });
  }
  await admin.from("cardio").insert(cardioRows);

  return NextResponse.json({ email: made.user.email, password });
}
