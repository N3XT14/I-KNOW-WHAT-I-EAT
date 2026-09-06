"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ScanLine, GraduationCap } from "lucide-react";

const TABS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/scan", label: "Scan", icon: ScanLine },
  { href: "/learn", label: "Learn", icon: GraduationCap },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="sticky bottom-0 z-10 flex border-t border-[var(--color-outline)] bg-[var(--color-surface)]"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {TABS.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-medium ${
              active
                ? "text-[var(--color-primary)]"
                : "text-[var(--color-on-surface-variant)]"
            }`}
          >
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}