import { createChallengeAttempt, type GeneratedAttempt } from "@/types/challengeAttempt";
import { saveChallengeAttempt } from "@/lib/challengeAttempts";
import { refreshTutorTip } from "@/lib/tutorTip";
import type { Profile } from "@/types/profile";
import type { FoodEvent } from "@/types/foodEvent";
import type { NutrientKey } from "@/types/nutrientLimits";

export function recordGeneratedAttempt(
  profile: Profile,
  events: FoodEvent[],
  lessonId: string,
  nutrient: NutrientKey,
  blockKind: string,
  blockId: string,
  correct: boolean,
): void {
  saveChallengeAttempt(
    createChallengeAttempt<GeneratedAttempt>({
      kind: "generated",
      profileId: profile.id,
      lessonId,
      nutrient,
      blockKind,
      blockId,
      correct,
    }),
  );
  refreshTutorTip(profile, events);
}