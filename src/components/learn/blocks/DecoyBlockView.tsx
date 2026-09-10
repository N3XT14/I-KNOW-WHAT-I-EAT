"use client";

import { useState } from "react";
import Card from "@/components/ui/Card";
import Mascot from "@/components/learn/Mascot";
import type { DecoyBlock } from "@/types/learnContent";
import type { Profile } from "@/types/profile";
import type { FoodEvent } from "@/types/foodEvent";
import type { NutrientKey } from "@/types/nutrientLimits";
import { recordGeneratedAttempt } from "@/lib/generatedAttempt";

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
      <p className="text-sm text-[var(--color-on-surface)]">{block.prompt}</p>
      <div className="grid grid-cols-2 gap-2">
        {options.map((o) => {
          const isSelected = selected === o.id;
          const isCorrect = answered && o.id === block.real.foodEventId;
          return (
            <button
              key={o.id}
              type="button"
              disabled={answered}
              onClick={() => pick(o.id)}
              className={`rounded-[var(--radius-md)] border px-3 py-2.5 text-sm transition-colors ${
                isCorrect
                  ? "border-[var(--color-primary)] bg-[var(--color-primary-container)] text-[var(--color-primary-dark)]"
                  : isSelected
                    ? "border-[var(--color-error)] bg-[var(--color-error-container)] text-[var(--color-error)]"
                    : "border-[var(--color-outline)] text-[var(--color-on-surface)]"
              }`}
            >
              {o.label}
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