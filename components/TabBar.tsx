"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

// In the order you use them: set your plan, lift, see your week, dig into the numbers, then you
const TABS = [
  { href: "/settings", also: "/plan", label: "Plan", icon: "M9 4h6v3H9zM7 5.5H5.5v15h13v-15H17M8.5 11h7M8.5 14.5h7M8.5 18h4" },
  { href: "/", label: "Today", icon: "M4 10h3v4H4zM17 10h3v4h-3zM7 11h10v2H7zM2 11h2v2H2zM20 11h2v2h-2z" },
  { href: "/progress", label: "Recap", icon: "M8 4h8v5a4 4 0 01-8 0zM8 6H5a3 3 0 003 4M16 6h3a3 3 0 01-3 4M12 13v4M8.5 20h7" },
  { href: "/analytics", label: "Analytics", icon: "M4 4v16h16M7.5 15l4-5 3 2.5L19 7" },
  { href: "/me", label: "Me", icon: "M12 4a4 4 0 100 8 4 4 0 000-8zM4.5 20a7.5 7.5 0 0115 0" },
];

export default function TabBar() {
  const path = usePathname();
  // iPhones only show the pressed look on buttons when the page listens for touches
  useEffect(() => {
    const noop = () => {};
    document.addEventListener("touchstart", noop, { passive: true });
    return () => document.removeEventListener("touchstart", noop);
  }, []);
  // Every new tab or page starts at the top, instead of keeping the last page's scroll
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [path]);
  if (path.startsWith("/workout")) return null; // the workout screen has its own bottom bar
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-panel/95 backdrop-blur border-t border-line pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto max-w-md grid grid-cols-5">
        {TABS.map((t) => {
          const on = t.href === "/" ? path === "/" : path.startsWith(t.href) || (!!t.also && path.startsWith(t.also));
          return (
            <Link key={t.href} href={t.href} aria-current={on ? "page" : undefined}
              className={"flex flex-col items-center gap-1 py-2.5 text-xs font-semibold " + (on ? "text-ink" : "text-steel")}>
              <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={on ? 2.4 : 1.8}
                strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d={t.icon} />
              </svg>
              {t.label}
              <span className={"h-1 w-6 rounded-full " + (on ? "bg-ink" : "bg-transparent")} aria-hidden="true" />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
