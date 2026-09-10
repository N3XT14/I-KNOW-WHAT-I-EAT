import Card from "@/components/ui/Card";
import Mascot from "@/components/learn/Mascot";
import type { StoryBlock } from "@/types/learnContent";

export default function StoryBlockView({ block }: { block: StoryBlock }) {
  return (
    <Card className="flex flex-col gap-3 p-4">
      <p className="text-sm text-[var(--color-on-surface)]">{block.text}</p>
      {block.mascotLine && <Mascot line={block.mascotLine} size="sm" />}
    </Card>
  );
}
