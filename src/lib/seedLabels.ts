// pre-baked data for demo — reliability fallback for judges without a
// physical label, and for the "home-cooked" mode where there's no
// physical anything to point a camera at reliably on demand.
import type { FoodItem } from "@/types/foodItem";

export type SeedItem = {
  id: string;
  title: string;
  item: FoodItem;
};

export const SEED_LABELS: SeedItem[] = [
  {
    id: "mango-drink",
    title: "Mango Twist Fruit Drink",
    item: {
      kind: "sourced",
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
  },
  {
    id: "namkeen",
    title: "Tangy Masala Namkeen",
    item: {
      kind: "sourced",
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
  },
  {
    id: "digestive-biscuits",
    title: "Choco Grain Digestive Biscuits",
    item: {
      kind: "sourced",
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
  },
  {
    id: "veg-pulao",
    title: "Home-style Vegetable Pulao",
    item: {
      kind: "estimated",
      extraction: {
        itemKind: "prepared_dish",
        productName: "Vegetable Pulao",
        userDescription: "Home-cooked vegetable pulao with ghee tempering",
        watchItems: [
          {
            nutrient: "Oil / ghee",
            level: "moderate",
            note: "Visible sheen on the rice suggests a normal home-cooked amount of ghee, not a heavy hand.",
          },
          {
            nutrient: "Refined carbs",
            level: "moderate",
            note: "White rice as the base — pairing with a protein or dal makes this a more balanced plate.",
          },
        ],
        headline: {
          verdict: "Fairly balanced plate",
          drivingFact:
            "Looks like a normal home-cooked portion — no single ingredient stands out as heavy-handed from the photo.",
        },
      },
    },
  },
];