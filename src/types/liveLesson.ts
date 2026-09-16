// A "live class" is a short, fixed-shape conversation with the mascot —
// teach once, check understanding once, one retry if needed, then a
// recap — as opposed to Learn Mode's stateless generated cards. The
// client owns the state machine (which phase comes next); the server's
// job is only to fill in content for whichever phase it's asked for,
// same "don't trust the model for control logic" split the rest of this
// app already uses (e.g. comparison blocks' correctLabel is computed
// server-side, not trusted from Gemini).

import type { NutrientKey } from "@/types/nutrientLimits";
import type { LearnFactsPacket } from "@/lib/learnContentPool";

export type LiveLessonTurn = {
  role: "mascot" | "user";
  text: string;
};

export type LiveLessonPhase = "teach" | "check" | "evaluate" | "recap";
export type LiveLessonVerdict = "got-it" | "partial" | "missed";

export type LiveLessonRequest = {
  nutrient: NutrientKey;
  facts: LearnFactsPacket;
  language: "en" | "hi";
  phase: LiveLessonPhase;
  turns: LiveLessonTurn[];
  // Real foodEventIds already used as a teaching/check example this
  // session, so a retry or the check phase doesn't reuse one.
  usedFoodEventIds: string[];
};

export type LiveLessonResponse =
  | {
      ok: true;
      message: string;
      exampleFoodEventId: string | null;
      verdict: LiveLessonVerdict | null; // only set (and meaningful) for phase "evaluate"
    }
  | { ok: false; error: string };

// Convenience alias for call sites that have already checked `.ok` (or,
// like callTurn in the class page, want to declare a return type that
// keeps that narrowing instead of re-widening back to the full union).
export type LiveLessonSuccess = Extract<LiveLessonResponse, { ok: true }>;