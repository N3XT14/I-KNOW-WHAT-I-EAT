import type { NutrientKey } from "@/types/nutrientLimits";

export function nutrientLabel(key: NutrientKey): string {
  if (key === "saturatedFat") return "saturated fat";
  return key;
}