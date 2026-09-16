import type { NutrientKey } from "@/types/nutrientLimits";
import type { Language } from "@/types/profile";

const LABELS: Record<Language, Record<NutrientKey, string>> = {
  en: { sugar: "sugar", sodium: "sodium", saturatedFat: "saturated fat" },
  hi: { sugar: "चीनी", sodium: "सोडियम", saturatedFat: "सैचुरेटेड फैट" },
};

// lang defaults to "en" so every existing call site (untouched) keeps
// behaving exactly as before.
export function nutrientLabel(key: NutrientKey, lang: Language = "en"): string {
  return LABELS[lang][key];
}