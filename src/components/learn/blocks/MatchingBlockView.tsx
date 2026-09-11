"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import Card from "@/components/ui/Card";
import DifficultyBadge from "./DifficultyBadge";
import type { MatchingBlock } from "@/types/learnContent";

export default function MatchingBlockView({ block }: { block: MatchingBlock }) {
  const [revealed, setRevealed] = useState<Set<number>>(new Set());

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-[var(--color-on-surface)]">{block.prompt}</p>
        <DifficultyBadge difficulty={block.difficulty} />
      </div>
      <div className="flex flex-col gap-2">
        {block.pairs.map((pair, i) => {
          const open = revealed.has(i);
          return (
            <button
              key={pair.term}
              type="button"
              onClick={() => setRevealed((prev) => new Set(prev).add(i))}
              className={`rounded-[var(--radius-md)] border px-3 py-2.5 text-left text-sm transition-colors ${
                open
                  ? "border-[var(--color-primary)] bg-[var(--color-primary-container)]"
                  : "border-[var(--color-outline)]"
              }`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className={`font-semibold ${open ? "text-[var(--color-primary-dark)]" : "text-[var(--color-on-surface)]"}`}>
                  {pair.term}
                </span>
                {!open && <ChevronDown className="h-4 w-4 shrink-0 text-[var(--color-on-surface-variant)]" />}
              </span>
              {open && <span className="mt-1 block text-[var(--color-on-surface-variant)]">{pair.meaning}</span>}
            </button>
          );
        })}
      </div>
    </Card>
  );
}