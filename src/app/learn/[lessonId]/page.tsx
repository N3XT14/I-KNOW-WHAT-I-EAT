"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Card from "@/components/ui/Card";
import ProfileSwitcher from "@/components/profile/ProfileSwitcher";
import LearnBlockRenderer from "@/components/learn/blocks/LearnBlockRenderer";
import { getLesson } from "@/lib/lessons";
import { getProfiles, getActiveProfileId } from "@/lib/profiles";
import { getFoodEventsForProfile } from "@/lib/foodEvents";
import { getLearnContent } from "@/lib/learnContent";
import { markLessonCompleted } from "@/lib/lessonCompletions";
import type { Profile } from "@/types/profile";
import type { FoodEvent } from "@/types/foodEvent";
import { isChallengeBlock, type LearnContentSequence } from "@/types/learnContent";

export default function LessonPage() {
  const params = useParams<{ lessonId: string }>();
  const router = useRouter();
  const lesson = getLesson(params.lessonId);

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeProfileId, setActiveProfileIdState] = useState<string | null>(null);
  const [sequence, setSequence] = useState<LearnContentSequence | null>(null);
  const [loading, setLoading] = useState(false);
  const [answeredBlockIds, setAnsweredBlockIds] = useState<Set<string>>(new Set());
  const [confirmingExit, setConfirmingExit] = useState(false);

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
    getLearnContent(activeProfile, events, lesson.id, lesson.nutrientFocus, lesson.angle).then((seq) => {
      if (!cancelled) {
        setSequence(seq);
        setLoading(false);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setAnsweredBlockIds(new Set());
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson?.id, activeProfile?.id, events.length]);

  // Only graded challenges (not "matching", which is reveal-only with no
  // correct/incorrect state) count toward "has this lesson been finished".
  // A lesson with none — e.g. a matching-only reference fallback — is
  // trivially complete, since there's nothing to grade.
  const gradedBlockIds = useMemo(
    () => (sequence?.blocks.filter((b) => isChallengeBlock(b) && b.kind !== "matching").map((b) => b.id) ?? []),
    [sequence],
  );
  const isComplete = gradedBlockIds.every((id) => answeredBlockIds.has(id));

  // Fires once per visit the moment every graded block has been
  // answered — markLessonCompleted is idempotent, so a re-render while
  // isComplete stays true doesn't add a duplicate record. A
  // zero-graded-block lesson (e.g. matching-only) is trivially complete
  // immediately, which correctly marks it done right away rather than
  // leaving it stuck reappearing in the Learn list forever.
  useEffect(() => {
    if (activeProfile && lesson && isComplete && sequence) {
      markLessonCompleted(activeProfile.id, lesson.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isComplete, activeProfile?.id, lesson?.id, sequence]);

  function handleBackClick() {
    if (isComplete) {
      router.push("/learn");
      return;
    }
    setConfirmingExit(true);
  }

  if (!lesson) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-col gap-4 p-4 pb-6">
        <p className="text-sm text-[var(--color-on-surface-variant)]">That lesson doesn&apos;t exist.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4 p-4 pb-6">
      <header className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={handleBackClick}
            className="flex items-center gap-1 text-sm text-[var(--color-on-surface-variant)]"
          >
            <ArrowLeft className="h-4 w-4" />
            Learn
          </button>
          {profiles.length > 0 && (
            <ProfileSwitcher profiles={profiles} activeProfileId={activeProfileId} onChange={refreshProfiles} />
          )}
        </div>
        {/* Inline confirm, in normal page flow — Dialog/Radix Portal is
            broken inside the phone-frame, so this can't be an overlay.
            Leaving anyway doesn't save any resume state: the sequence is
            already cached whole, so next visit just starts over from the
            story card. */}
        {confirmingExit && (
          <Card className="flex flex-col gap-2 border-[var(--color-attention)] p-3">
            <p className="text-sm text-[var(--color-on-surface)]">
              Leave this lesson? You haven&apos;t finished all the challenges, and you&apos;ll start from the
              beginning next time.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmingExit(false)}
                className="rounded-[var(--radius-sm)] px-3 py-1.5 text-sm text-[var(--color-on-surface-variant)]"
              >
                Stay
              </button>
              <button
                type="button"
                onClick={() => router.push("/learn")}
                className="rounded-[var(--radius-sm)] bg-[var(--color-error-container)] px-3 py-1.5 text-sm font-medium text-[var(--color-error)]"
              >
                Leave anyway
              </button>
            </div>
          </Card>
        )}
      </header>

      <Card variant="elevated" className="flex flex-col gap-2 p-5">
        <h1 className="text-lg font-semibold text-[var(--color-on-surface)]">{lesson.title}</h1>
        <p className="text-sm leading-relaxed text-[var(--color-on-surface-variant)]">{lesson.body}</p>
        {activeProfile && (
          <button
            type="button"
            onClick={() => router.push(`/learn/${lesson.id}/class`)}
            className="mt-1 self-start rounded-[var(--radius-pill)] border border-[var(--color-primary)] px-3.5 py-2 text-sm font-semibold text-[var(--color-primary-dark)]"
          >
            Take this as a live class instead
          </button>
        )}
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
              onAnswered={(id) => setAnsweredBlockIds((prev) => new Set(prev).add(id))}
            />
          ))}
      </div>
    </main>
  );
}