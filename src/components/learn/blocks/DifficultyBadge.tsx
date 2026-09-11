// Three dots, filled up to the block's difficulty (1-3). The field
// already existed on every challenge block but was never rendered —
// this is the first place it actually shows up in the UI.
export default function DifficultyBadge({ difficulty }: { difficulty?: 1 | 2 | 3 }) {
  if (!difficulty) return null;
  return (
    <div className="flex shrink-0 items-center gap-1 pt-1" aria-label={`Difficulty ${difficulty} of 3`}>
      {([1, 2, 3] as const).map((level) => (
        <span
          key={level}
          className={`h-1.5 w-1.5 rounded-full ${
            level <= difficulty ? "bg-[var(--color-primary)]" : "bg-[var(--color-outline)]"
          }`}
        />
      ))}
    </div>
  );
}