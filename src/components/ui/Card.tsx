/**
 * `variant="elevated"` bumps up to --shadow-card for surfaces that should
 * read as the primary focus of a page (e.g. the profile card at the top of
 * Account) — everything else defaults to the flatter --shadow-subtle so
 * elevation still communicates hierarchy instead of every card looking
 * equally "loud".
 */
export default function Card({
  children,
  className = "",
  variant = "subtle",
}: {
  children: React.ReactNode;
  className?: string;
  variant?: "subtle" | "elevated";
}) {
  const shadow = variant === "elevated" ? "shadow-card" : "shadow-subtle";

  return (
    <div
      className={`rounded-[var(--radius-lg)] border border-[var(--color-outline)] bg-[var(--color-surface)] ${shadow} ${className}`}
    >
      {children}
    </div>
  );
}
