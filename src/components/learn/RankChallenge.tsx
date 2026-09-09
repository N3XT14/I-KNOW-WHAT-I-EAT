"use client";

import { useEffect, useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import type { Profile } from "@/types/profile";
import type { NutrientKey } from "@/types/nutrientLimits";
import type { FoodEvent } from "@/types/foodEvent";
import { createChallengeAttempt, type RankAttempt } from "@/types/challengeAttempt";
import { saveChallengeAttempt, findPriorAttempt } from "@/lib/challengeAttempts";
import { refreshTutorTip } from "@/lib/tutorTip";
import { nutrientLabel } from "@/lib/nutrientLabels";
import { pickRankTriple, type EligibleFood } from "@/lib/challengePool";
import { getLastShownIds, setLastShownIds } from "@/lib/challengeHistory";

// Tap three real logged foods in order, highest nutrient first. Needs
// eligible.length >= 3 — Challenge.tsx only ever renders this once that's
// confirmed true.
export default function RankChallenge({
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
  // Picked once per mount, avoiding an exact repeat of whatever trio was
  // last shown for this lesson+profile when the pool is large enough to
  // offer a different one (see lib/challengeHistory.ts).
  const items = useMemo(() => {
    const avoid = getLastShownIds(lessonId, profile.id, "rank");
    return pickRankTriple(eligible, avoid);
  }, [eligible, lessonId, profile.id]);

  useEffect(() => {
    setLastShownIds(
      lessonId,
      profile.id,
      "rank",
      items.map((i) => i.event.id),
    );
  }, [items, lessonId, profile.id]);

  const actualOrder = useMemo(
    () =>
      [...items]
        .sort((a, b) => b.evaluation.percentOfLimit - a.evaluation.percentOfLimit)
        .map((i) => i.event.id),
    [items],
  );

  const [guessedOrder, setGuessedOrder] = useState<string[]>([]);
  const prior = findPriorAttempt(
    profile.id,
    lessonId,
    "rank",
    items.map((i) => i.event.id),
  );
  const answered = guessedOrder.length === items.length;
  const correct = answered && guessedOrder.every((id, i) => id === actualOrder[i]);

  function tap(id: string) {
    if (answered || guessedOrder.includes(id)) return;
    const next = [...guessedOrder, id];
    setGuessedOrder(next);
    if (next.length === items.length) {
      saveChallengeAttempt(
        createChallengeAttempt<RankAttempt>({
          kind: "rank",
          profileId: profile.id,
          lessonId,
          nutrient,
          foodEventIds: items.map((i) => i.event.id),
          guessedOrder: next,
          actualOrder,
          correct: next.every((id, i) => id === actualOrder[i]),
        }),
      );
      refreshTutorTip(profile, events);
    }
  }

  return (
    <Card className="flex flex-col gap-4 p-4">
      <div>
        <h3 className="text-sm font-semibold text-[var(--color-on-surface)]">
          Rank by {nutrientLabel(nutrient)}
        </h3>
        {prior && (
          <Badge tone="neutral">
            Tried this set before{prior.correct ? " · got it right" : ""}
          </Badge>
        )}
        <p className="mt-1 text-sm text-[var(--color-on-surface-variant)]">
          Tap these in order, highest {nutrientLabel(nutrient)} first — foods{" "}
          {profile.name} actually logged.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {items.map((item) => {
          const guessPosition = guessedOrder.indexOf(item.event.id);
          const isPicked = guessPosition !== -1;
          const isCorrectSlot = answered && actualOrder[guessPosition] === item.event.id;
          return (
            <button
              key={item.event.id}
              type="button"
              disabled={answered}
              onClick={() => tap(item.event.id)}
              className={`flex items-center justify-between rounded-[var(--radius-md)] border px-3 py-2.5 text-left text-sm transition-colors ${
                answered
                  ? isCorrectSlot
                    ? "border-[var(--color-primary)] bg-[var(--color-primary-container)] text-[var(--color-primary-dark)]"
                    : "border-[var(--color-error)] bg-[var(--color-error-container)] text-[var(--color-error)]"
                  : isPicked
                    ? "border-[var(--color-primary)] text-[var(--color-on-surface)]"
                    : "border-[var(--color-outline)] text-[var(--color-on-surface)]"
              } ${answered ? "cursor-default" : ""}`}
            >
              <span>{item.productName}</span>
              {isPicked && <span className="text-xs">#{guessPosition + 1}</span>}
            </button>
          );
        })}
      </div>

      {answered && (
        <div className="flex flex-col gap-2 border-t border-[var(--color-outline)] pt-3">
          <Badge tone={correct ? "primary" : "attention"}>
            {correct ? "Nice — that's the right order." : "Not quite the right order."}
          </Badge>
          <ul className="flex flex-col gap-1 text-xs text-[var(--color-on-surface-variant)]">
            {actualOrder.map((id, i) => {
              const item = items.find((it) => it.event.id === id)!;
              return (
                <li key={id}>
                  {i + 1}. {item.productName} — {item.evaluation.percentOfLimit}% of daily limit
                </li>
              );
            })}
          </ul>
          <Button variant="outline" className="w-fit" onClick={() => setGuessedOrder([])}>
            Try again
          </Button>
        </div>
      )}
    </Card>
  );
}