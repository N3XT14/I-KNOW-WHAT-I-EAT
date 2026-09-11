"use client";

import { useState } from "react";
import Card from "@/components/ui/Card";
import Mascot from "@/components/learn/Mascot";
import OptionButton from "./OptionButton";
import DifficultyBadge from "./DifficultyBadge";
import type { SpotTheTrickBlock } from "@/types/learnContent";
import type { Profile } from "@/types/profile";
import type { FoodEvent } from "@/types/foodEvent";
import type { NutrientKey } from "@/types/nutrientLimits";
import { recordGeneratedAttempt } from "@/lib/generatedAttempt";

const OPTIONS = [
  { value: true, label: "Misleading" },
  { value: false, label: "Accurate" },
];
const LETTERS = ["A", "B"];

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
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-[var(--color-on-surface)]">{block.prompt}</p>
        <DifficultyBadge difficulty={block.difficulty} />
      </div>
      <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-variant)] px-3 py-2 text-sm font-medium italic text-[var(--color-on-surface)]">
        &ldquo;{block.claimText}&rdquo;
      </div>
      <div className="grid grid-cols-2 gap-2">
        {OPTIONS.map((option, i) => (
          <OptionButton
            key={option.label}
            letter={LETTERS[i]}
            label={option.label}
            disabled={answered}
            onClick={() => pick(option.value)}
            state={
              !answered
                ? "idle"
                : option.value === block.isMisleading
                  ? "correct"
                  : option.value === guess
                    ? "incorrect"
                    : "muted"
            }
          />
        ))}
      </div>
      {answered && (
        <div className="border-t border-[var(--color-outline)] pt-3">
          <Mascot pose={correct ? "celebrate_jump" : "shy_nervous"} size="sm" line={block.explanation} />
        </div>
      )}
    </Card>
  );
}