"use client";

import { useEffect, useState } from "react";
import { supabase, getSettings, type Settings } from "@/lib/supabase";
import { useUser } from "@/lib/useUser";
import { SPLITS, getDay } from "@/lib/program";
import Login from "@/components/Login";
import Plate from "@/components/Plate";

export default function MySplit() {
  const { user, loading } = useUser();
  const [s, setS] = useState<Settings | null>(null);
  const [status, setStatus] = useState("");

  useEffect(() => { if (user) getSettings(user.id).then(setS); }, [user]);

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