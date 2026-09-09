"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Card from "@/components/ui/Card";
import Challenge from "@/components/learn/Challenge";
import ProfileSwitcher from "@/components/profile/ProfileSwitcher";
import { getLesson } from "@/lib/lessons";
import { getProfiles, getActiveProfileId } from "@/lib/profiles";
import { getFoodEventsForProfile } from "@/lib/foodEvents";
import type { Profile } from "@/types/profile";
import type { FoodEvent } from "@/types/foodEvent";

export default function LessonPage() {
  const params = useParams<{ lessonId: string }>();
  const router = useRouter();
  const lesson = getLesson(params.lessonId);

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeProfileId, setActiveProfileIdState] = useState<string | null>(null);

  function refreshProfiles() {
    setProfiles(getProfiles());
    setActiveProfileIdState(getActiveProfileId());
  }

  useEffect(() => {
    // localStorage doesn't exist during SSR — this has to happen after
    // mount, a genuine "read from an external system on mount" case.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshProfiles();
  }, []);

  // Derived directly rather than mirrored into its own state — by the time
  // activeProfileId is non-null we're already client-side (see effect
  // above), so this is a plain synchronous localStorage read, not
  // something that needs its own effect.
  const events: FoodEvent[] = activeProfileId
    ? getFoodEventsForProfile(activeProfileId)
    : [];

  const activeProfile = profiles.find((p) => p.id === activeProfileId) ?? null;

  if (!lesson) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-col gap-4 p-4 pb-6">
        <p className="text-sm text-[var(--color-on-surface-variant)]">
          That lesson doesn&apos;t exist.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4 p-4 pb-6">
      <header className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => router.push("/learn")}
          className="flex items-center gap-1 text-sm text-[var(--color-on-surface-variant)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Learn
        </button>
        {profiles.length > 0 && (
          <ProfileSwitcher
            profiles={profiles}
            activeProfileId={activeProfileId}
            onChange={refreshProfiles}
          />
        )}
      </header>

      <Card variant="elevated" className="flex flex-col gap-2 p-5">
        <h1 className="text-lg font-semibold text-[var(--color-on-surface)]">
          {lesson.title}
        </h1>
        <p className="text-sm leading-relaxed text-[var(--color-on-surface-variant)]">
          {lesson.body}
        </p>
      </Card>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-[var(--color-on-surface)]">
          Try it
        </h2>
        {activeProfile ? (
          <Challenge
            key={`${lesson.id}:${activeProfile.id}`}
            nutrient={lesson.nutrientFocus}
            lessonId={lesson.id}
            profile={activeProfile}
            events={events}
          />
        ) : (
          <Card className="p-4">
            <p className="text-sm text-[var(--color-on-surface-variant)]">
              Add a family profile from the home screen first.
            </p>
          </Card>
        )}
      </div>
    </main>
  );
}