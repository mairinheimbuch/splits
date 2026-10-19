"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Today", icon: "M4 10h3v4H4zM17 10h3v4h-3zM7 11h10v2H7zM2 11h2v2H2zM20 11h2v2h-2z" },
  { href: "/progress", label: "Progress", icon: "M4 18l5-6 4 3 7-9" },
  { href: "/settings", label: "My split", icon: "M12 4a8 8 0 100 16 8 8 0 000-16zm0 5a3 3 0 110 6 3 3 0 010-6z" },
];

export default function TabBar() {
  const path = usePathname();
  if (path.startsWith("/workout")) return null; // the workout screen has its own bottom bar
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-panel/95 backdrop-blur border-t border-line pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto max-w-md grid grid-cols-3">
        {TABS.map((t) => {
          const on = t.href === "/" ? path === "/" : path.startsWith(t.href);
          return (
            <Link key={t.href} href={t.href}
              className={"flex flex-col items-center gap-1 py-3 text-sm font-semibold " + (on ? "text-ink" : "text-steel")}>
              <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={on ? 2.4 : 1.8}
                strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d={t.icon} />
              </svg>
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}