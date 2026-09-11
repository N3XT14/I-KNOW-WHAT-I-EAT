import Card from "@/components/ui/Card";
import Mascot from "@/components/learn/Mascot";
import type { StoryBlock } from "@/types/learnContent";

// Tinted (vs. the plain-surface challenge cards) so the lesson's opening
// hook visually reads as "the mascot talking to you" rather than another
// quiz card — it's the one block kind where the mascot IS the content,
// not a reaction to something the reader just did.
export default function StoryBlockView({ block }: { block: StoryBlock }) {
  return (
    <Card className="flex flex-col gap-2 border-[var(--color-primary-container)] bg-[var(--color-primary-container)]/40 p-4">
      <Mascot pose="neutral_walk" size="md" line={block.text} />
      {block.mascotLine && (
        <p className="pl-16 text-xs italic text-[var(--color-on-surface-variant)]">{block.mascotLine}</p>
      )}
    </Card>
  );
}