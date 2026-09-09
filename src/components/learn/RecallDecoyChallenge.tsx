"use client";

import { useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import type { Profile } from "@/types/profile";
import type { NutrientKey } from "@/types/nutrientLimits";
import { createChallengeAttempt, type RecallDecoyAttempt } from "@/types/challengeAttempt";
import { saveChallengeAttempt, findPriorAttempt } from "@/lib/challengeAttempts";
import { refreshTutorTip } from "@/lib/tutorTip";
import type { FoodEvent } from "@/types/foodEvent";
import type { EligibleFood } from "@/lib/challengePool";
import type { SeedItem } from "@/lib/seedLabels";

function shuffled<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// A real logged food vs. a similar-sounding product from the seed
// library that was never actually scanned — tests recall of what was
// really eaten, not nutrition knowledge. `decoys` is pre-filtered by
// challengePool.decoyCandidates to exclude anything this profile has
// genuinely logged, so the correct answer is never ambiguous.
export default function RecallDecoyChallenge({
  nutrient,
  lessonId,
  profile,
  events,
  real,
  decoys,
}: {
  nutrient: NutrientKey;
  lessonId: string;
  profile: Profile;
  events: FoodEvent[];
  real: EligibleFood;
  decoys: SeedItem[];
}) {
  const decoy = useMemo(
    () => decoys[Math.floor(Math.random() * decoys.length)],
    [decoys],
  );
  const options = useMemo(
    () =>
      shuffled([
        { id: real.event.id, label: real.productName, isReal: true },
        { id: decoy.id, label: decoy.title, isReal: false },
      ]),
    [real, decoy],
  );

  const [guessedId, setGuessedId] = useState<string | null>(null);
  const prior = findPriorAttempt(profile.id, lessonId, "recall-decoy", [real.event.id]);
  const answered = guessedId !== null;
  const correct = answered && guessedId === real.event.id;

  function tap(id: string) {
    if (answered) return;
    setGuessedId(id);
    saveChallengeAttempt(
      createChallengeAttempt<RecallDecoyAttempt>({
        kind: "recall-decoy",
        profileId: profile.id,
        lessonId,
        nutrient,
        realFoodEventId: real.event.id,
        decoyProductName: decoy.title,
        guessedId: id,
        correct: id === real.event.id,
      }),
    );
    refreshTutorTip(profile, events);
  }

  return (
    <Card className="flex flex-col gap-4 p-4">
      <div>
        <h3 className="text-sm font-semibold text-[var(--color-on-surface)]">
          Which one did {profile.name} actually scan?
        </h3>
        {prior && (
          <Badge tone="neutral">
            Tried this food before{prior.correct ? " · got it right" : ""}
          </Badge>
        )}
        <p className="mt-1 text-sm text-[var(--color-on-surface-variant)]">
          One of these was really logged — the other is just similar. Pick the real one.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {options.map((option) => {
          const isSelected = guessedId === option.id;
          return (
            <button
              key={option.id}
              type="button"
              disabled={answered}
              onClick={() => tap(option.id)}
              className={`rounded-[var(--radius-md)] border px-3 py-2.5 text-left text-sm transition-colors ${
                answered
                  ? option.isReal
                    ? "border-[var(--color-primary)] bg-[var(--color-primary-container)] text-[var(--color-primary-dark)]"
                    : isSelected
                      ? "border-[var(--color-error)] bg-[var(--color-error-container)] text-[var(--color-error)]"
                      : "border-[var(--color-outline)] text-[var(--color-on-surface)]"
                  : isSelected
                    ? "border-[var(--color-error)] bg-[var(--color-error-container)] text-[var(--color-error)]"
                    : "border-[var(--color-outline)] text-[var(--color-on-surface)]"
              } ${answered ? "cursor-default" : ""}`}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {answered && (
        <div className="flex flex-col gap-2 border-t border-[var(--color-outline)] pt-3">
          <Badge tone={correct ? "primary" : "attention"}>
            {correct
              ? "Right — that's the one you logged."
              : "Not quite — that one wasn't logged."}
          </Badge>
          <Button variant="outline" className="w-fit" onClick={() => setGuessedId(null)}>
            Try again
          </Button>
        </div>
      )}
    </Card>
  );
}