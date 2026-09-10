export default function Mascot({ line, size = "md" }: { line: string; size?: "sm" | "md" }) {
  return (
    <div className="flex items-start gap-2">
      <span className={size === "sm" ? "text-xl" : "text-2xl"} aria-hidden>
        🕵️
      </span>
      <p className="flex-1 rounded-[var(--radius-md)] bg-[var(--color-primary-container)] px-3 py-2 text-sm text-[var(--color-primary-dark)]">
        {line}
      </p>
    </div>
  );
}