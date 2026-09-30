// Client-safe survey labels (lib/survey.ts is server-only: it uses crypto).
export const RATING_KEYS = ["communication", "cleanliness", "setup", "arrival", "value"] as const;
export type RatingKey = (typeof RATING_KEYS)[number];
export const RATING_LABELS: Record<RatingKey, string> = {
  communication: "Communication with the BX team",
  cleanliness: "The space was clean and ready when you arrived",
  setup: "The setup matched what you asked for",
  arrival: "Arrival, parking and finding your rooms",
  value: "Value for the price",
};
export const EASE_LABELS = ["Strongly disagree", "Disagree", "Neutral", "Agree", "Strongly agree"] as const;
