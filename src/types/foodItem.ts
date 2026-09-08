// The one thing that changes between "packaged item with a real label"
// and "anything without one" is whether we have sourced numbers to do
// nutrient math against. Everything else — history, the Instant Check
// card, logging — is shared. FoodItem is that fork, and FoodEvent (see
// types/foodEvent.ts) holds one of these instead of a bare LabelExtraction.
//
// itemKind on the "estimated" branch (prepared_dish / raw_ingredient /
// other, see types/estimatedExtraction.ts) is context only — it never
// creates a third code path here. A raw ingredient and a home-cooked dish
// are both just "estimated."

import type { LabelExtraction } from "@/types/labelExtraction";
import type { EstimatedExtraction } from "@/types/estimatedExtraction";

export type FoodItem =
  | { kind: "sourced"; extraction: LabelExtraction }
  | { kind: "estimated"; extraction: EstimatedExtraction };

export function isSourced(
  item: FoodItem,
): item is { kind: "sourced"; extraction: LabelExtraction } {
  return item.kind === "sourced";
}

export function isEstimated(
  item: FoodItem,
): item is { kind: "estimated"; extraction: EstimatedExtraction } {
  return item.kind === "estimated";
}

// Both extraction shapes carry `productName` and `headline` with the same
// field names on purpose (see estimatedExtraction.ts) — these two helpers
// just make that explicit at the call site instead of every screen
// reaching into `.extraction.productName` and needing to remember why
// that's safe for both kinds.
export function itemTitle(item: FoodItem): string | null {
  return item.extraction.productName;
}

export function itemHeadline(item: FoodItem): { verdict: string; drivingFact: string } {
  return item.extraction.headline;
}

// A single "does this deserve attention" flag that works across both
// kinds — a misleading label claim on the sourced side, a high-level
// watch item on the estimated side. Used where the UI needs one boolean
// (e.g. a fallback verdict tone) without caring which kind produced it.
export function itemHasFlag(item: FoodItem): boolean {
  if (item.kind === "sourced") return item.extraction.claims.some((c) => c.isMisleading);
  return item.extraction.watchItems.some((w) => w.level === "high");
}