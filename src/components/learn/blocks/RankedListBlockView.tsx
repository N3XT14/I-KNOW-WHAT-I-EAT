"use client";

import { useState } from "react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import type { RankedListBlock } from "@/types/learnContent";
import type { Profile } from "@/types/profile";
import type { FoodEvent } from "@/types/foodEvent";
import type { NutrientKey } from "@/types/nutrientLimits";
import { recordGeneratedAttempt } from "@/lib/generatedAttempt";

export default function RankedListBlockView({
  block,
  profile,
  events,
  lessonId,
  nutrient,
}: {
  block: RankedListBlock;
  profile: Profile;
  events: FoodEvent[];
  lessonId: string;
  nutrient: NutrientKey;
}) {
  const [tapped, setTapped] = useState<string[]>([]);
  const answered = tapped.length === block.items.length;
  const correctOrder = [...block.items].sort((a, b) => b.value - a.value).map((i) => i.foodEventId);
  const correct = answered && tapped.every((id, i) => id === correctOrder[i]);

  function tap(id: string) {
    if (tapped.includes(id) || answered) return;
    const next = [...tapped, id];
    setTapped(next);
    if (next.length === block.items.length) {
      recordGeneratedAttempt(
        profile,
        events,
        lessonId,
        nutrient,
        "ranked-list",
        block.id,
        next.every((tid, i) => tid === correctOrder[i]),
      );
    }
  }

  return (
    <Card className="flex flex-col gap-3 p-4">
      <p className="text-sm text-[var(--color-on-surface)]">{block.prompt}</p>
      <div className="flex flex-col gap-2">
        {block.items.map((item) => {
          const position = tapped.indexOf(item.foodEventId);
          return (
            <button
              key={item.foodEventId}
              type="button"
              disabled={position !== -1 || answered}
              onClick={() => tap(item.foodEventId)}
              className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--color-outline)] px-3 py-2 text-left text-sm text-[var(--color-on-surface)] disabled:opacity-60"
            >
              <span>{item.label}</span>
              {position !== -1 && <span className="font-semibold">#{position + 1}</span>}
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
