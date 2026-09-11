"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import Card from "@/components/ui/Card";
import Mascot from "@/components/learn/Mascot";
import DifficultyBadge from "./DifficultyBadge";
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
  onAnswered,
}: {
  block: RankedListBlock;
  profile: Profile;
  events: FoodEvent[];
  lessonId: string;
  nutrient: NutrientKey;
  onAnswered?: (blockId: string) => void;
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
      onAnswered?.(block.id);
    }
  }

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-[var(--color-on-surface)]">{block.prompt}</p>
        <DifficultyBadge difficulty={block.difficulty} />
      </div>
      <div className="flex flex-col gap-2">
        {block.items.map((item) => {
          const position = tapped.indexOf(item.foodEventId);
          const isPlaced = position !== -1;
          const isRight = answered && correctOrder[position] === item.foodEventId;
          const containerStyle = !answered
            ? "border-[var(--color-outline)] text-[var(--color-on-surface)]"
            : isRight
              ? "border-[var(--color-good)] bg-[var(--color-good-container)] text-[var(--color-good)]"
              : "border-[var(--color-error)] bg-[var(--color-error-container)] text-[var(--color-error)]";
          const badgeStyle = !answered
            ? "border-[var(--color-outline)] text-[var(--color-on-surface-variant)]"
            : isRight
              ? "border-[var(--color-good)] bg-[var(--color-good)] text-white"
              : "border-[var(--color-error)] bg-[var(--color-error)] text-white";
          return (
            <button
              key={item.foodEventId}
              type="button"
              disabled={isPlaced || answered}
              onClick={() => tap(item.foodEventId)}
              className={`flex items-center gap-2.5 rounded-[var(--radius-md)] border px-3 py-2.5 text-left text-sm transition-colors disabled:cursor-default ${containerStyle}`}
            >
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold ${badgeStyle}`}
              >
                {isPlaced ? (answered ? isRight ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" /> : position + 1) : ""}
              </span>
              <span className="flex-1">{item.label}</span>
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