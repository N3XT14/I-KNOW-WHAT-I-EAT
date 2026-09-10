import type { LearnContentBlock } from "@/types/learnContent";
import type { Profile } from "@/types/profile";
import type { FoodEvent } from "@/types/foodEvent";
import type { NutrientKey } from "@/types/nutrientLimits";
import StoryBlockView from "./StoryBlockView";
import QuizMcBlockView from "./QuizMcBlockView";
import ComparisonBlockView from "./ComparisonBlockView";
import BarVsLimitBlockView from "./BarVsLimitBlockView";
import RankedListBlockView from "./RankedListBlockView";
import DecoyBlockView from "./DecoyBlockView";
import SpotTheTrickBlockView from "./SpotTheTrickBlockView";
import MatchingBlockView from "./MatchingBlockView";

export default function LearnBlockRenderer({
  block,
  profile,
  events,
  lessonId,
  nutrient,
  onAnswered,
}: {
  block: LearnContentBlock;
  profile: Profile;
  events: FoodEvent[];
  lessonId: string;
  nutrient: NutrientKey;
  onAnswered?: (blockId: string) => void;
}) {
  switch (block.kind) {
    case "story":
      return <StoryBlockView block={block} />;
    case "matching":
      return <MatchingBlockView block={block} />;
    case "quiz-mc":
      return <QuizMcBlockView block={block} profile={profile} events={events} lessonId={lessonId} nutrient={nutrient} onAnswered={onAnswered} />;
    case "comparison":
      return <ComparisonBlockView block={block} profile={profile} events={events} lessonId={lessonId} nutrient={nutrient} onAnswered={onAnswered} />;
    case "bar-vs-limit":
      return <BarVsLimitBlockView block={block} profile={profile} events={events} lessonId={lessonId} nutrient={nutrient} onAnswered={onAnswered} />;
    case "ranked-list":
      return <RankedListBlockView block={block} profile={profile} events={events} lessonId={lessonId} nutrient={nutrient} onAnswered={onAnswered} />;
    case "decoy":
      return <DecoyBlockView block={block} profile={profile} events={events} lessonId={lessonId} nutrient={nutrient} onAnswered={onAnswered} />;
    case "spot-the-trick":
      return <SpotTheTrickBlockView block={block} profile={profile} events={events} lessonId={lessonId} nutrient={nutrient} onAnswered={onAnswered} />;
  }
}