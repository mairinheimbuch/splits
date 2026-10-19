"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase, getSettings, type Settings } from "@/lib/supabase";
import { useUser } from "@/lib/useUser";
import { getSplit, getDay, nextDay, dayList, EXERCISES } from "@/lib/program";
import { weekStart } from "@/lib/stats";
import { weekStreak } from "@/lib/insights";
import Plate from "@/components/Plate";
import Login from "@/components/Login";

type Workout = { id: string; day_name: string; started_at: string; finished_at: string | null };
type Cardio = { id: string; kind: "walk" | "run"; minutes: number; miles: number | null; done_at: string };

export default function Today() {
  const { user, loading } = useUser();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [week, setWeek] = useState<Workout[]>([]);
  const [last, setLast] = useState<Workout | null>(null);
  const [open, setOpen] = useState<Workout | null>(null);
  const [cardio, setCardio] = useState<Cardio[]>([]);
  const [pick, setPick] = useState<string | null>(null);
  const [logging, setLogging] = useState(false);
  const [kind, setKind] = useState<"walk" | "run">("walk");
  const [minutes, setMinutes] = useState("30");
  const [miles, setMiles] = useState("");
  const [saved, setSaved] = useState("");
  const [streak, setStreak] = useState(0);

  async function load(uid: string) {
    const st = await getSettings(uid);
    setSettings(st);
    const { data: all } = await supabase.from("workouts").select("started_at").not("finished_at", "is", null)
      .order("started_at", { ascending: false }).limit(800);
    setStreak(weekStreak(all ?? [], st.lift_goal));
    const since = weekStart().toISOString();
    const { data: w } = await supabase.from("workouts").select("*").gte("started_at", since).order("started_at");
    setWeek(((w ?? []) as Workout[]).filter((x) => x.finished_at));
    const { data: l } = await supabase.from("workouts").select("*").not("finished_at", "is", null)
      .order("finished_at", { ascending: false }).limit(1);
    setLast((l?.[0] as Workout) ?? null);
    const twelveHours = new Date(Date.now() - 12 * 3600 * 1000).toISOString();
    const { data: o } = await supabase.from("workouts").select("*").is("finished_at", null)
      .gte("started_at", twelveHours).order("started_at", { ascending: false }).limit(1);
    setOpen((o?.[0] as Workout) ?? null);
    const { data: c } = await supabase.from("cardio").select("*").gte("done_at", since).order("done_at");
    setCardio((c ?? []) as Cardio[]);
  }

  useEffect(() => { if (user) load(user.id); }, [user]);

  async function saveCardio() {
    const m = parseInt(minutes, 10);
    if (!m) return setSaved("Add how many minutes.");
    const { error } = await supabase.from("cardio").insert({ kind, minutes: m, miles: miles ? Number(miles) : null });
    if (error) return setSaved("Couldn't save: " + error.message);
    setLogging(false);
    setMiles("");
    setSaved(`${kind === "run" ? "Run" : "Walk"} saved.`);
    if (user) load(user.id);
  }

  if (loading) return null;
  if (!user) return <Login />;
  if (!settings) return <p className="p-6 text-steel">Loading your split...</p>;

  const split = getSplit(settings.split);
  const suggested = nextDay(split, last?.day_name ?? null);
  const dayName = pick ?? suggested;
  const day = getDay(dayName);
  const lifts = dayList(dayName, settings.custom_days);
  const otherDays = Array.from(new Set(split.days)).filter((d) => d !== dayName);
  const doneToday = week.some((w) => new Date(w.finished_at!).toDateString() === new Date().toDateString());
  const today = new Date().toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
  const cardioMin = cardio.reduce((n, c) => n + c.minutes, 0);
  const cardioMiles = cardio.reduce((n, c) => n + (Number(c.miles) || 0), 0);

  return (
    <main className="flex flex-col">
      {/* Today's day, in its plate color */}
      <section className="px-6 pt-10 pb-8 overflow-hidden" style={{ background: day.color, color: day.ink }}>
        <p className="text-base font-semibold opacity-80">{today}</p>
        <div className="mt-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-lg font-semibold opacity-90">
              {doneToday ? "Already lifted today. Next up:" : pick ? "You picked" : "Today is"}
            </p>
            <h1 className="font-cond text-[5.5rem] leading-[0.85] font-extrabold tracking-tight break-words">{day.name}</h1>
          </div>
          <div className="shrink-0 -mr-10 opacity-95">
            <Plate color={day.ink === "#FFFFFF" ? "rgba(255,255,255,0.16)" : "rgba(28,34,48,0.12)"} ink={day.ink} size={150} />
          </div>
        </div>

        {open ? (
          <Link href={`/workout?day=${encodeURIComponent(open.day_name)}`}
            className="mt-8 block rounded-2xl bg-white text-ink text-center py-4 text-xl font-bold">
            Keep going with {open.day_name}
          </Link>
        ) : (
          <Link href={`/workout?day=${encodeURIComponent(day.name)}`}
            className="mt-8 block rounded-2xl bg-white text-ink text-center py-4 text-xl font-bold">
            Start {day.name}
          </Link>
        )}
      </section>

      <div className="px-6 flex flex-col gap-8 pt-6">
        {/* What's in it */}
        <section className="flex flex-col">
          <div className="flex items-baseline justify-between">
            <h2 className="font-cond text-2xl font-bold">{lifts.length} lifts</h2>
            <Link href="/settings#days" className="text-sm font-semibold text-steel underline">Edit</Link>
          </div>
          <ul className="mt-2 divide-y divide-line border-y border-line">
            {lifts.map((name) => {
              const ex = EXERCISES[name];
              return (
                <li key={name} className="flex justify-between gap-3 py-3">
                  <span className="font-semibold">{name}</span>
                  <span className="text-steel tabular whitespace-nowrap">{ex.sets} × {ex.reps[0]}–{ex.reps[1]}</span>
                </li>
              );
            })}
          </ul>
          {otherDays.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-sm text-steel">Different day?</span>
              {otherDays.map((d) => {
                const dd = getDay(d);
                return (
                  <button key={d} type="button" onClick={() => setPick(d === suggested ? null : d)}
                    className="flex items-center gap-1.5 rounded-full border border-line bg-white pl-1 pr-3 py-1 text-sm font-semibold">
                    <Plate color={dd.color} ink={dd.ink} size={20} />{d}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* This week, as plates loaded on a bar */}
        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h2 className="font-cond text-2xl font-bold">This week</h2>
            <p className="text-steel tabular">{week.length} of {settings.lift_goal} lifts</p>
          </div>
          <div className="flex items-center gap-2">
            {Array.from({ length: Math.max(settings.lift_goal, week.length) }).map((_, i) => {
              const w = week[i];
              const d = w ? getDay(w.day_name) : null;
              return (
                <div key={i} className="flex flex-col items-center gap-1">
                  <Plate color={d?.color ?? "#000"} ink={d?.ink} filled={!!d} size={44}
                    label={d ? `${d.name}, ${new Date(w!.finished_at!).toLocaleDateString([], { weekday: "long" })}` : undefined} />
                  <span className="text-xs text-steel h-4">{w ? new Date(w.finished_at!).toLocaleDateString([], { weekday: "short" }) : ""}</span>
                </div>
              );
            })}
          </div>
          {week.length >= settings.lift_goal && (
            <p className="font-semibold text-good">Weekly goal hit. Anything else is a bonus.</p>
          )}
          <p className="text-steel">
            {streak > 0
              ? <><strong className="font-cond text-2xl text-ink tabular">{streak}</strong> {streak === 1 ? "week" : "weeks"} in a row at {settings.lift_goal}+ lifts.{week.length < settings.lift_goal ? ` ${settings.lift_goal - week.length} more this week keeps it going.` : ""}</>
              : `Hit ${settings.lift_goal} lifts this week to start a streak.`}
          </p>
        </section>

        {/* Cardio */}
        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h2 className="font-cond text-2xl font-bold">Walks and runs</h2>
            <p className="text-steel tabular">{cardio.length} of {settings.cardio_goal}</p>
          </div>
          <p className="text-steel">
            {cardio.length ? `${cardioMin} minutes${cardioMiles ? `, ${cardioMiles.toFixed(1)} miles` : ""} this week.` : "Nothing logged yet this week."}
          </p>
          {logging ? (
            <div className="rounded-2xl bg-white border border-line p-4 flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-2" role="group" aria-label="Walk or run">
                {(["walk", "run"] as const).map((k) => (
                  <button key={k} type="button" onClick={() => setKind(k)} aria-pressed={kind === k}
                    className={"rounded-xl py-3 font-bold border-2 " + (kind === k ? "bg-ink text-white border-ink" : "border-line")}>
                    {k === "walk" ? "Walk" : "Run"}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1 text-sm font-semibold">Minutes
                  <input type="number" inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)}
                    className="rounded-xl border border-line px-3 py-3 text-xl font-bold tabular" />
                </label>
                <label className="flex flex-col gap-1 text-sm font-semibold">Miles (optional)
                  <input type="number" inputMode="decimal" step="0.1" value={miles} onChange={(e) => setMiles(e.target.value)}
                    className="rounded-xl border border-line px-3 py-3 text-xl font-bold tabular" />
                </label>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={saveCardio} className="flex-1 rounded-xl bg-ink text-white py-3 font-bold">Save {kind}</button>
                <button type="button" onClick={() => setLogging(false)} className="rounded-xl border border-line px-4 font-semibold">Cancel</button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => { setLogging(true); setSaved(""); }}
              className="rounded-2xl border-2 border-ink py-3 text-lg font-bold">Log a walk or run</button>
          )}
          {saved && <p className="text-sm font-semibold">{saved}</p>}
        </section>
      </div>
    </main>
  );
}
