"use client";

import { useEffect, useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import type { Profile } from "@/types/profile";
import type { NutrientKey } from "@/types/nutrientLimits";
import type { FoodEvent } from "@/types/foodEvent";
import { createChallengeAttempt, type OddOneOutAttempt } from "@/types/challengeAttempt";
import { saveChallengeAttempt, findPriorAttempt } from "@/lib/challengeAttempts";
import { refreshTutorTip } from "@/lib/tutorTip";
import { nutrientLabel } from "@/lib/nutrientLabels";
import { pickOddOneOutTriple, type EligibleFood } from "@/lib/challengePool";
import { getLastShownIds, setLastShownIds } from "@/lib/challengeHistory";

// Three real logged foods, one a clear outlier on the nutrient — spot it.
// Needs eligible.length >= 3; Challenge.tsx only renders this once that's
// confirmed true, so the null case below is a defensive fallback, not an
// expected path.
export default function OddOneOutChallenge({
  nutrient,
  lessonId,
  profile,
  events,
  eligible,
}: {
  nutrient: NutrientKey;
  lessonId: string;
  profile: Profile;
  events: FoodEvent[];
  eligible: EligibleFood[];
}) {
  // Prefers the best-scoring triple that isn't an exact repeat of
  // whatever was last shown for this lesson+profile (see
  // lib/challengeHistory.ts and lib/challengePool.ts's pickOddOneOutTriple).
  const triple = useMemo(() => {
    const avoid = getLastShownIds(lessonId, profile.id, "odd-one-out");
    return pickOddOneOutTriple(eligible, avoid);
  }, [eligible, lessonId, profile.id]);

  const [guessedId, setGuessedId] = useState<string | null>(null);

  useEffect(() => {
    if (!triple) return;
    setLastShownIds(
      lessonId,
      profile.id,
      "odd-one-out",
      triple.items.map((i) => i.event.id),
    );
  }, [triple, lessonId, profile.id]);

  if (!triple) return null;

  const { items, outlierId } = triple;
  const answered = guessedId !== null;
  const correct = answered && guessedId === outlierId;
  const outlierItem = items.find((i) => i.event.id === outlierId)!;
  const prior = findPriorAttempt(
    profile.id,
    lessonId,
    "odd-one-out",
    items.map((i) => i.event.id),
  );

  function tap(id: string) {
    if (answered) return;
    setGuessedId(id);
    saveChallengeAttempt(
      createChallengeAttempt<OddOneOutAttempt>({
        kind: "odd-one-out",
        profileId: profile.id,
        lessonId,
        nutrient,
        foodEventIds: items.map((i) => i.event.id),
        guessedOutlierId: id,
        actualOutlierId: outlierId,
        correct: id === outlierId,
      }),
    );
    refreshTutorTip(profile, events);
  }

  return (
    <Card className="flex flex-col gap-4 p-4">
      <div>
        <h3 className="text-sm font-semibold text-[var(--color-on-surface)]">
          Spot the outlier
        </h3>
        {prior && (
          <Badge tone="neutral">
            Tried this set before{prior.correct ? " · got it right" : ""}
          </Badge>
        )}
        <p className="mt-1 text-sm text-[var(--color-on-surface-variant)]">
          One of these foods {profile.name} logged has noticeably more{" "}
          {nutrientLabel(nutrient)} than the other two. Which one?
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {items.map((item) => {
          const isSelected = guessedId === item.event.id;
          const isOutlier = item.event.id === outlierId;
          return (
            <button
              key={item.event.id}
              type="button"
              disabled={answered}
              onClick={() => tap(item.event.id)}
              className={`flex items-center justify-between rounded-[var(--radius-md)] border px-3 py-2.5 text-left text-sm transition-colors ${
                answered
                  ? isOutlier
                    ? "border-[var(--color-primary)] bg-[var(--color-primary-container)] text-[var(--color-primary-dark)]"
                    : isSelected
                      ? "border-[var(--color-error)] bg-[var(--color-error-container)] text-[var(--color-error)]"
                      : "border-[var(--color-outline)] text-[var(--color-on-surface)]"
                  : isSelected
                    ? "border-[var(--color-error)] bg-[var(--color-error-container)] text-[var(--color-error)]"
                    : "border-[var(--color-outline)] text-[var(--color-on-surface)]"
              } ${answered ? "cursor-default" : ""}`}
            >
              <span>{item.productName}</span>
              {answered && (
                <span className="text-xs text-[var(--color-on-surface-variant)]">
                  {item.evaluation.percentOfLimit}%
                </span>
              )}
            </button>
          );
        })}
      </div>

      {answered && (
        <div className="flex flex-col gap-2 border-t border-[var(--color-outline)] pt-3">
          <Badge tone={correct ? "primary" : "attention"}>
            {correct ? "Nice — that's the outlier." : "Not quite."}
          </Badge>
          <p className="text-sm text-[var(--color-on-surface)]">
            {outlierItem.productName} used{" "}
            <strong>{outlierItem.evaluation.percentOfLimit}%</strong> of the
            daily limit — clearly more than the others.
          </p>
          <Button variant="outline" className="w-fit" onClick={() => setGuessedId(null)}>
            Try again
          </Button>
        </div>
      )}
    </Card>
  );
}