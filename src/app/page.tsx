"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import ProfileOnboarding from "@/components/profile/ProfileOnboarding";
import ProfileSwitcher from "@/components/profile/ProfileSwitcher";
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
      </div>
    </main>
  );
}