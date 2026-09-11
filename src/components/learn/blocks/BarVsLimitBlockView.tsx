"use client";

import { useState } from "react";
import Card from "@/components/ui/Card";
import Mascot from "@/components/learn/Mascot";
import OptionButton from "./OptionButton";
import DifficultyBadge from "./DifficultyBadge";
import type { BarVsLimitBlock } from "@/types/learnContent";
import type { Profile } from "@/types/profile";
import type { FoodEvent } from "@/types/foodEvent";
import type { NutrientKey } from "@/types/nutrientLimits";
import { recordGeneratedAttempt } from "@/lib/generatedAttempt";

const LETTERS = ["A", "B"];

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
  const percentOfLimit = Math.round((block.value / block.limit) * 100);

  function pick(g: "over" | "under") {
    setGuess(g);
    recordGeneratedAttempt(profile, events, lessonId, nutrient, "bar-vs-limit", block.id, g === actual);
    onAnswered?.(block.id);
  }

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-[var(--color-on-surface)]">{block.prompt}</p>
        <DifficultyBadge difficulty={block.difficulty} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {(["under", "over"] as const).map((option, i) => (
          <OptionButton
            key={option}
            letter={LETTERS[i]}
            label={`${option[0].toUpperCase()}${option.slice(1)} the limit`}
            disabled={answered}
            onClick={() => pick(option)}
            state={
              !answered ? "idle" : option === actual ? "correct" : option === guess ? "incorrect" : "muted"
            }
          />
        ))}
      </div>
      {answered && (
        <div className="flex flex-col gap-2 border-t border-[var(--color-outline)] pt-3">
          <p className="text-sm text-[var(--color-on-surface)]">
            {block.label}: {block.value}{block.unit} vs a {block.limit}{block.unit} daily limit.
          </p>
          <div className="flex items-center gap-2">
            <div className="h-2 flex-1 overflow-hidden rounded-[var(--radius-pill)] bg-[var(--color-surface-variant)]">
              <div
                className={`h-full rounded-[var(--radius-pill)] ${
                  actual === "over" ? "bg-[var(--color-high)]" : "bg-[var(--color-good)]"
                }`}
                style={{ width: `${Math.min(100, percentOfLimit)}%` }}
              />
            </div>
            <span className="font-[family-name:var(--font-display)] text-xs font-semibold text-[var(--color-on-surface-variant)]">
              {percentOfLimit}%
            </span>
          </div>
          <Mascot pose={correct ? "celebrate_jump" : "shy_nervous"} size="sm" line={block.explanation} />
        </div>
      )}
    </Card>
  );
}