"use client";

import { useEffect, useState } from "react";
import { supabase, getSettings, type Settings } from "@/lib/supabase";
import type { SetRow } from "@/lib/stats";

export type Workout = { id: string; day_name: string; started_at: string; finished_at: string | null; sleep_hours: number | null; energy: number | null };
export type CardioRow = { id: string; kind: "walk" | "run"; minutes: number; miles: number | null; done_at: string };

// Everything you've logged: settings, finished workouts, their sets, and walks/runs
export function useTraining(userId: string | undefined) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [sets, setSets] = useState<SetRow[]>([]);
  const [cardio, setCardio] = useState<CardioRow[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      setSettings(await getSettings(userId));
      const { data: w } = await supabase.from("workouts").select("*").not("finished_at", "is", null).order("started_at");
      const fin = (w ?? []) as Workout[];
      setWorkouts(fin);
      const { data: s } = await supabase.from("sets").select("*").order("created_at").limit(5000);
      const ids = new Set(fin.map((x) => x.id));
      setSets(((s ?? []) as SetRow[]).filter((x) => ids.has(x.workout_id)));
      const { data: c } = await supabase.from("cardio").select("*").order("done_at");
      setCardio((c ?? []) as CardioRow[]);
      setReady(true);
    })();
  }, [userId]);

  return { settings, workouts, sets, cardio, ready };
}
