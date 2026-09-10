"use client";

import { useState } from "react";
import Card from "@/components/ui/Card";
import Mascot from "@/components/learn/Mascot";
import type { SpotTheTrickBlock } from "@/types/learnContent";
import type { Profile } from "@/types/profile";
import type { FoodEvent } from "@/types/foodEvent";
import type { NutrientKey } from "@/types/nutrientLimits";
import { recordGeneratedAttempt } from "@/lib/generatedAttempt";

export default function SpotTheTrickBlockView({
  block,
  profile,
  events,
  lessonId,
  nutrient,
  onAnswered,
}: {
  block: SpotTheTrickBlock;
  profile: Profile;
  events: FoodEvent[];
  lessonId: string;
  nutrient: NutrientKey;
  onAnswered?: (blockId: string) => void;
}) {
  const [guess, setGuess] = useState<boolean | null>(null);
  const answered = guess !== null;
  const correct = answered && guess === block.isMisleading;

  function pick(value: boolean) {
    setGuess(value);
    recordGeneratedAttempt(profile, events, lessonId, nutrient, "spot-the-trick", block.id, value === block.isMisleading);
    onAnswered?.(block.id);
  }

  return (
    <Card className="flex flex-col gap-3 p-4">
      <p className="text-sm text-[var(--color-on-surface)]">{block.prompt}</p>
      <div className="rounded-[var(--radius-md)] border border-[var(--color-outline)] px-3 py-2 text-sm font-semibold text-[var(--color-on-surface)]">
        &ldquo;{block.claimText}&rdquo;
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[
          { value: true, label: "Misleading" },
          { value: false, label: "Accurate" },
        ].map((option) => {
          const isSelected = guess === option.value;
          const isActual = answered && option.value === block.isMisleading;
          return (
            <button
              key={option.label}
              type="button"
              disabled={answered}
              onClick={() => pick(option.value)}
              className={`rounded-[var(--radius-md)] border px-3 py-2.5 text-sm transition-colors ${
                isActual
                  ? "border-[var(--color-primary)] bg-[var(--color-primary-container)] text-[var(--color-primary-dark)]"
                  : isSelected
                    ? "border-[var(--color-error)] bg-[var(--color-error-container)] text-[var(--color-error)]"
                    : "border-[var(--color-outline)] text-[var(--color-on-surface)]"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      {answered && (
        <div className="border-t border-[var(--color-outline)] pt-3">
          <Mascot pose={correct ? "celebrate_jump" : "shy_nervous"} size="sm" line={block.explanation} />
        </div>
      )}
    </Card>
  );
}