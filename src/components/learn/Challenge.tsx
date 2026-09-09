"use client";

import { useState } from "react";
import Card from "@/components/ui/Card";
import type { Profile } from "@/types/profile";
import type { FoodEvent } from "@/types/foodEvent";
import type { NutrientKey } from "@/types/nutrientLimits";
import { eligibleFoodsForNutrient, decoyCandidates } from "@/lib/challengePool";
import { pickChallengeKind } from "@/lib/challengeSelection";
import { nutrientLabel } from "@/lib/nutrientLabels";
import BucketGuessChallenge from "./BucketGuessChallenge";
import RankChallenge from "./RankChallenge";
import OddOneOutChallenge from "./OddOneOutChallenge";
import RecallDecoyChallenge from "./RecallDecoyChallenge";

// Router: picks which applied-challenge format to run for this lesson,
// then hands off to the matching component. The pick happens once per
// mount (useState initializer, not recomputed each render) so answering
// mid-challenge never causes the format to change under someone's
// fingers — the call site (learn/[lessonId]/page.tsx) keys this
// component by lesson+profile so switching either one gets a fresh pick.
//
// `events` is threaded all the way down to each challenge component
// (not just used here) because answering a challenge triggers
// lib/tutorTip.ts's refreshTutorTip right at that moment — the tutor
// needs the full scan history to pick real supporting foods for whatever
// nutrient turns out to be the current weak spot, which may not be this
// challenge's nutrient.
export default function Challenge({
  nutrient,
  lessonId,
  profile,
  events,
}: {
  nutrient: NutrientKey;
  lessonId: string;
  profile: Profile;
  events: FoodEvent[];
}) {
  const eligible = eligibleFoodsForNutrient(events, profile, nutrient);
  const decoys = decoyCandidates(eligible, nutrient);

  const [kind] = useState(() => pickChallengeKind(eligible.length, decoys.length > 0));

  if (!kind) {
    return (
      <Card className="flex flex-col gap-2 p-4">
        <p className="text-sm text-[var(--color-on-surface-variant)]">
          Scan and log a food that lists {nutrientLabel(nutrient)} for{" "}
          {profile.name} to try this challenge — nothing logged yet has it on
          the label.
        </p>
      </Card>
    );
  }

  if (kind === "bucket-guess") {
    return (
      <BucketGuessChallenge
        nutrient={nutrient}
        lessonId={lessonId}
        profile={profile}
        events={events}
        food={eligible[0]}
      />
    );
  }

  if (kind === "rank") {
    return (
      <RankChallenge
        nutrient={nutrient}
        lessonId={lessonId}
        profile={profile}
        events={events}
        eligible={eligible}
      />
    );
  }

  if (kind === "odd-one-out") {
    return (
      <OddOneOutChallenge
        nutrient={nutrient}
        lessonId={lessonId}
        profile={profile}
        events={events}
        eligible={eligible}
      />
    );
  }

  return (
    <RecallDecoyChallenge
      nutrient={nutrient}
      lessonId={lessonId}
      profile={profile}
      events={events}
      real={eligible[0]}
      decoys={decoys}
    />
  );
}