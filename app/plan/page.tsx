"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase, getSettings, type Settings } from "@/lib/supabase";
import { useUser } from "@/lib/useUser";
import { MUSCLES, EXERCISES, getDay, type Muscle, type Joint } from "@/lib/program";
import { buildPlan, underworked, SPLIT_NAME, type Answers, type Plan } from "@/lib/planner";
import Login from "@/components/Login";
import Plate from "@/components/Plate";

const DEFAULTS: Answers = { days: 5, goal: "muscle", experience: "some", equipment: "gym", minutes: 60, focus: [], avoid: [] };

export default function PlanBuilder() {
  const { user, loading } = useUser();
  const [s, setS] = useState<Settings | null>(null);
  const [a, setA] = useState<Answers>(DEFAULTS);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [hint, setHint] = useState<Muscle[]>([]);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const st = await getSettings(user.id);
      setS(st);
      if (st.plan_answers) setA({ ...DEFAULTS, ...st.plan_answers });
      const { data } = await supabase.from("sets").select("exercise, created_at").order("created_at", { ascending: false }).limit(1500);
      setHint(underworked(data ?? []));
    })();
  }, [user]);

  async function usePlan() {
    if (!s || !plan) return;
    const { error } = await supabase.from("settings").update({
      split: plan.splitId, lift_goal: a.days, custom_days: plan.days, plan_answers: a,
    }).eq("user_id", s.user_id);
    if (error) return setStatus("Couldn't save: " + error.message);
    window.location.href = "/";
  }

  if (loading) return null;
  if (!user) return <Login />;
  if (!s) return <p className="p-6 text-steel">Loading...</p>;

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const chip = (on: boolean) => "rounded-xl px-3 py-2 font-semibold border-2 " + (on ? "bg-ink text-white border-ink" : "bg-white border-line");

  function choice<K extends keyof Answers>(key: K, options: [Answers[K], string][]) {
    return (
      <div className="flex flex-wrap gap-2" role="group">
        {options.map(([v, label]) => (
          <button key={String(v)} type="button" aria-pressed={a[key] === v} onClick={() => { setA({ ...a, [key]: v }); setPlan(null); }}
            className={chip(a[key] === v)}>{label}</button>
        ))}
      </div>
    );
  }

  if (plan) {
    return (
      <main className="px-5 pt-10 flex flex-col gap-6">
        <button type="button" onClick={() => setPlan(null)} className="self-start font-semibold text-steel">Back to my answers</button>
        <div>
          <p className="text-steel">Your plan</p>
          <h1 className="font-cond text-5xl font-extrabold leading-none">{SPLIT_NAME(plan.splitId)}</h1>
          <p className="mt-2 text-steel">{a.days} days a week, about {a.minutes} minutes each.</p>
        </div>

        <section className="rounded-2xl bg-ink text-white p-5 flex flex-col gap-3">
          <h2 className="font-cond text-2xl font-bold">Why this plan</h2>
          <ul className="flex flex-col gap-2 list-disc pl-5">
            {plan.reasons.map((r) => <li key={r}>{r}</li>)}
          </ul>
        </section>

        {Object.entries(plan.days).map(([dayName, list]) => {
          const d = getDay(dayName);
          return (
            <section key={dayName} className="rounded-2xl bg-white border border-line overflow-hidden">
              <div className="flex items-center gap-3 p-3" style={{ background: d.color, color: d.ink }}>
                <Plate color={d.ink === "#FFFFFF" ? "rgba(255,255,255,0.2)" : "rgba(28,34,48,0.15)"} ink={d.ink} size={32} />
                <h2 className="font-cond text-2xl font-bold">{dayName}</h2>
              </div>
              <ul className="divide-y divide-line">
                {list.map((n) => (
                  <li key={n} className="flex justify-between gap-3 px-3 py-2">
                    <span className="font-semibold">{n}{a.focus.includes(EXERCISES[n].muscle) && <span className="ml-2 text-xs font-bold text-good">focus</span>}</span>
                    <span className="text-steel tabular whitespace-nowrap">{EXERCISES[n].sets} × {EXERCISES[n].reps[0]}–{EXERCISES[n].reps[1]}</span>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}

        {plan.swaps.length > 0 && (
          <details className="rounded-2xl bg-white border border-line p-4">
            <summary className="cursor-pointer font-semibold">What changed from the standard version ({plan.swaps.length})</summary>
            <ul className="mt-2 flex flex-col gap-1 text-sm list-disc pl-5">
              {plan.swaps.map((w) => <li key={w}>{w}</li>)}
            </ul>
          </details>
        )}

        <p className="text-sm text-steel">
          Built from common training research, not medical advice. You can still swap any lift on My split.
        </p>
        <div className="flex flex-col gap-2 pb-6">
          <button type="button" onClick={usePlan} className="rounded-2xl bg-ink text-white py-4 text-xl font-bold">Use this plan</button>
          <Link href="/settings" className="text-center py-2 font-semibold text-steel">Keep my current split</Link>
          {status && <p className="text-sm font-semibold text-[#B3132B]">{status}</p>}
        </div>
      </main>
    );
  }

  return (
    <main className="px-5 pt-10 flex flex-col gap-7">
      <div>
        <h1 className="font-cond text-5xl font-extrabold leading-none">Build my plan</h1>
        <p className="mt-2 text-steel">Answer a few questions and get a split and lifts that fit your week, your gear and your body. Every pick comes with the reason.</p>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="font-cond text-2xl font-bold">How many days a week can you really lift?</h2>
        {choice("days", [[2, "2"], [3, "3"], [4, "4"], [5, "5"], [6, "6"]])}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-cond text-2xl font-bold">Main goal</h2>
        {choice("goal", [["muscle", "Build muscle"], ["strength", "Get stronger"], ["fitness", "General fitness"]])}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-cond text-2xl font-bold">How long have you been lifting?</h2>
        {choice("experience", [["new", "Under 6 months"], ["some", "6 months – 2 years"], ["lots", "2+ years"]])}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-cond text-2xl font-bold">Where do you train?</h2>
        {choice("equipment", [["gym", "Full gym"], ["dumbbells", "Dumbbells only"], ["home", "Home, no equipment"]])}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-cond text-2xl font-bold">Time per workout</h2>
        {choice("minutes", [[45, "About 45 min"], [60, "About 60 min"], [75, "75+ min"]])}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-cond text-2xl font-bold">Anything you want more of? <span className="text-base font-sans font-normal text-steel">(optional)</span></h2>
        {hint.length > 0 && (
          <p className="text-sm rounded-xl bg-white border border-line p-3">
            From your last 2 weeks: <strong>{hint.join(", ")}</strong> got about half the sets of your other big muscles.{" "}
            <button type="button" className="font-semibold underline" onClick={() => { setA({ ...a, focus: Array.from(new Set([...a.focus, ...hint])) }); setPlan(null); }}>Add {hint.length > 1 ? "them" : "it"}</button>
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {MUSCLES.map((m) => (
            <button key={m} type="button" aria-pressed={a.focus.includes(m)} disabled={!a.focus.includes(m) && a.focus.length >= 3}
              onClick={() => { setA({ ...a, focus: toggle(a.focus, m) }); setPlan(null); }} className={chip(a.focus.includes(m)) + " disabled:opacity-40"}>{m}</button>
          ))}
        </div>
        <p className="text-sm text-steel">Up to 3. Focusing on everything is the same as focusing on nothing.</p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-cond text-2xl font-bold">Any spots to go easy on? <span className="text-base font-sans font-normal text-steel">(optional)</span></h2>
        <div className="flex flex-wrap gap-2">
          {([["knee", "Knees"], ["back", "Lower back"], ["shoulder", "Shoulders"]] as [Joint, string][]).map(([j, label]) => (
            <button key={j} type="button" aria-pressed={a.avoid.includes(j)} onClick={() => { setA({ ...a, avoid: toggle(a.avoid, j) }); setPlan(null); }}
              className={chip(a.avoid.includes(j))}>{label}</button>
          ))}
        </div>
        <p className="text-sm text-steel">This only swaps lifts that load those joints hard. If something hurts, see a doctor or physical therapist.</p>
      </section>

      <button type="button" onClick={() => { setPlan(buildPlan(a)); window.scrollTo({ top: 0 }); }}
        className="mb-6 rounded-2xl bg-ink text-white py-4 text-xl font-bold">Show my plan</button>
    </main>
  );
}
