// pre-baked data for demo
import type { LabelExtraction } from "@/types/labelExtraction";

export type SeedLabel = {
  id: string;
  title: string;
  extraction: LabelExtraction;
};

export const SEED_LABELS: SeedLabel[] = [
  {
    id: "mango-drink",
    title: "Mango Twist Fruit Drink",
    extraction: {
      productName: "Mango Twist Fruit Drink",
      servingSize: "200ml (1 pack)",
      nutrients: [
        { name: "Energy", amount: "90 kcal", percentDailyValue: 5 },
        { name: "Total Fat", amount: "0g", percentDailyValue: 0 },
        { name: "Total Sugars", amount: "18g", percentDailyValue: 36 },
        { name: "Sodium", amount: "10mg", percentDailyValue: 1 },
      ],
      claims: [
        {
          text: "Made with Real Fruit",
          isMisleading: false,
          note: "Contains fruit pulp — but sugar is still the second-highest ingredient by weight.",
        },
        {
          text: "No Added Preservatives",
          isMisleading: false,
          note: "Matches the ingredient list printed on the pack.",
        },
      ],
      headline: {
        verdict: "High in sugar",
        drivingFact: "18g sugar per pack — about 4.5 teaspoons in one small drink.",
      },
    },
  },
  {
    id: "namkeen",
    title: "Tangy Masala Namkeen",
    extraction: {
      productName: "Tangy Masala Namkeen",
      servingSize: "30g (1 small pack)",
      nutrients: [
        { name: "Energy", amount: "160 kcal", percentDailyValue: 8 },
        { name: "Total Fat", amount: "9g", percentDailyValue: 13 },
        { name: "Saturated Fat", amount: "4g", percentDailyValue: 18 },
        { name: "Total Sugars", amount: "1g", percentDailyValue: 2 },
        { name: "Sodium", amount: "410mg", percentDailyValue: 21 },
      ],
      claims: [
        {
          text: "Baked, Not Fried",
          isMisleading: true,
          note: "9g fat in a small pack is close to what a fried snack this size would have — baked doesn't automatically mean low-fat here.",
        },
      ],
      headline: {
        verdict: "High in sodium",
        drivingFact: "410mg sodium in one small pack — about a fifth of a full day's adult limit.",
      },
    },
  },
  {
    id: "digestive-biscuits",
    title: "Choco Grain Digestive Biscuits",
    extraction: {
      productName: "Choco Grain Digestive Biscuits",
      servingSize: "2 biscuits (25g)",
      nutrients: [
        { name: "Energy", amount: "115 kcal", percentDailyValue: 6 },
        { name: "Total Fat", amount: "5g", percentDailyValue: 7 },
        { name: "Saturated Fat", amount: "3g", percentDailyValue: 14 },
        { name: "Total Sugars", amount: "6g", percentDailyValue: 12 },
        { name: "Sodium", amount: "80mg", percentDailyValue: 4 },
      ],
      claims: [
        {
          text: "Digestive & Diet Friendly",
          isMisleading: true,
          note: "\"Digestive\" here just names the biscuit style, not a health claim — the saturated fat is proportionally on the higher side for a plain biscuit.",
        },
      ],
      headline: {
        verdict: "Watch the saturated fat",
        drivingFact: "3g saturated fat in just 2 biscuits — easy to double or triple in one sitting.",
      },
    },
  },
];