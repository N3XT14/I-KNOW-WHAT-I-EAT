"use client";

import { useState } from "react";
import Card from "@/components/ui/Card";
import Mascot from "@/components/learn/Mascot";
import type { BarVsLimitBlock } from "@/types/learnContent";
import type { Profile } from "@/types/profile";
import type { FoodEvent } from "@/types/foodEvent";
import type { NutrientKey } from "@/types/nutrientLimits";
import { recordGeneratedAttempt } from "@/lib/generatedAttempt";

export default function BarVsLimitBlockView({
  block,
  profile,
  events,
  lessonId,
  nutrient,
  onAnswered,
}: {
  block: BarVsLimitBlock;
  profile: Profile;
  events: FoodEvent[];
  lessonId: string;
  nutrient: NutrientKey;
  onAnswered?: (blockId: string) => void;
}) {
  const [guess, setGuess] = useState<"over" | "under" | null>(null);
  const actual: "over" | "under" = block.value > block.limit ? "over" : "under";
  const answered = guess !== null;
  const correct = answered && guess === actual;

  function pick(g: "over" | "under") {
    setGuess(g);
    recordGeneratedAttempt(profile, events, lessonId, nutrient, "bar-vs-limit", block.id, g === actual);
    onAnswered?.(block.id);
  }

  return (
    <Card className="flex flex-col gap-3 p-4">
      <p className="text-sm text-[var(--color-on-surface)]">{block.prompt}</p>
      <div className="grid grid-cols-2 gap-2">
        {(["under", "over"] as const).map((option) => {
          const isSelected = guess === option;
          const isActual = answered && option === actual;
          return (
            <button
              key={option}
              type="button"
              disabled={answered}
              onClick={() => pick(option)}
              className={`rounded-[var(--radius-md)] border px-3 py-2.5 text-sm capitalize transition-colors ${
                isActual
                  ? "border-[var(--color-primary)] bg-[var(--color-primary-container)] text-[var(--color-primary-dark)]"
                  : isSelected
                    ? "border-[var(--color-error)] bg-[var(--color-error-container)] text-[var(--color-error)]"
                    : "border-[var(--color-outline)] text-[var(--color-on-surface)]"
              }`}
            >
              {option} the limit
            </button>
          );
        })}
      </div>
      {answered && (
        <div className="flex flex-col gap-2 border-t border-[var(--color-outline)] pt-3">
          <p className="text-sm text-[var(--color-on-surface)]">
            {block.label}: {block.value}{block.unit} vs a {block.limit}{block.unit} daily limit.
          </p>
          <Mascot pose={correct ? "celebrate_jump" : "shy_nervous"} size="sm" line={block.explanation} />
        </div>
      )}
    </Card>
  );
}