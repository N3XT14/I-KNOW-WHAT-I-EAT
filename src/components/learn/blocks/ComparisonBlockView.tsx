"use client";

import { useState } from "react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import type { ComparisonBlock } from "@/types/learnContent";
import type { Profile } from "@/types/profile";
import type { FoodEvent } from "@/types/foodEvent";
import type { NutrientKey } from "@/types/nutrientLimits";
import { recordGeneratedAttempt } from "@/lib/generatedAttempt";

export default function ComparisonBlockView({
  block,
  profile,
  events,
  lessonId,
  nutrient,
}: {
  block: ComparisonBlock;
  profile: Profile;
  events: FoodEvent[];
  lessonId: string;
  nutrient: NutrientKey;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const answered = selected !== null;
  const correct = answered && selected === block.correctLabel;

  function pick(label: string) {
    setSelected(label);
    recordGeneratedAttempt(profile, events, lessonId, nutrient, "comparison", block.id, label === block.correctLabel);
  }

  return (
    <Card className="flex flex-col gap-3 p-4">
      <p className="text-sm text-[var(--color-on-surface)]">{block.prompt}</p>
      <div className="grid grid-cols-2 gap-2">
        {block.items.map((item) => {
          const isSelected = selected === item.label;
          const isCorrect = answered && item.label === block.correctLabel;
          return (
            <button
              key={item.label}
              type="button"
              disabled={answered}
              onClick={() => pick(item.label)}
              className={`rounded-[var(--radius-md)] border px-3 py-2.5 text-sm transition-colors ${
                isCorrect
                  ? "border-[var(--color-primary)] bg-[var(--color-primary-container)] text-[var(--color-primary-dark)]"
                  : isSelected
                    ? "border-[var(--color-error)] bg-[var(--color-error-container)] text-[var(--color-error)]"
                    : "border-[var(--color-outline)] text-[var(--color-on-surface)]"
              }`}
            >
              {item.label}
              {answered && <span className="block text-xs opacity-80">{item.value}{item.unit}</span>}
            </button>
          );
        })}
      </div>
      {answered && (
        <div className="flex flex-col gap-2 border-t border-[var(--color-outline)] pt-3">
          <Badge tone={correct ? "primary" : "attention"}>{correct ? "Nice — that's right." : "Not quite."}</Badge>
          <p className="text-sm text-[var(--color-on-surface)]">{block.explanation}</p>
        </div>
      )}
    </Card>
  );
}
