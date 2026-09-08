"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import ProfileOnboarding from "@/components/profile/ProfileOnboarding";
import ProfileSwitcher from "@/components/profile/ProfileSwitcher";
import ProfileSummary from "@/components/profile/ProfileSummary";
import { getProfiles, getActiveProfileId } from "@/lib/profiles";
import type { Profile } from "@/types/profile";

export default function Home() {
  // null = not yet loaded (avoids a hydration flash of the wrong state,
  // since profiles only exist in localStorage / client-side).
  const [profiles, setProfiles] = useState<Profile[] | null>(null);
  const [activeProfileId, setActiveProfileIdState] = useState<string | null>(null);

  function refresh() {
    setProfiles(getProfiles());
    setActiveProfileIdState(getActiveProfileId());
  }

  useEffect(() => {
    // localStorage doesn't exist during SSR, so this has to happen after
    // mount — a genuine "read from an external system on mount" case, not
    // a derived-state anti-pattern.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, []);

  if (profiles === null) {
    // Brief client-only load; nothing worth showing a spinner for.
    return null;
  }

  if (profiles.length === 0) {
    return (
      <main className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center gap-6 p-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-[var(--color-on-surface)]">
            I Know What I Eat
          </h1>
          <p className="mt-2 text-[var(--color-on-surface-variant)]">
            Scan a food label and actually understand what it means — not
            just get told.
          </p>
        </div>
        <ProfileOnboarding onDone={refresh} />
      </main>
    );
  }

  const activeProfile = profiles.find((p) => p.id === activeProfileId) ?? null;

  return (
    <main className="flex flex-1 flex-col">
      <header className="flex items-center justify-end p-4">
        <ProfileSwitcher
          profiles={profiles}
          activeProfileId={activeProfileId}
          onChange={refresh}
        />
      </header>

      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
        <h1 className="text-2xl font-semibold text-[var(--color-on-surface)]">
          I Know What I Eat
        </h1>
        <p className="max-w-md text-[var(--color-on-surface-variant)]">
          Scan a food label and actually understand what it means — not just
          get told.
        </p>
        <Link href="/scan">
          <Button>Scan a label</Button>
        </Link>

        {/* Renders nothing until this profile has at least one logged
            scan — a brand-new profile still just gets the plain CTA
            above, not an empty/zeroed-out summary card. */}
        {activeProfile && (
          <div className="mt-2 w-full max-w-sm">
            <ProfileSummary profile={activeProfile} />
          </div>
        )}
      </div>
    </main>
  );
}