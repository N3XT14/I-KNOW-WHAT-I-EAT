"use client";

import { useState } from "react";
import Card from "@/components/ui/Card";
import type { MatchingBlock } from "@/types/learnContent";

export default function MatchingBlockView({ block }: { block: MatchingBlock }) {
  const [revealed, setRevealed] = useState<Set<number>>(new Set());

  return (
    <Card className="flex flex-col gap-3 p-4">
      <p className="text-sm text-[var(--color-on-surface)]">{block.prompt}</p>
      <div className="flex flex-col gap-2">
        {block.pairs.map((pair, i) => {
          const open = revealed.has(i);
          return (
            <button
              key={pair.term}
              type="button"
              onClick={() => setRevealed((prev) => new Set(prev).add(i))}
              className="rounded-[var(--radius-md)] border border-[var(--color-outline)] px-3 py-2 text-left text-sm"
            >
              <span className="font-semibold text-[var(--color-on-surface)]">{pair.term}</span>
              {open && <span className="mt-1 block text-[var(--color-on-surface-variant)]">{pair.meaning}</span>}
            </button>
          );
        })}
      </div>
    </Card>
  );
}
