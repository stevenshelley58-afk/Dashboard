export type JobType = "shopify_7d_fill" | "shopify_fresh";

export function isKnownJobType(value: string): value is JobType {
  return value === "shopify_7d_fill" || value === "shopify_fresh";
}




