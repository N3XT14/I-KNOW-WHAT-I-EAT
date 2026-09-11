import Image from "next/image";

// The 6 poses cropped from the sprite sheet last round. Files expected at
// public/mascot/<pose>.png — transparent PNGs, consistent camera angle.
export type MascotPose =
  | "neutral_walk"
  | "celebrate_jump"
  | "heart_hug"
  | "sit_cross_legged"
  | "run_dash"
  | "shy_nervous";

export const POSE_SRC: Record<MascotPose, string> = {
  neutral_walk: "/mascot/neutral_walk.png",
  celebrate_jump: "/mascot/celebrate_jump.png",
  heart_hug: "/mascot/heart_hug.png",
  sit_cross_legged: "/mascot/sit_cross_legged.png",
  run_dash: "/mascot/run_dash.png",
  shy_nervous: "/mascot/shy_nervous.png",
};

const SIZE_PX: Record<"sm" | "md" | "lg", number> = {
  sm: 40,
  md: 56,
  lg: 88,
};

export default function Mascot({
  line,
  pose = "neutral_walk",
  size = "md",
}: {
  line: string;
  pose?: MascotPose;
  size?: "sm" | "md" | "lg";
}) {
  const px = SIZE_PX[size];
  return (
    <div className="flex items-start gap-2">
      <Image
        src={POSE_SRC[pose]}
        alt=""
        width={px}
        height={px}
        className="flex-shrink-0"
        aria-hidden
      />
      <p className="flex-1 rounded-[var(--radius-md)] bg-[var(--color-primary-container)] px-3 py-2 text-sm text-[var(--color-primary-dark)]">
        {line}
      </p>
    </div>
  );
}