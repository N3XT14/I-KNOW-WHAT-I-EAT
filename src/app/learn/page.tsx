"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Flame } from "lucide-react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import ProfileSwitcher from "@/components/profile/ProfileSwitcher";
import { getLessonCards } from "@/lib/lessons";
import { getProfiles, getActiveProfileId } from "@/lib/profiles";
import { getChallengeAttemptsForProfile } from "@/lib/challengeAttempts";
import { getFoodEventsForProfile } from "@/lib/foodEvents";
import TutorTip from "@/components/learn/TutorTip";
import { POSE_SRC } from "@/components/learn/Mascot";
import { currentStreak, masteryByNutrient } from "@/lib/streaks";
import { nutrientLabel } from "@/lib/nutrientLabels";
import { TRACKED_NUTRIENT_KEYS } from "@/types/nutrientLimits";
import type { Profile } from "@/types/profile";
import type { LessonAngle } from "@/types/learnMode";

const ANGLE_TAG: Record<LessonAngle, string> = {
  basics: "Basics",
  claims: "Claims check",
  compare: "Compare",
  "hidden-sources": "Hidden sources",
};

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
  const events = activeProfileId ? getFoodEventsForProfile(activeProfileId) : [];
  const streak = currentStreak(attempts);
  const mastery = masteryByNutrient(attempts);
  // Every tracked nutrient, not just ones already attempted — so "not
  // tried yet" shows up as a status, not an absence. Independent of
  // which lesson cards are currently generated, since a nutrient can
  // have zero eligible cards right now (e.g. everything's been
  // completed) and should still show its mastery row.
  const allNutrients = TRACKED_NUTRIENT_KEYS;
  const lessonCards = activeProfile ? getLessonCards(activeProfile, events) : [];

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
        <div className="flex items-center gap-2">
          <Image src={POSE_SRC.celebrate_jump} alt="" width={28} height={28} aria-hidden />
          <Badge tone="warning" icon={<Flame className="h-3.5 w-3.5" />}>
            {streak} day{streak === 1 ? "" : "s"} streak · {activeProfile.name}
          </Badge>
        </div>
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

      {activeProfile && (
        <TutorTip profile={activeProfile} events={events} mastery={mastery} />
      )}

      <div className="flex flex-col gap-3">
        {activeProfile && lessonCards.length === 0 && (
          <Card className="p-4">
            <p className="text-sm text-[var(--color-on-surface-variant)]">
              You&apos;ve finished every lesson available right now — scan a few more foods to unlock new ones.
            </p>
          </Card>
        )}
        {lessonCards.map((lesson) => (
          <Link key={lesson.id} href={`/learn/${lesson.id}`}>
            <Card className="p-4 transition-colors hover:border-[var(--color-primary)]">
              <div className="mb-1.5 flex items-center gap-2">
                <Badge tone="neutral">{ANGLE_TAG[lesson.angle]}</Badge>
                <Badge tone="neutral" className="capitalize">
                  {nutrientLabel(lesson.nutrientFocus)}
                </Badge>
              </div>
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