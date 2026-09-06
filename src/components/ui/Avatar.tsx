/**
 * Initials-only for now — no confirmed name column on app_users or
 * doctor_profiles in the design reference doc (only email is certain), and
 * no photo upload feature exists yet either. Swap in a real name + photo
 * once those are confirmed; the initials fallback should stay as the
 * no-photo state either way.
 */
export default function Avatar({
  email,
  size = 36,
}: {
  email: string | null | undefined;
  size?: number;
}) {
  const initial = email?.trim()?.[0]?.toUpperCase() ?? "?";

  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-container)] font-semibold text-[var(--color-primary-dark)]"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initial}
    </div>
  );
}
