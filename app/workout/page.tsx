"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { supabase, getSettings } from "@/lib/supabase";
import { useUser } from "@/lib/useUser";
import { getDay, dayList, EXERCISES, ALL_EXERCISES, type Exercise } from "@/lib/program";
import { e1rm, suggest, fmt, shortDate, type SetRow } from "@/lib/stats";
import Login from "@/components/Login";

type Row = { weight: string; reps: string; id?: string };
type Past = { sets: { weight: number; reps: number }[]; date: string | null; best: number };
type Summary = { sets: number; volume: number; minutes: number; prs: { name: string; weight: number; reps: number }[] };

export default function Workout() {
  const { user, loading } = useUser();
  const [dayName, setDayName] = useState("");
  const [unit, setUnit] = useState("lb");
  const [workoutId, setWorkoutId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [list, setList] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, Row[]>>({});
  const [past, setPast] = useState<Record<string, Past>>({});
  const [ready, setReady] = useState(false);
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState("");
  const [summary, setSummary] = useState<Summary | null>(null);
  // Quick check-in before the first set
  const [sleep, setSleep] = useState<number | null>(null);
  const [energy, setEnergy] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  // Rest timer
  const [restEnd, setRestEnd] = useState<number | null>(null);
  const [now, setNow] = useState(0); // set when a rest starts
  const buzzed = useRef(false);

  useEffect(() => {
    setDayName(new URLSearchParams(window.location.search).get("day") ?? "Push");
  }, []);

  // What you did last time for each lift, and your best ever
  async function history(names: string[], skipWorkout: string | null) {
    const { data } = await supabase.from("sets").select("*").in("exercise", names)
      .order("created_at", { ascending: false }).limit(2000);
    const all = ((data ?? []) as SetRow[]).filter((s) => s.workout_id !== skipWorkout);
    const out: Record<string, Past> = {};
    for (const name of names) {
      const mine = all.filter((s) => s.exercise === name);
      const lastId = mine[0]?.workout_id;
      const lastSets = mine.filter((s) => s.workout_id === lastId).sort((a, b) => a.set_no - b.set_no);
      out[name] = {
        sets: lastSets.map((s) => ({ weight: Number(s.weight), reps: s.reps })),
        date: lastSets[0]?.created_at ?? null,
        best: Math.max(0, ...mine.map((s) => e1rm(Number(s.weight), s.reps))),
      };
    }
    return out;
  }

  function startingRows(ex: Exercise, p: Past | undefined, done: SetRow[] = []): Row[] {
    const s = suggest(ex, p?.sets ?? []);
    const rowsDone: Row[] = done.sort((a, b) => a.set_no - b.set_no)
      .map((d) => ({ weight: fmt(Number(d.weight)), reps: String(d.reps), id: d.id }));
    const blank = Math.max(0, ex.sets - rowsDone.length);
    return [...rowsDone, ...Array.from({ length: blank }, () => ({ weight: s.weight ? fmt(s.weight) : "", reps: String(s.reps) }))];
  }

  useEffect(() => {
    if (!user || !dayName) return;
    (async () => {
      const st = await getSettings(user.id);
      setUnit(st.unit);
      const exercises = dayList(dayName, st.custom_days);
      // Pick up where you left off if you started this day in the last 12 hours
      const since = new Date(Date.now() - 12 * 3600 * 1000).toISOString();
      const { data: open } = await supabase.from("workouts").select("*").eq("day_name", dayName)
        .is("finished_at", null).gte("started_at", since).order("started_at", { ascending: false }).limit(1);
      const openId: string | null = open?.[0]?.id ?? null;
      let doneSets: SetRow[] = [];
      if (openId) {
        setWorkoutId(openId);
        setStartedAt(open![0].started_at);
        const { data } = await supabase.from("sets").select("*").eq("workout_id", openId);
        doneSets = (data ?? []) as SetRow[];
      }
      const names = Array.from(new Set([...exercises, ...doneSets.map((s) => s.exercise)])).filter((n) => EXERCISES[n]);
      const p = await history(names, openId);
      setPast(p);
      setList(names);
      setRows(Object.fromEntries(names.map((n) => [n, startingRows(EXERCISES[n], p[n], doneSets.filter((s) => s.exercise === n))])));
      setReady(true);
    })();
  }, [user, dayName]);

  // Tick the rest timer
  useEffect(() => {
    if (!restEnd) return;
    buzzed.current = false;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [restEnd]);
  const restLeft = restEnd ? Math.max(0, Math.ceil((restEnd - now) / 1000)) : 0;
  useEffect(() => {
    if (restEnd && restLeft === 0 && !buzzed.current) {
      buzzed.current = true;
      if ("vibrate" in navigator) navigator.vibrate([200, 100, 200]);
    }
  }, [restLeft, restEnd]);

  function update(name: string, i: number, key: "weight" | "reps", value: string) {
    setRows((r) => ({ ...r, [name]: r[name].map((row, j) => (j === i ? { ...row, [key]: value } : row)) }));
  }

  function bump(name: string, i: number, key: "weight" | "reps", dir: 1 | -1) {
    const ex = EXERCISES[name];
    const step = key === "reps" ? 1 : ex.step || 5;
    const cur = Number(rows[name][i][key]) || 0;
    update(name, i, key, fmt(Math.max(0, cur + dir * step)));
  }

  async function ensureWorkout() {
    if (workoutId) return workoutId;
    const { data, error } = await supabase.from("workouts")
      .insert({ day_name: dayName, sleep_hours: sleep, energy }).select("id, started_at").single();
    if (error || !data) { setMsg("Couldn't start the workout: " + (error?.message ?? "unknown error")); return null; }
    setWorkoutId(data.id);
    setStartedAt(data.started_at);
    return data.id as string;
  }

  async function toggle(name: string, i: number) {
    setMsg("");
    const row = rows[name][i];
    if (row.id) {
      // Untick to fix a typo
      await supabase.from("sets").delete().eq("id", row.id);
      setRows((r) => ({ ...r, [name]: r[name].map((x, j) => (j === i ? { ...x, id: undefined } : x)) }));
      return;
    }
    const reps = parseInt(row.reps, 10);
    const weight = Number(row.weight) || 0;
    if (!reps) return setMsg(`Add your reps for ${name}, set ${i + 1}.`);
    const wid = await ensureWorkout();
    if (!wid) return;
    const { data, error } = await supabase.from("sets")
      .insert({ workout_id: wid, exercise: name, set_no: i + 1, weight, reps }).select("id").single();
    if (error || !data) return setMsg("Couldn't save that set: " + (error?.message ?? "unknown error"));
    setRows((r) => {
      const next = r[name].map((x, j) => (j === i ? { ...x, id: data.id } : x));
      // Carry this set's numbers into the next empty set
      if (next[i + 1] && !next[i + 1].id) next[i + 1] = { ...next[i + 1], weight: row.weight };
      return { ...r, [name]: next };
    });
    setNow(Date.now());
    setRestEnd(Date.now() + EXERCISES[name].rest * 1000);
  }

  function addSet(name: string) {
    setRows((r) => {
      const prev = r[name][r[name].length - 1];
      return { ...r, [name]: [...r[name], { weight: prev?.weight ?? "", reps: prev?.reps ?? "" }] };
    });
  }

  async function addExercise(name: string) {
    setAdding(false);
    if (list.includes(name)) return;
    const p = await history([name], workoutId);
    setPast((x) => ({ ...x, ...p }));
    setList((l) => [...l, name]);
    setRows((r) => ({ ...r, [name]: startingRows(EXERCISES[name], p[name]) }));
  }

  async function finish() {
    const logged = list.flatMap((n) => rows[n].filter((r) => r.id).map((r) => ({ name: n, weight: Number(r.weight) || 0, reps: Number(r.reps) })));
    if (!workoutId || !logged.length) return setMsg("Tick off at least one set before finishing.");
    const { error } = await supabase.from("workouts").update({ finished_at: new Date().toISOString() }).eq("id", workoutId);
    if (error) return setMsg("Couldn't finish: " + error.message);
    const prs = list.flatMap((n) => {
      const mine = logged.filter((s) => s.name === n);
      if (!mine.length || !past[n]?.best) return [];
      const top = mine.reduce((a, b) => (e1rm(b.weight, b.reps) > e1rm(a.weight, a.reps) ? b : a));
      return e1rm(top.weight, top.reps) > past[n].best ? [{ name: n, weight: top.weight, reps: top.reps }] : [];
    });
    setRestEnd(null);
    setSummary({
      sets: logged.length,
      volume: Math.round(logged.reduce((v, s) => v + s.weight * s.reps, 0)),
      minutes: startedAt ? Math.max(1, Math.round((Date.now() - new Date(startedAt).getTime()) / 60000)) : 0,
      prs,
    });
    window.scrollTo({ top: 0 });
  }

  async function discard() {
    if (workoutId && !confirm("Delete this workout and every set in it?")) return;
    if (workoutId) await supabase.from("workouts").delete().eq("id", workoutId);
    window.location.href = "/";
  }

  if (loading) return null;
  if (!user) return <Login />;
  const day = getDay(dayName || "Push");
  if (!ready) return <p className="p-6 text-steel">Loading {dayName}...</p>;

  const total = list.reduce((n, name) => n + rows[name].length, 0);
  const done = list.reduce((n, name) => n + rows[name].filter((r) => r.id).length, 0);

  if (summary) {
    return (
      <main className="min-h-screen" style={{ background: day.color, color: day.ink }}>
        <div className="px-6 pt-16 pb-10 flex flex-col gap-8">
          <h1 className="font-cond text-7xl font-extrabold leading-[0.9]">{day.name}<br />done.</h1>
          <dl className="grid grid-cols-3 gap-3">
            {[
              ["Sets", String(summary.sets)],
              ["Minutes", String(summary.minutes)],
              [`Volume (${unit})`, summary.volume.toLocaleString()],
            ].map(([k, v]) => (
              <div key={k} className="flex flex-col-reverse">
                <dt className="text-sm font-semibold opacity-80">{k}</dt>
                <dd className="font-cond text-4xl font-bold tabular">{v}</dd>
              </div>
            ))}
          </dl>
          {summary.prs.length > 0 && (
            <section className="rounded-2xl bg-white text-ink p-4 flex flex-col gap-2">
              <h2 className="font-cond text-2xl font-bold">New personal best{summary.prs.length > 1 ? "s" : ""}</h2>
              {summary.prs.map((p) => (
                <p key={p.name} className="flex justify-between gap-3">
                  <span className="font-semibold">{p.name}</span>
                  <span className="tabular">{fmt(p.weight)} × {p.reps}</span>
                </p>
              ))}
            </section>
          )}
          <Link href="/" className="rounded-2xl bg-white text-ink text-center py-4 text-xl font-bold">Back to today</Link>
        </div>
      </main>
    );
  }

  const unused = ALL_EXERCISES.filter((n) => !list.includes(n));
  const stepBtn = "w-9 shrink-0 text-xl font-bold text-steel disabled:opacity-30";

  return (
    <main className="pb-32">
      <header className="sticky top-0 z-30 px-4 py-3 flex items-center justify-between gap-3" style={{ background: day.color, color: day.ink }}>
        <Link href="/" className="font-semibold">Back</Link>
        <h1 className="font-cond text-3xl font-extrabold">{day.name}</h1>
        <span className="tabular font-semibold">{done}/{total} sets</span>
      </header>
      <div className="h-1.5 bg-line" aria-hidden="true">
        <div className="h-1.5 transition-all" style={{ width: `${total ? (done / total) * 100 : 0}%`, background: day.color }} />
      </div>

      <div className="px-4 pt-4 flex flex-col gap-5">
        {!workoutId && !checked && (
          <section className="rounded-2xl bg-white border-2 p-4 flex flex-col gap-4" style={{ borderColor: day.color }}>
            <div>
              <h2 className="font-cond text-2xl font-bold">Quick check-in</h2>
              <p className="text-sm text-steel">Two taps. After a few weeks, Progress shows how sleep and energy change your lifts.</p>
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-sm font-semibold">Sleep last night</p>
              <div className="grid grid-cols-5 gap-2" role="group" aria-label="Hours of sleep">
                {[5, 6, 7, 8, 9].map((h) => (
                  <button key={h} type="button" onClick={() => setSleep(h)} aria-pressed={sleep === h}
                    className={"rounded-xl py-2 font-bold border-2 tabular " + (sleep === h ? "bg-ink text-white border-ink" : "border-line")}>
                    {h === 5 ? "≤5h" : h === 9 ? "9h+" : `${h}h`}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-sm font-semibold">Energy right now</p>
              <div className="grid grid-cols-5 gap-2" role="group" aria-label="Energy from 1 to 5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" onClick={() => setEnergy(n)} aria-pressed={energy === n}
                    className={"rounded-xl py-2 font-bold border-2 tabular " + (energy === n ? "bg-ink text-white border-ink" : "border-line")}>
                    {n}
                  </button>
                ))}
              </div>
              <div className="flex justify-between text-xs text-steel"><span>Drained</span><span>Ready to go</span></div>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setChecked(true)} disabled={sleep === null || energy === null}
                className="flex-1 rounded-xl py-3 font-bold disabled:opacity-40" style={{ background: day.color, color: day.ink }}>
                Save check-in
              </button>
              <button type="button" onClick={() => { setSleep(null); setEnergy(null); setChecked(true); }}
                className="rounded-xl border border-line px-4 font-semibold">Skip</button>
            </div>
          </section>
        )}
        {list.map((name) => {
          const ex = EXERCISES[name];
          const p = past[name];
          const tip = suggest(ex, p?.sets ?? []);
          return (
            <section key={name} className="rounded-2xl bg-white border border-line overflow-hidden">
              <div className="p-4 flex flex-col gap-1">
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="font-cond text-2xl font-bold leading-tight">{name}</h2>
                  <span className="text-steel tabular whitespace-nowrap">{ex.sets} × {ex.reps[0]}–{ex.reps[1]}</span>
                </div>
                {p?.sets.length ? (
                  <p className="text-sm text-steel tabular">
                    Last time ({shortDate(p.date!)}): {p.sets.map((s) => `${fmt(s.weight)}×${s.reps}`).join(", ")}
                  </p>
                ) : null}
                <div className="mt-1 text-sm rounded-lg px-3 py-2" style={{ background: `${day.color}1A` }}>
                  <p className="font-semibold">{tip.note}</p>
                  <details className="mt-1">
                    <summary className="cursor-pointer font-semibold underline">Why?</summary>
                    <p className="mt-1">{tip.why}</p>
                  </details>
                </div>
              </div>

              <div className="px-2 pb-2">
                <div className="grid grid-cols-[1.75rem_minmax(0,1fr)_minmax(0,1fr)_3rem] gap-2 px-2 text-xs font-semibold text-steel">
                  <span>Set</span><span className="text-center">{ex.step ? unit : `+${unit}`}</span><span className="text-center">Reps</span><span />
                </div>
                {rows[name].map((row, i) => {
                  const ok = !!row.id;
                  return (
                    <div key={i} className={"grid grid-cols-[1.75rem_minmax(0,1fr)_minmax(0,1fr)_3rem] gap-2 items-center px-2 py-1.5 rounded-xl " + (ok ? "bg-[#2E8B57]/10" : "")}>
                      <span className="font-cond text-xl font-bold text-steel tabular">{i + 1}</span>
                      {(["weight", "reps"] as const).map((k) => (
                        <div key={k} className="min-w-0 flex items-center rounded-xl border border-line bg-panel h-12">
                          <button type="button" className={stepBtn} disabled={ok} onClick={() => bump(name, i, k, -1)}
                            aria-label={`Less ${k}`}>−</button>
                          <input type="number" inputMode={k === "weight" ? "decimal" : "numeric"} value={row[k]} disabled={ok}
                            onChange={(e) => update(name, i, k, e.target.value)} aria-label={`${name} set ${i + 1} ${k}`}
                            placeholder={k === "weight" ? "0" : ""}
                            className="w-full min-w-0 flex-1 bg-transparent text-center font-cond text-2xl font-bold tabular outline-none" />
                          <button type="button" className={stepBtn} disabled={ok} onClick={() => bump(name, i, k, 1)}
                            aria-label={`More ${k}`}>+</button>
                        </div>
                      ))}
                      <button type="button" onClick={() => toggle(name, i)} aria-pressed={ok}
                        aria-label={ok ? `Undo set ${i + 1}` : `Done with set ${i + 1}`}
                        className={"h-12 rounded-xl text-2xl font-bold border-2 " + (ok ? "bg-good border-good text-white" : "border-line text-steel")}>
                        ✓
                      </button>
                    </div>
                  );
                })}
                <button type="button" onClick={() => addSet(name)} className="w-full py-2 text-sm font-semibold text-steel">+ Add a set</button>
              </div>
            </section>
          );
        })}

        {adding ? (
          <div className="rounded-2xl bg-white border border-line p-3 flex flex-col gap-1 max-h-80 overflow-y-auto">
            {unused.map((n) => (
              <button key={n} type="button" onClick={() => addExercise(n)} className="text-left px-3 py-2 rounded-lg hover:bg-panel">
                <span className="font-semibold">{n}</span> <span className="text-sm text-steel">{EXERCISES[n].muscle}</span>
              </button>
            ))}
          </div>
        ) : (
          <button type="button" onClick={() => setAdding(true)} className="rounded-2xl border-2 border-dashed border-line py-3 font-bold text-steel">
            + Add an exercise
          </button>
        )}
        <button type="button" onClick={discard} className="py-2 text-sm font-semibold text-steel">Cancel this workout</button>
      </div>

      {/* Bottom bar: rest timer while resting, finish button otherwise */}
      <div className="fixed bottom-0 inset-x-0 z-40 bg-panel/95 backdrop-blur border-t border-line pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto max-w-md px-4 py-3 flex flex-col gap-2">
          {msg && <p role="alert" className="text-sm font-semibold text-[#B3132B]">{msg}</p>}
          {restEnd && restLeft > 0 ? (
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <p className="text-sm font-semibold text-steel">Rest</p>
                <p className="font-cond text-4xl font-extrabold tabular leading-none">
                  {Math.floor(restLeft / 60)}:{String(restLeft % 60).padStart(2, "0")}
                </p>
              </div>
              <button type="button" onClick={() => setRestEnd((e) => (e ?? Date.now()) + 30000)} className="rounded-xl border border-line px-4 py-3 font-bold">+30s</button>
              <button type="button" onClick={() => setRestEnd(null)} className="rounded-xl bg-ink text-white px-4 py-3 font-bold">Skip</button>
            </div>
          ) : (
            <>
              {restEnd && <p className="font-bold text-good" aria-live="polite">Rest&apos;s up. Next set.</p>}
              <button type="button" onClick={finish} className="rounded-xl py-4 text-xl font-bold"
                style={{ background: day.color, color: day.ink }}>
                Finish {day.name}
              </button>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
