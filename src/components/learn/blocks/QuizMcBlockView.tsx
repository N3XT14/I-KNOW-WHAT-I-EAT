"use client";

import { useState } from "react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import type { QuizMcBlock } from "@/types/learnContent";
import type { Profile } from "@/types/profile";
import type { FoodEvent } from "@/types/foodEvent";
import type { NutrientKey } from "@/types/nutrientLimits";
import { recordGeneratedAttempt } from "@/lib/generatedAttempt";

export default function QuizMcBlockView({
  block,
  profile,
  events,
  lessonId,
  nutrient,
}: {
  block: QuizMcBlock;
  profile: Profile;
  events: FoodEvent[];
  lessonId: string;
  nutrient: NutrientKey;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const answered = selected !== null;
  const correct = answered && selected === block.correctOptionId;

  function pick(id: string) {
    setSelected(id);
    recordGeneratedAttempt(profile, events, lessonId, nutrient, "quiz-mc", block.id, id === block.correctOptionId);
  }

  return (
    <Card className="flex flex-col gap-3 p-4">
      <p className="text-sm text-[var(--color-on-surface)]">{block.prompt}</p>
      <div className="flex flex-col gap-2">
        {block.options.map((o) => {
          const isSelected = selected === o.id;
          const isCorrect = answered && o.id === block.correctOptionId;
          return (
            <button
              key={o.id}
              type="button"
              disabled={answered}
              onClick={() => pick(o.id)}
              className={`rounded-[var(--radius-md)] border px-3 py-2 text-left text-sm transition-colors ${
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
        <div className="flex flex-col gap-2 border-t border-[var(--color-outline)] pt-3">
          <Badge tone={correct ? "primary" : "attention"}>{correct ? "Nice — that's right." : "Not quite."}</Badge>
          <p className="text-sm text-[var(--color-on-surface)]">{block.explanation}</p>
        </div>
      )}
    </Card>
  );
}
