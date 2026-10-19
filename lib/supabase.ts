import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

export type Settings = {
  user_id: string; split: string; lift_goal: number; cardio_goal: number; unit: string;
  custom_days?: Record<string, string[]> | null; // your own exercise list for any day
};

// Your settings, created with good defaults the first time
export async function getSettings(userId: string): Promise<Settings> {
  const { data } = await supabase.from("settings").select("*").eq("user_id", userId).maybeSingle();
  if (data) return data as Settings;
  const fresh = { user_id: userId, split: "ppl_ul", lift_goal: 5, cardio_goal: 3, unit: "lb" };
  await supabase.from("settings").insert(fresh);
  return fresh;
}
