"use client";

import { useEffect, useState } from "react";
import { supabase, getSettings, type Settings } from "@/lib/supabase";
import { useUser } from "@/lib/useUser";
import { SPLITS, getDay, getSplit, dayList, ALL_EXERCISES, EXERCISES } from "@/lib/program";
import Login from "@/components/Login";
import Plate from "@/components/Plate";

export default function MySplit() {
  const { user, loading } = useUser();
  const [s, setS] = useState<Settings | null>(null);
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState("");

  useEffect(() => { if (user) getSettings(user.id).then(setS); }, [user]);

  // Save your own exercise list for one day (or reset it to the default)
  async function saveDay(dayName: string, list: string[] | null) {
    if (!s) return;
    const custom = { ...(s.custom_days ?? {}) };
    if (list) custom[dayName] = list; else delete custom[dayName];
    setS({ ...s, custom_days: custom });
    const { error } = await supabase.from("settings").update({ custom_days: custom }).eq("user_id", s.user_id);
    setStatus(error ? "Couldn't save: " + error.message : `${dayName} saved`);
  }

  function move(list: string[], i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= list.length) return list;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  }

  async function save(next: Settings) {
    setS(next);
    const { error } = await supabase.from("settings").update({
      split: next.split, lift_goal: next.lift_goal, cardio_goal: next.cardio_goal,
    }).eq("user_id", next.user_id);
    setStatus(error ? "Couldn't save: " + error.message : "Saved");
  }

  if (loading) return null;
  if (!user) return <Login />;
  if (!s) return <p className="p-6 text-steel">Loading...</p>;

  function stepper(label: string, key: "lift_goal" | "cardio_goal", min: number, max: number) {
    const v = s![key];
    return (
      <div className="flex items-center justify-between gap-3 py-3">
        <span className="font-semibold">{label}</span>
        <div className="flex items-center gap-3">
          <button type="button" aria-label={`Fewer ${label.toLowerCase()}`} disabled={v <= min}
            onClick={() => save({ ...s!, [key]: v - 1 })} className="w-11 h-11 rounded-xl border border-line bg-white text-xl font-bold disabled:opacity-30">−</button>
          <span className="font-cond text-3xl font-bold tabular w-6 text-center">{v}</span>
          <button type="button" aria-label={`More ${label.toLowerCase()}`} disabled={v >= max}
            onClick={() => save({ ...s!, [key]: v + 1 })} className="w-11 h-11 rounded-xl border border-line bg-white text-xl font-bold disabled:opacity-30">+</button>
        </div>
      </div>
    );
  }

  return (
    <main className="px-5 pt-10 flex flex-col gap-8">
      <h1 className="font-cond text-5xl font-extrabold">My split</h1>

      <section className="flex flex-col gap-3" role="radiogroup" aria-label="Your split">
        {SPLITS.map((sp) => {
          const on = sp.id === s.split;
          return (
            <button key={sp.id} type="button" role="radio" aria-checked={on}
              onClick={() => save({ ...s, split: sp.id, lift_goal: sp.days.length >= 4 ? sp.days.length : 3 })}
              className={"text-left rounded-2xl bg-white p-4 flex flex-col gap-3 border-2 " + (on ? "border-ink" : "border-transparent")}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-cond text-2xl font-bold leading-tight">{sp.name}</p>
                  <p className="text-steel">{sp.blurb}</p>
                </div>
                <span className={"mt-1 w-6 h-6 shrink-0 rounded-full border-2 " + (on ? "border-ink bg-ink shadow-[inset_0_0_0_4px_white]" : "border-line")} aria-hidden="true" />
              </div>
              <div className="flex gap-1.5">
                {sp.days.map((d, i) => {
                  const dd = getDay(d);
                  return <Plate key={i} color={dd.color} ink={dd.ink} size={28} label={d} />;
                })}
              </div>
            </button>
          );
        })}
      </section>

      <section id="days" className="flex flex-col gap-3 scroll-mt-6">
        <div>
          <h2 className="font-cond text-3xl font-bold">Your days</h2>
          <p className="text-steel">Swap in the lifts you actually do. Your history for every lift stays the same.</p>
        </div>
        {Array.from(new Set(getSplit(s.split).days)).map((dayName) => {
          const d = getDay(dayName);
          const list = dayList(dayName, s.custom_days);
          const open = editing === dayName;
          const edited = !!s.custom_days?.[dayName]?.length;
          return (
            <div key={dayName} className="rounded-2xl bg-white border border-line overflow-hidden">
              <button type="button" onClick={() => { setEditing(open ? null : dayName); setAdding(""); }} aria-expanded={open}
                className="w-full flex items-center gap-3 p-3 text-left">
                <Plate color={d.color} ink={d.ink} size={32} />
                <span className="flex-1">
                  <span className="block font-cond text-2xl font-bold leading-tight">{dayName}</span>
                  <span className="block text-sm text-steel">{list.length} lifts{edited ? ", edited by you" : ""}</span>
                </span>
                <span className="text-steel font-semibold">{open ? "Done" : "Edit"}</span>
              </button>
              {open && (
                <div className="px-3 pb-3 flex flex-col gap-2">
                  <ul className="flex flex-col divide-y divide-line border-y border-line">
                    {list.map((name, i) => (
                      <li key={name} className="flex items-center gap-1 py-2">
                        <span className="flex-1 font-semibold">{name}<span className="block text-xs font-normal text-steel">{EXERCISES[name].muscle}</span></span>
                        <button type="button" aria-label={`Move ${name} up`} disabled={i === 0}
                          onClick={() => saveDay(dayName, move(list, i, -1))} className="w-9 h-9 rounded-lg border border-line disabled:opacity-30">↑</button>
                        <button type="button" aria-label={`Move ${name} down`} disabled={i === list.length - 1}
                          onClick={() => saveDay(dayName, move(list, i, 1))} className="w-9 h-9 rounded-lg border border-line disabled:opacity-30">↓</button>
                        <button type="button" aria-label={`Remove ${name}`} disabled={list.length === 1}
                          onClick={() => saveDay(dayName, list.filter((x) => x !== name))} className="w-9 h-9 rounded-lg border border-line disabled:opacity-30">✕</button>
                      </li>
                    ))}
                  </ul>
                  <div className="flex gap-2">
                    <label className="sr-only" htmlFor={`add-${dayName}`}>Add a lift to {dayName}</label>
                    <select id={`add-${dayName}`} value={adding} onChange={(e) => setAdding(e.target.value)}
                      className="flex-1 min-w-0 rounded-xl border border-line bg-white px-3 py-2">
                      <option value="">Add a lift...</option>
                      {ALL_EXERCISES.filter((n) => !list.includes(n)).map((n) => (
                        <option key={n} value={n}>{n} ({EXERCISES[n].muscle})</option>
                      ))}
                    </select>
                    <button type="button" disabled={!adding} onClick={() => { saveDay(dayName, [...list, adding]); setAdding(""); }}
                      className="rounded-xl bg-ink text-white px-4 font-bold disabled:opacity-40">Add</button>
                  </div>
                  {edited && (
                    <button type="button" onClick={() => saveDay(dayName, null)} className="self-start text-sm font-semibold text-steel underline">
                      Reset {dayName} to the default
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </section>

      <section className="flex flex-col divide-y divide-line border-y border-line">
        {stepper("Lifting days a week", "lift_goal", 1, 7)}
        {stepper("Walks or runs a week", "cardio_goal", 0, 7)}
      </section>
      {status && <p className="text-sm font-semibold" aria-live="polite">{status}</p>}

      <button type="button" onClick={() => supabase.auth.signOut()}
        className="self-start rounded-xl border border-line px-4 py-3 font-semibold">Sign out</button>
    </main>
  );
}
