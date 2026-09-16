"use client";

import { useEffect, useState } from "react";
import type { Profile } from "@/types/profile";
import type { FoodEvent } from "@/types/foodEvent";
import { currentAgeBand, profileLanguage } from "@/types/profile";
import type { NutrientMastery } from "@/lib/streaks";
import { eligibleFoodsForNutrient } from "@/lib/challengePool";
import { pickWeakNutrient, tutorTipCacheKey, getCachedTip, setCachedTip } from "@/lib/tutorTip";
import { nutrientLabel } from "@/lib/nutrientLabels";
import type { TutorTipApiResponse } from "@/types/tutorTip";
import Mascot from "@/components/learn/Mascot";

// The "personal health tutor" card on the Learn hub. Purely a READER —
// generation happens elsewhere, right when a challenge is answered (see
// lib/tutorTip.ts's refreshTutorTip, called from the four challenge
// components), not from this component being mounted. That's what makes
// this instant on every visit instead of refetching and flickering
// "thinking…" each time the Learn page is opened: by the time someone
// gets here, the tip for the current weak-nutrient state is normally
// already sitting in cache.
//
// The only time this component itself calls the API is the cold-start
// case — a weak-nutrient state that has genuinely never been coached on
// before (e.g. right after this feature first shipped, for someone who
// already had challenge history). That's a one-time self-heal, not the
// normal path.
export default function TutorTip({
  profile,
  events,
  mastery,
}: {
  profile: Profile;
  events: FoodEvent[];
  mastery: NutrientMastery[];
}) {
  const language = profileLanguage(profile);
  const picked = pickWeakNutrient(mastery);
  const cacheKey = picked ? tutorTipCacheKey(profile.id, picked.weak, language) : null;

  // Lazy init reads the cache synchronously on first render — no flash of
  // an empty card while an effect catches up, since this is a plain
  // localStorage read, not a fetch.
  const [tip, setTip] = useState<string | null>(() => (cacheKey ? getCachedTip(cacheKey) : null));
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  useEffect(() => {
    if (!picked || !cacheKey) {
      setTip(null);
      return;
    }

    const cached = getCachedTip(cacheKey);
    if (cached) {
      setTip(cached);
      setStatus("idle");
      return;
    }

    // Cold start only — see the component doc comment above.
    const eligible = eligibleFoodsForNutrient(events, profile, picked.weak.nutrient);
    const recentFoods = eligible
      .slice(0, 3)
      .map((f) => ({ productName: f.productName, percentOfLimit: f.evaluation.percentOfLimit }));

    let cancelled = false;
    setStatus("loading");

    fetch("/api/tutor-tip", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        profileName: profile.name,
        ageBand: currentAgeBand(profile.dob),
        weakNutrient: nutrientLabel(picked.weak.nutrient, language),
        accuracy: picked.weak.accuracy,
        attempted: picked.weak.attempted,
        strongNutrient: picked.strong
          ? { nutrient: nutrientLabel(picked.strong.nutrient, language), accuracy: picked.strong.accuracy }
          : null,
        recentFoods,
        language,
      }),
    })
      .then((res) => res.json() as Promise<TutorTipApiResponse>)
      .then((data) => {
        if (cancelled) return;
        if (data.ok) {
          setTip(data.tip);
          setCachedTip(cacheKey, data.tip);
          setStatus("idle");
        } else {
          setStatus("error");
        }
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);

  if (!picked) return null;
  if (status === "error" && !tip) return null; // quiet failure — the mastery card above already shows the raw numbers

  return (
    <Mascot
      pose="sit_cross_legged"
      size="md"
      line={status === "loading" && !tip ? "Thinking about your progress…" : (tip ?? "")}
    />
  );
}