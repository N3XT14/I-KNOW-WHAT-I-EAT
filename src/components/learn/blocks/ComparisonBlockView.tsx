"use client";

import { useState } from "react";
import Card from "@/components/ui/Card";
import Mascot from "@/components/learn/Mascot";
import OptionButton from "./OptionButton";
import DifficultyBadge from "./DifficultyBadge";
import type { ComparisonBlock } from "@/types/learnContent";
import type { Profile } from "@/types/profile";
import type { FoodEvent } from "@/types/foodEvent";
import type { NutrientKey } from "@/types/nutrientLimits";
import { recordGeneratedAttempt } from "@/lib/generatedAttempt";

const LETTERS = ["A", "B", "C", "D"];

export default function ComparisonBlockView({
  block,
  profile,
  events,
  lessonId,
  nutrient,
  onAnswered,
}: {
  block: ComparisonBlock;
  profile: Profile;
  events: FoodEvent[];
  lessonId: string;
  nutrient: NutrientKey;
  onAnswered?: (blockId: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const answered = selected !== null;
  const correct = answered && selected === block.correctLabel;

  function pick(label: string) {
    setSelected(label);
    recordGeneratedAttempt(profile, events, lessonId, nutrient, "comparison", block.id, label === block.correctLabel);
    onAnswered?.(block.id);
  }

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-[var(--color-on-surface)]">{block.prompt}</p>
        <DifficultyBadge difficulty={block.difficulty} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {block.items.map((item, i) => (
          <OptionButton
            key={item.label}
            letter={LETTERS[i] ?? String(i + 1)}
            label={item.label}
            sublabel={answered ? `${item.value}${item.unit}` : undefined}
            disabled={answered}
            onClick={() => pick(item.label)}
            state={
              !answered
                ? "idle"
                : item.label === block.correctLabel
                  ? "correct"
                  : item.label === selected
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