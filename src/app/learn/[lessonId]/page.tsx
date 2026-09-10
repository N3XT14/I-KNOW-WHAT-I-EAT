"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Card from "@/components/ui/Card";
import ProfileSwitcher from "@/components/profile/ProfileSwitcher";
import LearnBlockRenderer from "@/components/learn/blocks/LearnBlockRenderer";
import { getLesson } from "@/lib/lessons";
import { getProfiles, getActiveProfileId } from "@/lib/profiles";
import { getFoodEventsForProfile } from "@/lib/foodEvents";
import { getLearnContent } from "@/lib/learnContent";
import type { Profile } from "@/types/profile";
import type { FoodEvent } from "@/types/foodEvent";
import type { LearnContentSequence } from "@/types/learnContent";

export default function LessonPage() {
  const params = useParams<{ lessonId: string }>();
  const router = useRouter();
  const lesson = getLesson(params.lessonId);

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeProfileId, setActiveProfileIdState] = useState<string | null>(null);
  const [sequence, setSequence] = useState<LearnContentSequence | null>(null);
  const [loading, setLoading] = useState(false);

  function refreshProfiles() {
    setProfiles(getProfiles());
    setActiveProfileIdState(getActiveProfileId());
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshProfiles();
  }, []);

  const events: FoodEvent[] = activeProfileId ? getFoodEventsForProfile(activeProfileId) : [];
  const activeProfile = profiles.find((p) => p.id === activeProfileId) ?? null;

  useEffect(() => {
    if (!lesson || !activeProfile) {
      setSequence(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getLearnContent(activeProfile, events, lesson.id, lesson.nutrientFocus).then((seq) => {
      if (!cancelled) {
        setSequence(seq);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson?.id, activeProfile?.id, events.length]);

  if (!lesson) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-col gap-4 p-4 pb-6">
        <p className="text-sm text-[var(--color-on-surface-variant)]">That lesson doesn&apos;t exist.</p>
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
          <ProfileSwitcher profiles={profiles} activeProfileId={activeProfileId} onChange={refreshProfiles} />
        )}
      </header>

      <Card variant="elevated" className="flex flex-col gap-2 p-5">
        <h1 className="text-lg font-semibold text-[var(--color-on-surface)]">{lesson.title}</h1>
        <p className="text-sm leading-relaxed text-[var(--color-on-surface-variant)]">{lesson.body}</p>
      </Card>

      <div className="flex flex-col gap-3">
        {!activeProfile && (
          <Card className="p-4">
            <p className="text-sm text-[var(--color-on-surface-variant)]">
              Add a family profile from the home screen first.
            </p>
          </Card>
        )}
        {activeProfile && loading && !sequence && (
          <Card className="p-4">
            <p className="text-sm text-[var(--color-on-surface-variant)]">Putting this lesson together…</p>
          </Card>
        )}
        {activeProfile &&
          sequence?.blocks.map((block) => (
            <LearnBlockRenderer
              key={block.id}
              block={block}
              profile={activeProfile}
              events={events}
              lessonId={lesson.id}
              nutrient={lesson.nutrientFocus}
            />
          ))}
      </div>
    </main>
  );
}
