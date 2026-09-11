"use client";

import { useState } from "react";
import Card from "@/components/ui/Card";
import Mascot from "@/components/learn/Mascot";
import OptionButton from "./OptionButton";
import DifficultyBadge from "./DifficultyBadge";
import type { DecoyBlock } from "@/types/learnContent";
import type { Profile } from "@/types/profile";
import type { FoodEvent } from "@/types/foodEvent";
import type { NutrientKey } from "@/types/nutrientLimits";
import { recordGeneratedAttempt } from "@/lib/generatedAttempt";

const LETTERS = ["A", "B"];

export default function DecoyBlockView({
  block,
  profile,
  events,
  lessonId,
  nutrient,
  onAnswered,
}: {
  block: DecoyBlock;
  profile: Profile;
  events: FoodEvent[];
  lessonId: string;
  nutrient: NutrientKey;
  onAnswered?: (blockId: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const answered = selected !== null;
  const correct = answered && selected === block.real.foodEventId;
  const options = [
    { id: block.real.foodEventId, label: block.real.label },
    { id: "decoy", label: block.decoy.label },
  ];

  function pick(id: string) {
    setSelected(id);
    recordGeneratedAttempt(profile, events, lessonId, nutrient, "decoy", block.id, id === block.real.foodEventId);
    onAnswered?.(block.id);
  }

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-[var(--color-on-surface)]">{block.prompt}</p>
        <DifficultyBadge difficulty={block.difficulty} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {options.map((o, i) => (
          <OptionButton
            key={o.id}
            letter={LETTERS[i] ?? String(i + 1)}
            label={o.label}
            disabled={answered}
            onClick={() => pick(o.id)}
            state={
              !answered
                ? "idle"
                : o.id === block.real.foodEventId
                  ? "correct"
                  : o.id === selected
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