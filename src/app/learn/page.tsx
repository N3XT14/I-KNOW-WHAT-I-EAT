"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Flame } from "lucide-react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import ProfileSwitcher from "@/components/profile/ProfileSwitcher";
import { LESSONS } from "@/lib/lessons";
import { getProfiles, getActiveProfileId } from "@/lib/profiles";
import { getChallengeAttemptsForProfile } from "@/lib/challengeAttempts";
import { currentStreak, masteryByNutrient } from "@/lib/streaks";
import { nutrientLabel } from "@/lib/nutrientLabels";
import type { Profile } from "@/types/profile";

export default function LearnPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeProfileId, setActiveProfileIdState] = useState<string | null>(null);

  function refreshProfiles() {
    setProfiles(getProfiles());
    setActiveProfileIdState(getActiveProfileId());
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshProfiles();
  }, []);

  const activeProfile = profiles.find((p) => p.id === activeProfileId) ?? null;
  const attempts = activeProfileId ? getChallengeAttemptsForProfile(activeProfileId) : [];
  const streak = currentStreak(attempts);
  const mastery = masteryByNutrient(attempts);
  // Every nutrient a lesson exists for, not just ones already attempted —
  // so "not tried yet" shows up as a status, not an absence.
  const allNutrients = Array.from(new Set(LESSONS.map((l) => l.nutrientFocus)));

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4 p-4 pb-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-on-surface)]">
            Learn
          </h1>
          <p className="mt-1 text-sm text-[var(--color-on-surface-variant)]">
            Short lessons, then try them out on something you actually scanned.
          </p>
        </div>
        {profiles.length > 0 && (
          <ProfileSwitcher
            profiles={profiles}
            activeProfileId={activeProfileId}
            onChange={refreshProfiles}
          />
        )}
      </header>

      {activeProfile && streak > 0 && (
        <Badge tone="warning" icon={<Flame className="h-3.5 w-3.5" />}>
          {streak} day{streak === 1 ? "" : "s"} streak · {activeProfile.name}
        </Badge>
      )}

      {activeProfile && (
        <Card className="p-4">
          <h2 className="mb-2 text-sm font-semibold text-[var(--color-on-surface)]">
            {activeProfile.name}&apos;s mastery
          </h2>
          <ul className="flex flex-col gap-1.5">
            {allNutrients.map((nutrient) => {
              const entry = mastery.find((m) => m.nutrient === nutrient);
              return (
                <li
                  key={nutrient}
                  className="flex items-center justify-between text-sm text-[var(--color-on-surface)]"
                >
                  <span className="capitalize">{nutrientLabel(nutrient)}</span>
                  {entry ? (
                    <span className="text-[var(--color-on-surface-variant)]">
                      {entry.correct}/{entry.attempted} correct ({entry.accuracy}%)
                    </span>
                  ) : (
                    <span className="text-[var(--color-on-surface-variant)]">
                      Not tried yet
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <div className="flex flex-col gap-3">
        {LESSONS.map((lesson) => (
          <Link key={lesson.id} href={`/learn/${lesson.id}`}>
            <Card className="p-4 transition-colors hover:border-[var(--color-primary)]">
              <h2 className="text-sm font-semibold text-[var(--color-on-surface)]">
                {lesson.title}
              </h2>
              <p className="mt-1 line-clamp-2 text-sm text-[var(--color-on-surface-variant)]">
                {lesson.body}
              </p>
            </Card>
          </Link>
        ))}
      </div>
    </main>
  );
}