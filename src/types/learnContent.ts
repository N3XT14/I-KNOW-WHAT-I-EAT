// The generative Learn Mode content schema. Gemini fills these shapes —
// it never invents a number: every numeric field is computed beforehand
// from real FoodEvents (lib/learnContentPool.ts) or the sourced
// NUTRIENT_LIMITS/glossary tables and handed to the prompt as fixed
// fact, same discipline as /api/tutor-tip. `source` on every challenge
// block says which: a real scan, or reference-only knowledge — so the UI
// can badge it honestly and a scan-less profile still gets challenges.

import type { NutrientKey } from "@/types/nutrientLimits";

export type ContentSource = { kind: "scan"; foodEventId: string } | { kind: "reference" };

export type Difficulty = 1 | 2 | 3;

type BlockBase = { id: string; difficulty?: Difficulty };

export type StoryBlock = BlockBase & {
  kind: "story";
  text: string;
  mascotLine?: string;
};

export type QuizMcBlock = BlockBase & {
  kind: "quiz-mc";
  prompt: string;
  options: { id: string; label: string }[];
  correctOptionId: string;
  explanation: string;
  source: ContentSource;
};

export type ComparisonBlock = BlockBase & {
  kind: "comparison";
  prompt: string;
  items: { label: string; value: number; unit: "g" | "mg"; foodEventId?: string }[];
  correctLabel: string;
  explanation: string;
  source: ContentSource;
};

export type BarVsLimitBlock = BlockBase & {
  kind: "bar-vs-limit";
  prompt: string;
  label: string;
  value: number;
  limit: number;
  unit: "g" | "mg";
  explanation: string;
  source: ContentSource;
};

export type RankedListBlock = BlockBase & {
  kind: "ranked-list";
  prompt: string;
  items: { label: string; foodEventId: string; value: number }[];
  explanation: string;
  source: ContentSource;
};

export type DecoyBlock = BlockBase & {
  kind: "decoy";
  prompt: string;
  real: { label: string; foodEventId: string };
  decoy: { label: string; value: number; unit: "g" | "mg" };
  explanation: string;
  source: ContentSource;
};

export type SpotTheTrickBlock = BlockBase & {
  kind: "spot-the-trick";
  prompt: string;
  claimText: string;
  isMisleading: boolean;
  explanation: string;
  source: ContentSource;
};

export type MatchingBlock = BlockBase & {
  kind: "matching";
  prompt: string;
  pairs: { term: string; meaning: string }[];
  source: ContentSource;
};

export type ChallengeBlock =
  | QuizMcBlock
  | ComparisonBlock
  | BarVsLimitBlock
  | RankedListBlock
  | DecoyBlock
  | SpotTheTrickBlock
  | MatchingBlock;

export type LearnContentBlock = StoryBlock | ChallengeBlock;

export function isChallengeBlock(block: LearnContentBlock): block is ChallengeBlock {
  return block.kind !== "story";
}

export type LearnContentSequence = {
  lessonId: string;
  nutrient: NutrientKey;
  blocks: LearnContentBlock[];
  generatedAt: string;
  isFallback: boolean; // true when Gemini generation failed and lib/learnContentFallback.ts filled in
};