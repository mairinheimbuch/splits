"use client";

import { useEffect, useState } from "react";
import { supabase, getSettings, type Settings } from "@/lib/supabase";
import { useUser } from "@/lib/useUser";
import Login from "@/components/Login";

// Me: optional body info, your account, and how Splits treats your data
export default function Me() {
  const { user, loading } = useUser();
  const [s, setS] = useState<Settings | null>(null);
  const [bw, setBw] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (user) getSettings(user.id).then((st) => { setS(st); setBw(st.bodyweight ? String(st.bodyweight) : ""); });
  }, [user]);

  async function saveBodyweight(clear = false) {
    if (!s) return;
    const n = clear ? null : Number(bw) || null;
    if (clear) setBw("");
    setS({ ...s, bodyweight: n });
    const { error } = await supabase.from("settings").update({ bodyweight: n }).eq("user_id", s.user_id);
    setStatus(error ? "Couldn't save: " + error.message : clear ? "Bodyweight removed ✓" : "Saved ✓");
  }

  if (loading) return null;
  if (!user) return <Login />;
  if (!s) return <p className="p-6 text-steel">Loading...</p>;
  const demo = Boolean(user.user_metadata?.demo);

  return (
    <main className="px-5 pt-6 flex flex-col gap-8 pb-4">
      <div>
        <h1 className="font-cond text-5xl font-extrabold">Me</h1>
        <p className="text-steel">{demo ? "You're in a private demo. It's deleted after a day." : `Signed in as ${user.email}`}</p>
      </div>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="font-cond text-3xl font-bold">Protein <span className="font-sans text-base font-normal text-steel">(optional)</span></h2>
          <p className="text-steel">Add your bodyweight to see a daily protein range for building muscle. It stays private and is only used for this.</p>
        </div>
        <div className="flex gap-2">
          <label className="sr-only" htmlFor="bw">Bodyweight in pounds</label>
          <input id="bw" type="number" inputMode="decimal" placeholder="Bodyweight" value={bw} onChange={(e) => { setBw(e.target.value); setStatus(""); }}
            className="w-40 rounded-xl border border-line bg-white px-3 py-2 text-lg tabular" />
          <span className="self-center text-steel">lb</span>
          <button type="button" onClick={() => saveBodyweight()} disabled={!Number(bw)}
            className="rounded-xl bg-ink text-white px-4 font-bold disabled:opacity-40">Save</button>
          {s.bodyweight ? (
            <button type="button" onClick={() => saveBodyweight(true)} className="rounded-xl border border-line px-3 font-semibold">Remove</button>
          ) : null}
        </div>
        {status && <p className="text-sm font-semibold text-good" aria-live="polite">{status}</p>}
        {s.bodyweight ? (
          <div className="rounded-2xl bg-white border border-line p-4 flex flex-col gap-2">
            <p className="text-lg">
              About <strong className="font-cond text-3xl tabular">{Math.round(s.bodyweight * 0.73)}-{Math.round(s.bodyweight)} g</strong> of protein a day
            </p>
            <details>
              <summary className="cursor-pointer font-semibold underline">Why this range?</summary>
              <p className="mt-2 text-sm">
                Studies on lifting commonly land around 1.6 g of protein per kg of bodyweight a day (about 0.7 g per lb), with some benefit up to about 2.2 g per kg (1 g per lb).
                Going past the top of the range doesn&apos;t seem to add more muscle. Spreading it over 3-4 meals is easier than one big one.
              </p>
              <p className="mt-2 text-sm">
                This is a general range from research, not medical or diet advice. If you have kidney problems or another health condition, check with a doctor first.
              </p>
            </details>
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl bg-white border border-line p-4 flex flex-col gap-2">
        <h2 className="font-cond text-2xl font-bold">How Splits treats you</h2>
        <ul className="list-disc pl-5 flex flex-col gap-1">
          <li>No BMI, calorie counting or body-shape goals, on purpose. Splits tracks what you lift, not how you look.</li>
          <li>Your data is private to your account. Nobody else can see it.</li>
          <li>Every suggestion explains why, so you can decide for yourself.</li>
          <li>Rest weeks are fine. If something hurts, see a doctor or physical therapist.</li>
        </ul>
      </section>
    </main>
  );
}
