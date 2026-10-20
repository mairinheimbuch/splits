"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import Plate from "@/components/Plate";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);

  // A private demo account with 5 weeks of made-up training, so you can see everything first
  async function tryDemo() {
    setDemoBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/demo", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      const { error } = await supabase.auth.signInWithPassword({ email: data.email, password: data.password });
      if (error) throw error;
      window.location.href = "/settings"; // always start on Plan, the first tab
    } catch (e) {
      setDemoBusy(false);
      setMsg("Couldn't open the demo: " + (e instanceof Error ? e.message : "unknown error"));
    }
  }

  async function go(mode: "in" | "up") {
    if (!email || !password) return setMsg("Enter your email and a password.");
    setBusy(true);
    setMsg("");
    const { data, error } = mode === "in"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (error) return setMsg(error.message);
    if (data.session) window.location.href = "/settings"; // always start on Plan, the first tab
    else setMsg("Check your email to confirm your account, then sign in.");
  }

  const input = "w-full rounded-xl border border-line bg-white px-4 py-3 text-lg";
  return (
    <main className="px-6 pt-16 flex flex-col gap-8">
      <div className="flex items-end gap-1" aria-hidden="true">
        <Plate color="#D7263D" size={64} />
        <Plate color="#1F5FBF" size={56} />
        <Plate color="#F2B705" ink="#1C2230" size={48} />
        <Plate color="#2E8B57" size={40} />
      </div>
      <div>
        <h1 className="font-cond text-6xl font-extrabold leading-none tracking-tight">Splits</h1>
        <p className="mt-3 text-lg text-steel">Log every set in seconds. Know exactly what to lift next time.</p>
      </div>
      <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); go("in"); }}>
        <label className="sr-only" htmlFor="email">Email</label>
        <input id="email" type="email" autoComplete="email" placeholder="Email" className={input}
          value={email} onChange={(e) => setEmail(e.target.value)} />
        <label className="sr-only" htmlFor="password">Password</label>
        <input id="password" type="password" autoComplete="current-password" placeholder="Password (6+ characters)" className={input}
          value={password} onChange={(e) => setPassword(e.target.value)} />
        <button type="submit" disabled={busy}
          className="mt-2 rounded-xl bg-ink text-white py-4 text-lg font-bold disabled:opacity-60">Sign in</button>
        <button type="button" disabled={busy} onClick={() => go("up")}
          className="rounded-xl border-2 border-ink py-3 text-lg font-bold disabled:opacity-60">Create an account</button>
        {msg && <p className="text-sm font-semibold text-[#B3132B]">{msg}</p>}
      </form>
      <div className="border-t border-line pt-6 flex flex-col gap-2">
        <button type="button" onClick={tryDemo} disabled={demoBusy || busy}
          className="rounded-xl bg-white border border-line py-3 text-lg font-bold disabled:opacity-60">
          {demoBusy ? "Building your demo..." : "Try a demo, no account needed"}
        </button>
        <p className="text-sm text-steel text-center">Your own private copy with 5 weeks of made-up workouts. Play around, nobody else sees it.</p>
      </div>
    </main>
  );
}