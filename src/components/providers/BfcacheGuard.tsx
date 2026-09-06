"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Fixes the "login/logout back-and-forth" issue: after signing out,
 * pressing the browser Back button can restore the previous authenticated
 * page straight from the browser's back-forward cache (bfcache) — a
 * snapshot held in memory, served with zero network requests. Since
 * proxy.ts only runs on real requests, a bfcache restore skips it
 * entirely, so a doctor who signed out and handed the laptop back could
 * briefly (or not-so-briefly) see the previous dashboard state again.
 * Same thing in reverse: Back from the dashboard to /login can show the
 * stale login form even though the user is already signed in.
 *
 * The fix: listen for the `pageshow` event and check `event.persisted` —
 * true only when the page came from bfcache rather than a fresh load.
 * When that happens, force a server round trip via router.refresh(),
 * which re-runs proxy.ts and every Server Component on the current route,
 * so the real, current session state (redirect to /login, or into the
 * dashboard) always wins over whatever was cached in memory.
 *
 * Mounted once in the root layout — covers every route, not just the
 * dashboard, since the login page has the same stale-restore problem in
 * the opposite direction.
 */
export default function BfcacheGuard() {
  const router = useRouter();

  useEffect(() => {
    function handlePageShow(event: PageTransitionEvent) {
      if (event.persisted) {
        router.refresh();
      }
    }

    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, [router]);

  return null;
}