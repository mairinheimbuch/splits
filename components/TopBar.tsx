"use client";

import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useUser } from "@/lib/useUser";

// Back button on the left, sign out on the right, on every page except a live workout
export default function TopBar() {
  const path = usePathname();
  const router = useRouter();
  const { user } = useUser();
  if (!user || path.startsWith("/workout")) return null;

  const demo = Boolean(user.user_metadata?.demo);

  function back() {
    if (window.history.length > 1) router.back();
    else router.push("/");
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <header className="sticky top-0 z-40 bg-concrete/95 backdrop-blur border-b border-line pt-[env(safe-area-inset-top)]">
      <div className="mx-auto max-w-md flex items-center justify-between gap-3 px-4 py-2">
        {path !== "/" ? (
          <button type="button" onClick={back} className="flex items-center gap-1 rounded-xl px-2 py-2 font-semibold">
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.4}
              strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" />
            </svg>
            Back
          </button>
        ) : (
          <span className="font-cond text-2xl font-extrabold px-2">Splits</span>
        )}
        <div className="flex items-center gap-2">
          {demo && <span className="rounded-full bg-ink text-white text-xs font-bold px-2 py-1">DEMO</span>}
          <button type="button" onClick={signOut} className="rounded-xl border border-line bg-white px-3 py-2 font-semibold">
            {demo ? "Exit demo" : "Sign out"}
          </button>
        </div>
      </div>
    </header>
  );
}
